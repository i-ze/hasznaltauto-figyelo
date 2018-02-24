var async = require("async");
var _ = require("lodash");
var fs = require("fs");
var path = require("path");
var mkdir = require("mkdirp");
var request = require("request");
var syncRequest = require("sync-request");
var colors = require("colors");
var http = require('http');
var utils = require('../utils.js');

function listCarsOnJoautok(id, url, done) {

    //var cookie = config.cookie || '';
    //if (config.telepulesID != null)
    //    cookie += "telepules_id_user=" + config.telepulesID + "; telepules_saved=1; visitor_telepules=" + config.telepulesID + ";";
    console.log("lcoj");
    request({
        url: url,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36',
    //        'Cookie': cookie
        }
    }, function(err, response, body) {
	console.log("keresve");
        if (err) {
            console.log("HIBA", err);
            return done(err);
        }

        if (response.statusCode != 200) {
            console.log("StatusCode: ", response.statusCode);
        }
    //    $ = cheerio.load(body);
    //    var scriptsText = $('script').text();
        //console.log("scripts", scriptsText);
        /*var page = scrape.scrapeHTML($, {
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
        });*/
        var jsonResp = JSON.parse(body);
        var result = {};
        result.cars = jsonResp.items.filter(item => item.template == 'car-card').map(function(item){
    	    var ret = {};
    	    var ad = item.advertListItem;
    	    ret.id = ad.id;
    	    ret.priceNumeric = ad.price;
    	    ret.originalPriceNumeric = ad.price;
    	    ret.price = ad.price + " Ft";
    	    ret.title = `${ad.brand.name} ${ad.model.name}`;
    	    ret.image = ad.image && ad.image.srcSet && ad.image.srcSet.length ? ad.image.srcSet[0].url : false;
    	    ret.description = ad.featuredTags.map(text => text.replace(/(.*)<sup>3<\/sup>/g, "$1³"));
    	    ret.description.shift(`${ad.odometer} ${ad.odometerUnit}`);
    	    //ad.featuredTags
    	    ret.extras = {};
    	    ret.extras.imageDate = new Date().getTime();
    	    ret.extras.felszereltseg = {muszaki:[]};
    	    ret.link = `http://joautok.hu/hasznaltauto/${ad.brand.slug}/${ad.model.slug}/${ad.modelFamily.slug}/${ad.id}/`;
    	    
    	    return ret;
        });
        console.log("A keresés " + result.cars.length + " autót talált.\n");
        if (result.cars.length == 0) {
            console.log("missing data here:", body);
            fs.writeFile("./public/error.txt", body);
        }
        done(null, result);
    });
}


function searchOnJoautokHu(newCars, item, done) {
    console.log(item.name.bold + " keresés figyelése...");
    listCarsOnJoautok(item.id, item.url, function(err, list) {
        console.log("writing json file:", item.id + ".json");
        fs.writeFile(path.join(dataDir, item.id + ".json"), JSON.stringify(list, null, 4));
	item.lastResult = list;
	done();
    });
}



function checkDetails(car) {
    return car;
}
module.exports = {
	listCars: listCarsOnJoautok,
	search: searchOnJoautokHu,
	checkDetails: checkDetails
};
console.log("::JóAutók.HU Importálva".red);