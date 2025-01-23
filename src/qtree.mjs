
export function test() {
    // NYC 12 40.7089 -73.9122

    const nycPoint = {lat: 40.7089, lon: -73.9122, score: 0};
    console.log(nycPoint);

    console.log(num2box(2048, 2048, 12));
    console.log(num2box(2047, 2047, 12));

    for (let i = 0; i <= 12; i++) {
        const xy = deg2num(nycPoint, i);
        const box = num2box(xy.xtile, xy.ytile, i);

        console.log(i, xy, box);
    }

    const tree = new QTree({minDepth: 12});
    tree.insert(nycPoint);

    const target = tree.traverseToTile({x: 1207, y: 2974, z: 12}, t => {
        console.log('traverse via', t);
    });

    console.log(target);
}

export class QTree {

    constructor(_options) {
        const options = _options || {};

        this.threshold = options.pointsPerNode || 10;
        this.scoreF = options.scoreF || ((p) => p.score);
        this.minDepth = options.minDepth;

        this.root = new Leaf({x: 0, y: 0, z: 0}, [], this.threshold, this.minDepth);
    }

    insert(point) {
        if (typeof this.scoreF !== 'function') {
            throw Error('scoreF is not a function');
        }

        if (Math.abs(point.lat) > 90.0 || Math.abs(point.lon) > 180.0) {
            throw Error('Point coordinates are out of bounds');
        }

        this.root.insert(point, this.scoreF);
    }
    
    traverseDFS(visitor) {
        const itraverse = (node) => {
            for (chld of node.children) {
                itraverse(chld);
                visitor(node);
            }
        }

        itraverse(self.root);
    }

    traverseBFS(visitor) {
        const stack = [this.root];

        const rTraverse = () => {
            while (stack.length > 0) {
                const leaf = stack.shift();

                if (visitor(leaf) === false) {
                    break;
                }
                
                stack.push(...leaf.children);
            }
        };
        
        return rTraverse();
    }
    
    traverseByBox(box, visitor) {
        const stack = [self.root];

        const rTraverse = () => {
            const leaf = stack.pop(0);

            for (p of leaf.points) {
                const lon = p.lat;
                const lat = p.lon;

                if (box.contains(lon, lat)) {
                    if (visitor(p, leaf)) {
                        return;
                    }
                }
            }

            leaf.children.forEach(c => {
                if (c.bbox.intersects(box)) {
                    stack.push(c)
                }
            });
            
            if (stack.length > 0) {
                rTraverse();
            }
        }
        
        rTraverse();
    }
    

    traverseToTile(targetXYZ, visitor) {
        const {x, y, z} = targetXYZ;
        const {lat: lat1, lon: lon1} = num2deg(x, y, z);
        const {lat: lat2, lon: lon2} = num2deg(x + 1, y + 1, z);

        const lat = (lat1 + lat2) / 2.0;
        const lon = (lon1 + lon2) / 2.0;

        
        var tile = this.root;
        while (tile && tile.z <= z) {

            visitor && visitor(tile);

            if (tile.z === z) {
                break;
            }

            const { xtile, ytile } = deg2num({lat, lon}, tile.z + 1);
            tile = tile.getChild(xtile, ytile);
        }

        return tile;
    }

    collectPointsForTile(xyz, points) {
        const {x, y, z} = xyz;
        
        const collector = (node) => node.points.forEach(p => {
            const {xtile, ytile} = deg2num(p, z);
            if (xtile === x && ytile === y) {
                points.push(p);
            }
        });

        return this.traverseToTile({x, y, z}, collector);
    }
    
    getBoxPoints(box, maxPoints) {
        const points = []
        const d = (box.maxx - box.minx) * 0.2;

        const collector = (point, node) => {
            let cluster = false
            const lon1 = point.lon;
            const lat1 = point.lat;
            for (p of points) {
                const lon2 = p.lon; 
                const lat2 = p.lat;
                if (distanceDegree(lon1, lat1, lon2, lat2) < d) {
                    cluster = true
                    break
                }
            }
            
            if (!cluster) {
                points.push(point);
            }

            if (maxPoints !== undefined && points.length >= maxPoints) {
                return true
            }
        }

        this.traverseByBox(box, collector);
        return points;
    }
}

class Leaf {

