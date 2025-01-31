import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { getCitySize, getDataPath, readData, scoreF } from "./data.mjs";
import { num2box, QTree, traverseZMortonOrder } from './qtree.mjs';
import { Cartographic, encodeTile, Rectangle } from './encodeTile.mjs';
import { encodeSubtree } from './encodeSubtree.mjs';

const SUBTREE_DEPTH = 3;

export async function exportTiles(options) {
    const dataPath = options.data || getDataPath('cities500.txt');
    console.log('read data', dataPath);

    // Right now this works for refine: ADD
    const dataTree = new QTree({scoreF, minDepth: 1});
    await readData(dataPath, (n, cls) => {
        if (cls === 'P') {
            const size = getCitySize(n);
            if (size >= 9) {
                dataTree.insert(n);
            }
            else if (size >= 8) {
                dataTree.insert(n, 6);
            }
            else if (size >= 6) {
                dataTree.insert(n, 12);
            }
            else if (size >= 4) {
                dataTree.insert(n, 16);
            }
            else if (size >= 3) {
                dataTree.insert(n, 18);
            }
            // Discard small places
        }
    });

    const contentOutPath = getDataPath('content');
    if (!existsSync(contentOutPath)){
        mkdirSync(contentOutPath, { recursive: true });
    }

    var filesWritten = 0;
    var maxLevel = 0;
    const visitor = (leaf, points) => {
        const {x, y, z} = leaf;
        const tbb = num2box(x, y, z);
        const tilePoints = points?.filter(p => tbb.contains(p.lon, p.lat));
        if (tilePoints?.length > 0) {
            maxLevel = z > maxLevel ? z : maxLevel;
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
    console.log('levels available', maxLevel);

    const subtreesOutPath = getDataPath('subtrees');
    if (!existsSync(subtreesOutPath)){
        mkdirSync(subtreesOutPath, { recursive: true });
    }

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

    const titles = cityPoints.map(p => p.name).filter(name => name !== undefined);
    const sizes = cityPoints.map(p => p.size).filter(size => size !== undefined);

    if (titles.length !== sizes.length || sizes.length !== cityPoints.length) {
        console.log('Wrong length');
    }

    const buff = encodeTile(rectangle, cartoPositions, titles, sizes);

    writeFileSync(outPath, buff, err => {
        if (err) console.error(err);
    });
}

