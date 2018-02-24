function getNumericPrice(text) {
    //1.343.434 Ft -> 1343434
    var rx = new RegExp("[\\.\\sa-zA-Z]", "g")
    return parseInt(text.replace(rx, ""));
}

module.exports = {
    getNumericPrice: getNumericPrice
};