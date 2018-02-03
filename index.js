var async = require("async");
var _ = require("lodash");
var fs = require("fs");
var path = require("path");
var mkdir = require("mkdirp");
var scrape = require("scrape-it");
var cheerio = require("cheerio");
var request = require("request");
var syncRequest = require("sync-request");
var colors = require("colors");
var mailcomposer = require('mailcomposer');
var http = require('http');
var pug = require('pug');
//var express = require('express');


console.log("Running Hasznaltauto-figyelo..");
/*http.createServer(function (req, res) {
    try {
	console.log("Got request", process.env.foobar);
    	//res.writeHead(200, {'Content-Type': 'text/html'});
	//res.end('<body style="font-family: monospace;"> HELLO! </body>');
	ReactDOM.render(
	     <Board />,
	      document.getElementById(‘root’)
	)	;
    } catch(e) {
        res.writeHead(503, {'Content-Type': 'text/html'});
        res.end('Error: ' + e);
    }
}).listen(8080);*/
const express = require('express')
const app = express()

app.use(express.static('public'))
app.use(express.static('data'))

const appInfo = {};

appInfo.version = process.env.version || false;
appInfo.buildDate = process.env.buildDate || false;
appInfo.environment = process.env.env || false;
app.get('/', (req, res) => {

    const output = pug.compileFile('templates/index.pug');
    //console.log("srcs", config.searches[0].lastResult.cars[0].description.replace('\u00A0','x'));
    res.send(output({application: appInfo, results:config.searches || []}))
})


app.listen(8080, () => console.log('Example app listening on port 8080!'))

var configFile = "settings";
var configFileWithExtension = configFile + '.js';
var configFilePath = "./" + configFileWithExtension;
if (!fs.existsSync(configFilePath)) {
	console.error(colors.bgRed("A " + configFileWithExtension +" fájl nem található. Nevezze át a mappában található " + colors.bold("config.example.js") + " fájlt " + colors.bold(configFileWithExtension) + " fájlra és módosítsa a tartalmát. Adja meg a keresési linkeket, illetve az e-mail küldéshez szükséges adatokat."));
	process.exit(1);
	return;
}

var config = require("./" + configFile);

var Mailgun = require('mailgun').Mailgun;
var mg = new Mailgun(config.email && config.email.mailgunKey ? config.email.mailgunKey : null);

var dataDir = path.join(__dirname, config.dataDir || "./data");
mkdir(dataDir);

var format = function(format) {
	if (arguments.length >= 2)
		for (i=1; i < arguments.length; i++)
			format = format.replace(/\{\d+?\}/, arguments[i]);
	return format;
};

function listCars(id, url, done) {

	var cookie = config.cookie || '';
	if (config.telepulesID != null)
		cookie += "telepules_id_user=" + config.telepulesID + "; telepules_saved=1; visitor_telepules=" + config.telepulesID + ";";

	request({
		url: url,
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36',
			'Cookie': cookie
		}
	}, function(err, response, body ) {
		if (err) {
			console.log("HIBA", err);
			return done(err);
		}

		if(response.statusCode != 200)
		{
			console.log("StatusCode: ", response.statusCode);
		}
		$ = cheerio.load(body);
		var scriptsText = $('script').text();
		//console.log("scripts", scriptsText);
		var page = scrape.scrapeHTML($, {
			cars: {
				listItem: ".talalati_lista",
				data: {
					id: {
						selector: ".talalati_lista_head a",
						attr: "href",
						convert: function(s) {
							return s.split("-").pop();
						}
					},
					link: {
						selector: ".talalati_lista_head a",
						attr: "href"
					},
					title: ".talalati_lista_head a",
					description: ".talalati_lista_infosor",
					image: {
						selector: ".talalati_lista_kep img",
						attr: "id",
						convert: function(id) {
							if (typeof id == "undefined") return "";
							var regexp = new RegExp(".*(lazy_images)\." + id + "...'([^']+).*", "m");
							ret = regexp.exec(scriptsText);
							if (ret == null) {
							    console.log("UNABLE TO FIND IMAGE URL FOR ID: " + id);
							    return "";
							}
							var imgUrl = ret[2];
							//console.log('converting img from:  "' +id + '" to:' + imgUrl)
							//die();
							return imgUrl;
						}
					},
					price: ".talalati_lista_vetelar strong",
					distance: ".tavolsag_talalati"
				}
			}
		});
		page.cars.map(function(car, index) {
		    car.priceNumeric = getNumericPrice(car.price);
		});
		console.log("A keresés " + page.cars.length + " autót talált.\n");
		if (page.cars.length == 0) {
		    console.log("missing data here:", body);
		    fs.writeFile("./public/error.txt", body);
		}
		done(null, page);
	});
}

