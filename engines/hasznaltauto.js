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
var http = require('http');
var utils = require('../utils.js');

function listCarsOnHasznaltauto(id, url, done) {

    var cookie = global.config.cookie || '';
    if (config.telepulesID != null)
        cookie += "telepules_id_user=" + config.telepulesID + "; telepules_saved=1; visitor_telepules=" + config.telepulesID + ";";

    request({
        url: url,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36',
            'Cookie': cookie
        }
    }, function(err, response, body) {
        if (err) {
            console.log("HIBA", err);
            return done(err);
        }

        if (response.statusCode != 200) {
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
                    description: {
                        selector: ".talalati_lista_infosor",
                        convert: function(text) {
                    	    var desc=text.replace(/\u00a0/g, ' ')
			    var details=desc.split('·')
			    return details;
                        }
                    },
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
            car.priceNumeric = utils.getNumericPrice(car.price);
        });
        console.log("A keresés " + page.cars.length + " autót talált.\n");
        if (page.cars.length == 0) {
            console.log("missing data here:", body);
            fs.writeFile("./public/error.txt", body);
        }
        done(null, page);
    });
}



function searchOnHasznaltautoHu(newCars, item, done) {
    console.log(item.name.bold + " keresés figyelése...");

    listCarsOnHasznaltauto(item.id, item.url, function(err, list) {

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
        fs.writeFile(path.join(global.dataDir, item.id + ".json"), JSON.stringify(list, null, 4));

        item.lastResult = list;

        done();
    });

}


//var x = false;
function checkAndUpdateCarDetails(car) {
    //    if(!x) {
    //	x=true;
    //var request = require('request');
    if (typeof car.extras == "undefined") {
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
        if (!!lastModified) {
            imageDate = new Date(lastModified).getTime();
        }
        car.extras.imageDate = imageDate;
        //console.log("car data", JSON.stringify(car));
    }

    if (typeof car.extras.felszereltseg == "undefined") {
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


console.log("::HASZNALTAUTO.JS INCLUDED::");

module.exports = {
	listCars: listCarsOnHasznaltauto,
	search: searchOnHasznaltautoHu,
	checkDetails: checkAndUpdateCarDetails
};