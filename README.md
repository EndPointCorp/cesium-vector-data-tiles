# cesium-vector-data-tiles

Convert GeoNames cities datasource into Cesium VectorData tileset
https://github.com/CesiumGS/3d-tiles/tree/vctr/TileFormats/VectorData

Live demo https://endpointcorp.github.io/cesium-vector-data-tiles/

## Get data
Download and unpack `cities500.txt` from 
https://download.geonames.org/export/dump/cities500.zip to `data/cities500.txt`

## Install dependancies
```bash
yarn
```

## Run serve
```bash
node src/index.mjs serve
```

open `http://localhost:8089`

## Export data
```bash
node src/index.mjs export
```

run any kind of a web server in the root directory of the project eg
```bash
http-server
```

open `http://localhost:8080`


## Geonames data structure

```
The main 'geoname' table has the following fields :
---------------------------------------------------
0   geonameid         : integer id of record in geonames database
1   name              : name of geographical point (utf8) varchar(200)
2   asciiname         : name of geographical point in plain ascii characters, varchar(200)
3   alternatenames    : alternatenames, comma separated, ascii names automatically transliterated, convenience attribute from alternatename table, varchar(10000)
4   latitude          : latitude in decimal degrees (wgs84)
5   longitude         : longitude in decimal degrees (wgs84)
6   feature class     : see http://www.geonames.org/export/codes.html, char(1)
7   feature code      : see http://www.geonames.org/export/codes.html, varchar(10)
8   country code      : ISO-3166 2-letter country code, 2 characters
9   cc2               : alternate country codes, comma separated, ISO-3166 2-letter country code, 200 characters
10  admin1 code       : fipscode (subject to change to iso code), see exceptions below, see file admin1Codes.txt for display names of this code; varchar(20)
11  admin2 code       : code for the second administrative division, a county in the US, see file admin2Codes.txt; varchar(80) 
12  admin3 code       : code for third level administrative division, varchar(20)
13  admin4 code       : code for fourth level administrative division, varchar(20)
14  population        : bigint (8 byte int) 
15  elevation         : in meters, integer
16  dem               : digital elevation model, srtm3 or gtopo30, average elevation of 3''x3'' (ca 90mx90m) or 30''x30'' (ca 900mx900m) area in meters, integer. srtm processed by cgiar/ciat.
17  timezone          : the iana timezone id (see file timeZone.txt) varchar(40)
19  modification date : date of last modification in yyyy-MM-dd format
```

City node clazz values
```
PPL 	populated place	a city, town, village, or other agglomeration of buildings where people live and work
PPLA	seat of a first-order administrative division	seat of a first-order administrative division (PPLC takes precedence over PPLA)
PPLA2	seat of a second-order administrative division
PPLA3	seat of a third-order administrative division
PPLA4	seat of a fourth-order administrative division
PPLA5	seat of a fifth-order administrative division
PPLC	capital of a political entity
PPLCH	historical capital of a political entity	a former capital of a political entity
PPLF	farm village	a populated place where the population is largely engaged in agricultural activities
PPLG	seat of government of a political entity
PPLH	historical populated place	a populated place that no longer exists
PPLL	populated locality	an area similar to a locality but with a small group of dwellings or other buildings
PPLQ	abandoned populated place
PPLR	religious populated place	a populated place whose population is largely engaged in religious occupations
PPLS	populated places	cities, towns, villages, or other agglomerations of buildings where people live and work
PPLW	destroyed populated place	a village, town or city destroyed by a natural disaster, or by war
PPLX	section of populated place
STLMT	israeli settlement
```
