import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { getCitySize, getDataPath, readData, scoreF } from "./data.mjs";
import { deg2num, num2box, QTree, traverseZMortonOrder } from './qtree.mjs';
import { Cartographic, encodeTile, Rectangle } from './encodeTile.mjs';
import { encodeSubtree } from './encodeSubtree.mjs';

const SUBTREE_DEPTH = 3;

// Distance between points at level 0
// 60 degrees is roughly the width of USA
const BASE_DISTANCE_TRESHOLD = 30.0;

const TARGET_DEPTH = 16;

function llDistance(a, b) {
    const dx = a.lon - b.lon;
    const dy = a.lat - b.lat;

    return Math.sqrt(dx * dx + dy * dy);
}

function findClosest(points, point) {
    let closest;
    let dist = Number.POSITIVE_INFINITY;

    for (const p of points) {
        const d = llDistance(p, point);
        if (d < dist) {
            closest = p;
            dist = d;
        }
    }

    return {closest, dist};
}

function distanceInserter(leaf, cityPoint, minDepth = 0) {

    const level = leaf.z;
    const forceInsert = leaf.z >= TARGET_DEPTH;

    if (level < minDepth && !forceInsert) {
        // We're not deep enough, skip distance calculations and go to child
        const {xtile, ytile} = deg2num(cityPoint, leaf.z + 1);
        distanceInserter(leaf.getOrCreateChild(xtile, ytile), cityPoint, minDepth);
        return;
    }

    const {closest, dist} = findClosest(leaf.points, cityPoint);

    const threshold = BASE_DISTANCE_TRESHOLD / (1 << level);

    if (dist > threshold || forceInsert) {
        leaf.addSorted(cityPoint);
        while (leaf.points.length > leaf.capacity) {
            const pop = leaf.points.pop();
            const {xtile, ytile} = deg2num(pop, leaf.z + 1);

            distanceInserter(leaf.getOrCreateChild(xtile, ytile), pop, minDepth);
        }
    }
    // There is a point close enough to the one we are inserting
    else if (closest) {
        
        // How many times should we divide threshold, so it becomes
        // smaller than distance
        let targetDepth = level + 1;
        while ((BASE_DISTANCE_TRESHOLD / (1 << targetDepth)) > dist && targetDepth <= 16) {
            targetDepth++;
        }

        if (scoreF(closest) > scoreF(cityPoint)) {
            const {xtile, ytile} = deg2num(cityPoint, leaf.z + 1);

            distanceInserter(leaf.getOrCreateChild(xtile, ytile), cityPoint, targetDepth);
        }
        else {
            // Point to insert is more important (bigger) than Point in a tree
            // replace it 
            const inx = leaf.points.indexOf(closest);
            console.assert(inx >= 0, "Can't find index of existing point");
         
            const pop = leaf.points[inx];
            leaf.points[inx] = cityPoint;

            const {xtile, ytile} = deg2num(pop, leaf.z + 1);

            distanceInserter(leaf.getOrCreateChild(xtile, ytile), pop, targetDepth);
        }
    }
}

export async function exportTiles(options) {
    const dataPath = options.data || getDataPath('cities500.txt');
    console.log('read data', dataPath);

    // Right now this works for refine: ADD
    const dataTree = new QTree({scoreF, minDepth: 1, pointsPerNode: 20});
    await readData(dataPath, (n, cls) => {
        if (cls === 'P') {
            distanceInserter(dataTree.root, n, 0);
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

