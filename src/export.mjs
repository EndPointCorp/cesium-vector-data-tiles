import { writeFileSync } from 'fs';
import { getDataPath, readData, scoreF } from "./data.mjs";
import { num2box, QTree, traverseZMortonOrder } from './qtree.mjs';
import { Cartographic, encodeTile, Rectangle } from './encodeTile.mjs';
import { encodeSubtree } from './encodeSubtree.mjs';

const SUBTREE_DEPTH = 3;

export async function exportTiles(options) {
    const dataPath = options.data || getDataPath('cities500.txt');
    console.log('read data', dataPath);

    // Right now this works for refine: ADD
    const dataTree = new QTree({scoreF, minDepth: 1});
    await readData(dataPath, (n, cls) => cls === 'P' && dataTree.insert(n));

    var filesWritten = 0;
    const visitor = (leaf, points) => {
        const {x, y, z} = leaf;
        const tbb = num2box(x, y, z);
        const tilePoints = points?.filter(p => tbb.contains(p.lon, p.lat));

        if (tilePoints?.length > 0) {
            const outPath = getDataPath('content', `${z}__${x}_${y}.vctr`);
            writeTile({x, y, z}, tilePoints, outPath);
            filesWritten++;
        }
    };

    const rIterator = (leaf, collector) => {
        const collectedPoints = [...collector, ...leaf.points];
        visitor(leaf, collectedPoints);

        for (const chld of leaf.children) {
            rIterator(chld, collectedPoints);
        }
    };

    rIterator(dataTree.root, []);

    console.log('content files written', filesWritten);

    // Process subtrees
    var subtreeFilesWritten = 0;
    const rSubtreeTraverse = (tile) => {
        subtreeFilesWritten++;
        const {x, y, z} = tile;
        const outPath = getDataPath('subtrees', `${z}.${x}.${y}.subtree`);
        writeSubtree(tile, outPath);

        traverseZMortonOrder(tile, SUBTREE_DEPTH + 1, leaf => {
            if (leaf.z === tile.z + SUBTREE_DEPTH) {
                const subtreeAvailable = leaf.children !== undefined;
                if (subtreeAvailable) {
                    rSubtreeTraverse(leaf);
                }
            }
        });
    }

    rSubtreeTraverse(dataTree.root);

    console.log('subtree files written', subtreeFilesWritten);

}

function writeSubtree(tile, outPath) {
    const buff = encodeSubtree(tile, SUBTREE_DEPTH);
    writeFileSync(outPath, buff, err => {
        if (err) console.error(err);
    });
}

function writeTile({x, y, z}, cityPoints, outPath) {
    // const cityPoints = [];
    // const tile = dataTree.collectPointsForTile({x, y, z}, cityPoints);

    const tbb = num2box(x, y, z);
    const rectangle = new Rectangle(tbb.minx, tbb.miny, tbb.maxx, tbb.maxy);
    const cartoPositions = cityPoints.map(p => Cartographic.fromDegrees(p.lon, p.lat, p.ele));
    const titles = cityPoints.map(p => p.name);
    const sizes = cityPoints.map(p => p.ppl);

    const buff = encodeTile(rectangle, cartoPositions, titles, sizes);

    writeFileSync(outPath, buff, err => {
        if (err) console.error(err);
    });
}