    constructor(xyz, points, threshold, minDepth) {
        this.x = xyz.x;
        this.y = xyz.y;
        this.z = xyz.z;

        this.bbox = num2box(this.x, this.y, this.z);

        this.minDepth = minDepth;
        this.threshold = threshold || 10;

        this.points = points;
        this.children = [];
    }

    insert(point, scoreF) {
        if (this.z >= this.minDepth) {
            this.addSorted(point, scoreF);
            while (this.points.length > this.threshold) {
                this.insertChild(this.points.pop(), scoreF);
            }
        }
        else {
            this.insertChild(point, scoreF);
        }
    }
    
    insertChild(point, scoreF) {
        const {xtile, ytile} = deg2num(point, this.z + 1);
        
        this.getOrCreateChild(xtile, ytile).insert(point, scoreF);
    }

    getOrCreateChild(x, y) {
        const chld = this.getChild(x, y);
        if (chld) {
            return chld;
        }

        const leaf = new Leaf({x, y, z: this.z + 1}, 
            [], this.threshold, this.minDepth);

        this.children.push(leaf);
        return leaf;
    }

    getChild(x, y) {
        return this.children.find(c => c.x === x && c.y === y);
    }

    addSorted(point, scoreF) {
        const inScore = scoreF(point);

        const inx = this.points.findIndex(pnt => inScore > scoreF(pnt));
        if (inx >= 0) {
            this.points.splice(inx, 0, point);
        }
        else {
            this.points.push(point);
        }
    }
}

export class Box {

    constructor(minx, miny, maxx, maxy) {
        this.minx = minx;
        this.miny = miny;
        this.maxx = maxx;
        this.maxy = maxy;
    }
    
    contains(x, y) {
        const xin = x >= this.minx && x <= this.maxx;
        const yin = y >= this.miny && y <= this.maxy;
        return xin && yin;
    }

    intersects(box) {
        const e = 0.0000001

        return !(
            this.maxx < box.minx - e ||
            this.maxy < box.miny - e ||
            this.minx - e > box.maxx ||
            this.miny - e > box.maxy
        )
    }
}

export function getChildrenTileNumbersMortonOrder(tile) {
    const {x, y, z} = tile;
    return [
        {z: z + 1, x: x * 2,     y: y * 2    },
        {z: z + 1, x: x * 2 + 1, y: y * 2    },
        {z: z + 1, x: x * 2,     y: y * 2 + 1},
        {z: z + 1, x: x * 2 + 1, y: y * 2 + 1},
    ]
}

export function traverseZMortonOrder(tile, depth, visitor) {
    const stack = [tile];
    const targetDepth = tile.z + depth - 1;

    while (stack.length > 0) {
        const leaf = stack.shift();
        visitor(leaf);

        if (leaf.z >= targetDepth) {
            continue;
        }

        const children = getChildrenTileNumbersMortonOrder(leaf).map(n => {
            return leaf.children?.find(c => c.x === n.x && c.y === n.y) || n;
        });

        stack.push(...children);
    }
}

export function num2box(x, y, zoom) {
    const {lat: south, lon: west} = num2deg(x, y, zoom);
    const n = Math.pow(2, zoom);

    const wdth = 360.0 / n;
    const hgth = 180.0 / n;

    return new Box(west, south, west + wdth, south + hgth);
}

function num2deg(xtile, ytile, zoom) {
    const n = Math.pow(2, zoom);

    const wdth = 360.0 / n;
    const hgth = 180.0 / n;

    const lon_deg = xtile * wdth - 180.0;
    const lat_deg = ytile * hgth - 90.0;
    
    return {lat: lat_deg, lon: lon_deg}
}

function deg2num({lat: lat_deg, lon: lon_deg}, zoom) {
    const n = Math.pow(2, zoom);

    const xtile = Math.floor((lon_deg + 180.0) / (360.0 / n));
    const ytile = Math.floor((lat_deg + 90.0 ) / (180.0 / n));

    return { xtile, ytile };
}

function distanceDegree(lon1, lat1, lon2, lat2) {
    const dx = lon1 - lon2;
    const dy = lat1 - lat2;

    return Math.sqrt(dx * dx + dy * dy);
}

function todeg(angle) {
    return angle * (180.0 / Math.PI);
}

function torad(deg) {
    return deg * (Math.PI / 180.0);
}