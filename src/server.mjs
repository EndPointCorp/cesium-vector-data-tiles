import fs from 'fs';
import url from 'url';
import http from 'http';
import path from 'path';
import { mimeType } from "./mimetype.mjs"
import { readData, getDataPath, scoreF, getCitySize } from "./data.mjs"
import { num2box, QTree } from "./qtree.mjs"
import { encodeTile, Rectangle, Cartographic } from "./encodeTile.mjs"
import { encodeSubtree } from './encodeSubtree.mjs';

const DATASETS = {};

async function loadData(options) {
    const dataPath = options?.data || getDataPath('cities500.txt');

    const dataTree = new QTree({scoreF, minDepth: 1});
    await readData(dataPath, (n, cls) => {
        if (cls === 'P') {
            const size = getCitySize(n);
            if (size <= 3) {
                dataTree.insert(n, 14);
            }
            else if (size <= 5) {
                dataTree.insert(n, 10);
            }
            else if (size <= 3) {
                dataTree.insert(n, 6);
            }
            else {
                dataTree.insert(n);
            }
        }
    });

    var depth = 0;
    dataTree.traverseBFS(tile => {
        if (tile.z > depth) {
            depth = tile.z;
        }
    });

    console.log('tree depth', depth);

    DATASETS['labels'] = dataTree;
}

export async function startServer(options) {
    const {host = 'localhost', port=8089} = options || {};

    await loadData(options);

    const basePath = path.normalize(process.cwd());
    console.log('basePath', basePath);

    const server = http.createServer((request, response) => {
        const parsedUrl = url.parse(request.url);

        const sanitizePath = path.normalize(parsedUrl.pathname).replace(/^(\.\.[\/\\])+/, '');
        let pathname = path.join(basePath, sanitizePath);

        const contentTmsMatch = /content\/([\w_\d-]+\/)?([0-9]+)__([0-9]+)_([0-9]+)\.vctr/.exec(pathname);
        if (contentTmsMatch) {
            const dataset = (contentTmsMatch[1] || 'labels').replace('/', '');
            const [z, x, y] = [
                parseInt(contentTmsMatch[2]), 
                parseInt(contentTmsMatch[3]), 
                parseInt(contentTmsMatch[4])
            ];
            
            serveContent(response, {x, y, z, dataset});

            return;
        }
        
        const subtreeTmsMatch = /subtrees\/([\w_\d-]+\/)?([0-9]+)\.([0-9]+)\.([0-9]+)\.subtree/.exec(pathname);
        if (subtreeTmsMatch) {
            const dataset = (subtreeTmsMatch[1] || 'labels').replace('/', '');
            const [z, x, y] = [
                parseInt(subtreeTmsMatch[2]), 
                parseInt(subtreeTmsMatch[3]), 
                parseInt(subtreeTmsMatch[4])
            ];

            serveSubtree(response, {x, y, z, dataset});

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

function serveContent(response, {x, y, z, dataset}) {
    const dataTree = DATASETS[dataset];
    if (!dataTree) {
        return end404(response);
    }

    const cityPoints = [];
    dataTree.collectPointsForTile({x, y, z}, cityPoints);

    const tbb = num2box(x, y, z);
    const rectangle = new Rectangle(tbb.minx, tbb.miny, tbb.maxx, tbb.maxy);
    const positions = cityPoints.map(p => Cartographic.fromDegrees(p.lon, p.lat, p.ele));
    const titles = cityPoints.map(p => p.name);
    const sizes = cityPoints.map(p => p.size);

    const points = {
        positions,
        length: cityPoints.length,
    };

    const attributes = [{
        propertyName: "title",
        values: titles,
        binary: false
    }, {
        propertyName: "size",
        values: sizes,
        binary: false
    }];

    const buff = encodeTile(rectangle, attributes, {points});

    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-type', 'application/octet-stream' );

    response.write(buff, undefined, () => {
        response.end();
    });
}

function serveSubtree(response, {x, y, z, dataset}) {

    const dataTree = DATASETS[dataset];
    if (!dataTree) {
        return end404(response);
    }

    const tile = dataTree.traverseToTile({x, y, z});
    if (!tile) {
        return end404(response);
    }

    const buff = encodeSubtree(tile, 3);

    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-type', 'application/octet-stream' );

    response.write(buff, undefined, () => {
        response.end();
    });
}

function end404(response) {
    response.statusCode = 404;
    response.end(`File not found!`);
}