function getNumericPrice(text) {
    //1.343.434 Ft -> 1343434
    var rx = new RegExp("[\\.\\sa-zA-Z]","g")
    return parseInt(text.replace(rx,""));
}

function loadLists() {

	if (config.searches && config.searches.length > 0) {

		async.eachSeries(config.searches, function(item, done) {

			console.log("A(z) " + item.name.bold + " lista betöltése fájlból...");

			var fName = path.join(dataDir, item.id + ".json");
			if (fs.existsSync(fName)) {
				fs.readFile(fName, function(err, data) {
					if (err) return done();
					try {
						item.lastResult = JSON.parse(data);
					} catch(e) {
						console.log("Fájl formátum hiba!");
					}
					//console.log(item.lastResult);

					done();
				});
			}
			else
				done();
		});
	}
}

//var x = false;
function checkAndUpdateCarDetails(car) {
//    if(!x) {
//	x=true;
	//var request = require('request');
	if (typeof car.extras == "undefined")
	{ 
	    car.extras = {};
	    console.log("Getting details of car: ", car.title, car.id, typeof car.extras);
	}
	
	if (typeof car.extras.imageDate == "undefined" && !!car.image) { 
	    //console.log("car image van");
	    /*request(car.image, {method: 'HEAD'}, function (err, res, body){
		    //console.log(res.headers);
		    lastModified = res.headers['last-modified']
		    imageDate = "";
		    if (!!lastModified) 
		    {
			imageDate = new Date(lastModified).getTime();		    
		    }
		    car.extras["imageDate"] = imageDate;
		    console.log("img date:", imageDate, lastModified);
	    });*/
	    var res = syncRequest('HEAD', car.image);
	    //console.log(res.headers);
	    lastModified = res.headers['last-modified']
	    imageDate = "";
	    if (!!lastModified) 
	    {
		imageDate = new Date(lastModified).getTime();		    
	    }
	    car.extras.imageDate = imageDate;
	    //console.log("car data", JSON.stringify(car));
	}
	
	if (typeof car.extras.felszereltseg == "undefined")
	{
	    //x = true;
	    var res = syncRequest('GET', car.link);
	    var body = res.getBody();
	    //console.log(res.headers);
	    //felszereltseg = {};
	    $ = cheerio.load(body);
	    var scriptsText = $('script').text();
	    //console.log("scripts", scriptsText);
	    felszereltseg = scrape.scrapeHTML($, {
		valto: {
		    selector: "tr:contains('Sebességváltó fajtája') td:last-child"
		},
	    	muszaki: {
	    		listItem: ".felszereltseg li",
	    		/*data: {
	    		    key: {
	    		    }
	    		}*/
	    	}
	    });
	    felszereltseg.automata = felszereltseg.valto.indexOf("Fokozatmentes automata sebességváltó") >= 0;
	    felszereltseg.tempomat = felszereltseg.muszaki.indexOf("tempomat") >= 0;
	    felszereltseg.tolatoradar = felszereltseg.muszaki.indexOf("tolatóradar") >= 0;
	    //console.log("page", JSON.stringify(felszereltseg));
	    
	    //die();
	    car.extras.felszereltseg = felszereltseg;
	}
//    }
}

