import fs from 'fs';
import url from 'url';
import http from 'http';
import path from 'path';
import { mimeType } from "./mimetype.mjs"
import { readData, getDataPath, scoreF } from "./data.mjs"
import { num2box, QTree } from "./qtree.mjs"
import { encodeTile, Rectangle, Cartographic } from "./encodeTile.mjs"
import { encodeSubtree } from './encodeSubtree.mjs';


export async function startServer(options) {
    const {host = 'localhost', port=8089} = options || {};
    const dataPath = options?.data || getDataPath('cities500.txt');

    const dataTree = new QTree({scoreF, minDepth: 3});
    await readData(dataPath, (n, cls) => cls === 'P' && dataTree.insert(n));

    var depth = 0;
    dataTree.traverseBFS(tile => {
        if (tile.z > depth) {
            depth = tile.z;
        }
    });

    console.log('tree depth', depth);

    const basePath = path.normalize(process.cwd());
    console.log('basePath', basePath);

    const server = http.createServer((request, response) => {
        const parsedUrl = url.parse(request.url);

        const sanitizePath = path.normalize(parsedUrl.pathname).replace(/^(\.\.[\/\\])+/, '');
        let pathname = path.join(basePath, sanitizePath);

        const contentTmsMatch = /content\/([0-9]+)__([0-9]+)_([0-9]+)\.vctr/.exec(pathname);
        if (contentTmsMatch) {
            const [z, x, y] = [
                parseInt(contentTmsMatch[1]), 
                parseInt(contentTmsMatch[2]), 
                parseInt(contentTmsMatch[3])
            ];
            const cityPoints = [];
            const tile = dataTree.collectPointsForTile({x, y, z}, cityPoints);

            const tbb = num2box(x, y, z);
            const rectangle = new Rectangle(tbb.minx, tbb.miny, tbb.maxx, tbb.maxy);
            const cartoPositions = cityPoints.map(p => Cartographic.fromDegrees(p.lon, p.lat, p.ele));
            const titles = cityPoints.map(p => p.name);
            const sizes = cityPoints.map(p => p.ppl);

            const buff = encodeTile(rectangle, cartoPositions, titles, sizes);

            response.setHeader('Access-Control-Allow-Origin', '*');
            response.setHeader('Content-type', 'application/octet-stream' );

            response.write(buff, undefined, () => {
                response.end();
            });

            return;
        }
        
        const subtreeTmsMatch = /subtrees\/([0-9]+)\.([0-9]+)\.([0-9]+)\.subtree/.exec(pathname);
        if (subtreeTmsMatch) {
            const [z, x, y] = [
                parseInt(subtreeTmsMatch[1]), 
                parseInt(subtreeTmsMatch[2]), 
                parseInt(subtreeTmsMatch[3])
            ];

            console.log(`get ${z}.${x}.${y} subtree`);

            const tile = dataTree.traverseToTile({x, y, z});
            if (!tile) {
                response.statusCode = 404;
                response.end(`File ${pathname} not found!`);
                return;
            }

            const buff = encodeSubtree(tile, 3);

            response.setHeader('Access-Control-Allow-Origin', '*');
            response.setHeader('Content-type', 'application/octet-stream' );

            response.write(buff, undefined, () => {
                response.end();
            });

            return;
        }

        if (!fs.existsSync(pathname)) {
              response.statusCode = 404;
              response.end(`File ${pathname} not found!`);
              return;
        }
        
        // if is a directory, then look for index.html
        if (fs.statSync(pathname).isDirectory()) {
            pathname += '/index.html';
        }

        fs.readFile(pathname, function(err, data) {
            if(err){
                response.statusCode = 500;
                response.end(`Error getting the file: ${err}.`);
            } else {
                const ext = path.parse(pathname).ext;
                response.setHeader('Access-Control-Allow-Origin', '*');
                response.setHeader('Content-type', mimeType[ext] || 'text/plain' );
                response.end(data);
            }
        });
    });

    server.listen(port, host, () => {
        console.log(`Server is running on http://${host}:${port}`);
    });
}