#!/bin/bash
export version=`cat version.number|awk -F. -v OFS=. 'NF==1{print ++$NF}; NF>1{if(length($NF+1)>length($NF))$(NF-1)++; $NF=sprintf("%0*d", length($NF), ($NF+1)%(10^length($NF))); print}'`
echo $version > version.number
export buildDate=`date '+%Y-%m-%d %H:%M:%S'`
echo Passing version: $version
echo Passing buildDate: $buildDate
export env=development
node index.js