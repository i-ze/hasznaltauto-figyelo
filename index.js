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
var hasznaltauto = require('./engines/hasznaltauto');
var joautok = require('./engines/joautok');


function include(file_) {
    with (global) {
        eval(fs.readFileSync(file_) + '');
    };
};

//include("./engines/hasznaltauto.js");
//include("./engines/joautok.js");

console.log("Running Hasznaltauto-figyelo..");
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
    res.send(output({
        application: appInfo,
        results: config.searches || []
    }))
})


app.listen(8080, () => console.log('Example app listening on port 8080!'))

var configFile = "settings";
var configFileWithExtension = configFile + '.js';
var configFilePath = "./" + configFileWithExtension;
if (!fs.existsSync(configFilePath)) {
    console.error(colors.bgRed("A " + configFileWithExtension + " fájl nem található. Nevezze át a mappában található " + colors.bold("config.example.js") + " fájlt " + colors.bold(configFileWithExtension) + " fájlra és módosítsa a tartalmát. Adja meg a keresési linkeket, illetve az e-mail küldéshez szükséges adatokat."));
    process.exit(1);
    return;
}

var config = require("./" + configFile);
global.config = config;

var Mailgun = require('mailgun').Mailgun;
var mg = new Mailgun(config.email && config.email.mailgunKey ? config.email.mailgunKey : null);

var dataDir = path.join(__dirname, config.dataDir || "./data");
global.dataDir = dataDir;
mkdir(dataDir);

var format = function(format) {
    if (arguments.length >= 2)
        for (i = 1; i < arguments.length; i++)
            format = format.replace(/\{\d+?\}/, arguments[i]);
    return format;
};


function loadLists() {
    //TODO eachOfSeries 3. param egy callback..fixalni
    if (config.searches) {
        async.eachOfSeries(config.searches, function(siteSearches, siteName, siteDone) {

            async.eachSeries(config.searches[siteName], function(item, done) {

                console.log("A(z) " + item.name.bold + "(" + siteName.bold.yellow + ") lista betöltése fájlból...");

                var fName = path.join(dataDir, item.id + ".json");
                if (fs.existsSync(fName)) {
                    fs.readFile(fName, function(err, data) {
                        if (err) return done();
                        try {
                            item.lastResult = JSON.parse(data);
                        } catch (e) {
                            console.log("Fájl formátum hiba!");
                        }
                        //console.log(item.lastResult);

                        done();
                    });
                } else
                    done();
            });
            siteDone();
        });
    }
}


function doWork() {
    console.log("\n------------------ " + (new Date().toLocaleString()) + " -------------------\n");

    var newCars = [];
    //newCars.push({price:12345, category: "ez_lesz_a_kategória"})
    if (config.searches /*&& config.searches.hasznaltauto && config.searches.hasznaltauto.length > 0*/ ) {

        async.eachOfSeries(config.searches, function(site, siteName, done) {
    	    
    	    var searchFunctions = {
    	        "hasznaltauto": hasznaltauto.search,
    		"joautok": joautok.search
    	    }
    	    var searchFn = searchFunctions[siteName];

        	console.log("engine: '"+ siteName +"' ok:", (!!searchFn));
    	    if (!!searchFn)
    	    {
    	    

    		async.eachOfSeries(site, function(item, itemName, itemDone) {
			searchFn(newCars, item, itemDone);
		},
		function(){
			done();
		});
		
	    } else {
		done();
	    }
        }, function() {
            if (newCars.length > 0) {

                var txt = [];

                newCars.forEach(function(car) {
                    txt.push("<b>" + car.title + "</b>");
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
                        }, function(err, response, body) {
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

                        mg.sendRaw('hasznaltauto-figyelo@mail.com', config.email.recipients, message.toString('ascii'), "", function(sendError, body) {
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