function doWork() {
	console.log("\n------------------ " + (new Date().toLocaleString()) + " -------------------\n");

	var newCars = [];
	//newCars.push({price:12345, category: "ez_lesz_a_kategória"})
	if (config.searches && config.searches.length > 0) {

		async.eachSeries(config.searches, function(item, done) {

			console.log(item.name.bold + " keresés figyelése...");

			listCars(item.id, item.url, function(err, list) {

				if (err)
					return console.error(err);

				// Diff
				list.cars.forEach(function(car) {

					var oldItem;
					var priceChanged;
					var oldPrice, newPrice;

					if (item.lastResult && item.lastResult.cars) {
						 oldItem = _.find(item.lastResult.cars, function(item) {
							found = item.id == car.id;
							if (found) {
								priceChanged = !(item.price == car.price);
								oldPrice = item.price;
								newPrice = car.price;
							}
							return found;
						});
					}

					if (!oldItem) {
						console.log("Új autót találtam!".bgGreen.white);
						//load extra data!
						car.originalPriceNumeric = car.priceNumeric;
						checkAndUpdateCarDetails(car);
						console.log(
							car.title.bold + "\n" +
							car.description + "\n" +
							"Ár: " + car.price + "\n" +
							"Távolság: " + car.distance + "\n" +
							"Link: " + car.link + "\n"
						);
						//console.log(car);
						newCars.push(car);
					} else {
						//ez egy regi elem, az uj elemre masoljuk a korabbi adatait..(vagy toltsuk be ujra, ha hianyzik)
						car.extras = oldItem.extras;
						car.originalPriceNumeric = (typeof oldItem.originalPriceNumeric == "undefined" ? getNumericPrice(oldItem.price) : oldItem.originalPriceNumeric);
						checkAndUpdateCarDetails(car);
						if (priceChanged) {
						        console.log("Megváltozott az ár!".bgYellow.black);
							console.log(
								car.title.bold + "\n" +
								car.description + "\n" +
								"Régi ár: " + oldPrice + "\n" +
								"Új ár: " + newPrice + "\n" +
								"Link: " + car.link + "\n"
							);
						}
					}
				});
				console.log("writing json file:", item.id + ".json");
				fs.writeFile(path.join(dataDir, item.id + ".json"), JSON.stringify(list, null, 4));

				item.lastResult = list;

				done();
			});

		}, function() {
			if (newCars.length > 0) {

				var txt = [];

				newCars.forEach(function(car) {
					txt.push("<b>" +car.title + "</b>");
					txt.push(car.description);
					txt.push("<b>Ár: </b> " + car.price);
					txt.push("<b>Link: </b>" + car.link);
					txt.push("<b>Távolság: </b>" + car.distance);
					txt.push("<b>Kategória:</b> " + car.category);
					txt.push("<b>ID: </b>" + car.id);

					txt.push("---------------------");
					txt.push(" ");

					if (config.slackWebHook) {

						request({
							method: "POST",
							url: config.slackWebHook,

							json: {
								text: car.title + "\n" +
									  car.description + "\n" +
										"Kategória: " + car.category + "\n" +
									  "Ár: " + car.price + "\n" +
									  "Link: " + car.link + "\n" +
									  "Távolság: " + car.distance + "\n" +
									  "ID: " + car.id
							}
						}, function(err, response, body ) {
							if (err) {
								return console.error(err);
							}

							console.log("Slack-re továbbítva.");
						});
					}

				});

				if (config.email && config.email.recipients && config.email.recipients.length > 0) {
					
					var subject = format(config.email.subject || "{0} új használtautó!", newCars.length) + ' - Env: ' + process.env.env;

					/*
					mg.sendText("hasznaltauto-figyelo@mail.com", config.email.recipients, subject, txt.join("\r\n"), function(err) {
						if (err)
							return console.error("Email küldési hiba!", err);

						console.log("Email kiküldve az alábbi címekre: " + config.email.recipients.join(", ").bold);
					});*/

					var mail = mailcomposer({
					  from: 'hasznaltauto-figyelo@mail.com',
					  to: config.email.recipients,
					  subject: subject,
					  body: 'Test email text1',
					  html: txt.join("<br />")
					});

					mail.build(function(mailBuildError, message) {

					    var dataToSend = {
					        to: 'mm@samples.mailgun.org',
					        message: message.toString('ascii')
					    };

					    mg.sendRaw('hasznaltauto-figyelo@mail.com', config.email.recipients, message.toString('ascii'), "", function (sendError, body) {
					        if (sendError) {
					            return console.error("Email küldési hiba!", sendError);
					        }
									console.log("Email kiküldve az alábbi címekre: " + config.email.recipients.join(", ").bold);
					    });
					});
				}
			}

			if (newCars.length > 0)
				console.log(colors.white(colors.bold(newCars.length) + " új autót találtam! Várakozás a következő frissítésre...\n"));
			else
				console.log(colors.yellow("Nem találtam új autót. Várakozás a következő frissítésre...\n"));
		});
	}

}


setInterval(function() {
	doWork();
}, (config.time || 5) * 60 * 1000);

console.log(colors.bold("\n\nFigyelő indítása... Frissítési idő: " + (config.time || 10) + " perc"));
console.log("------------------\n");

loadLists();


setTimeout(function() {
	doWork();
}, 1 * 1000);
