import {lenb, padStr, BufferWrtitableStream} from "./binutil.mjs"


class CesiumMath {
    static toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
}

export class Rectangle {

    west
    south
    east 
    north

    width
    height

    constructor(west, south, east, north) {
        this.west = CesiumMath.toRadians(west);
        this.south = CesiumMath.toRadians(south);
        this.east = CesiumMath.toRadians(east);
        this.north = CesiumMath.toRadians(north);

        this.width = (this.east - this.west);
        this.height = (this.north - this.south);
    }

    static fromDegrees(minLat, minLon, maxLat, maxLon) {
        return new Rectangle(minLat, minLon, maxLat, maxLon)
    }
}

export class Cartographic {
    longitude
    latitude
    height

    constructor(longitude, latitude, height) {
        this.longitude = longitude;
        this.latitude = latitude;
        this.height = height;
    }

    static fromDegrees(longitude, latitude, height) {
        longitude = CesiumMath.toRadians(longitude);
        latitude = CesiumMath.toRadians(latitude);
        return new Cartographic(longitude, latitude, height);
    }
}

// https://github.com/CesiumGS/3d-tiles/tree/vctr/TileFormats/VectorData

export function encodeTile(rectangle, cartoPositions, titles, sizes) {
    const version = 1;
    const maxHeight = 10000.0;
    const minHeight = 0.0;

    const positions = encodePositions(
        rectangle,
        minHeight,
        maxHeight,
        cartoPositions,
    );

    const featureTableHdr = {
        REGION: [rectangle.west, rectangle.south, rectangle.east, rectangle.north, minHeight, maxHeight],
        POINTS_LENGTH: cartoPositions.length,
    };

    const featureTableHdrJSON = JSON.stringify(featureTableHdr);
    const featureTableJSONPad = padStr(featureTableHdrJSON);

    // https://github.com/CesiumGS/3d-tiles/blob/vctr/TileFormats/BatchTable/README.md
    const batchTableHdr = {
        title: titles,
    };
    if (sizes) {
        batchTableHdr['size'] = sizes;
    }
    const batchTableHdrJSON = JSON.stringify(batchTableHdr);
    const batchTableHdrPad = padStr(batchTableHdrJSON);

    // The length of the entire tile, including the header, in bytes.
    const byteLength = 44 + positions.byteLength + lenb(featureTableJSONPad) + lenb(batchTableHdrPad); 
    // The length of the feature table JSON section in bytes.
    const featureTableJSONByteLength = lenb(featureTableJSONPad);
    // The length of the feature table binary section in bytes. If featureTableJSONByteLength is zero, this will also be zero.
    const featureTableBinaryByteLength = 0;
    // The length of the batch table JSON section in bytes. Zero indicates that there is no batch table.
    const batchTableJSONByteLength = lenb(batchTableHdrPad);
    // The length of the batch table binary section in bytes. If batchTableJSONByteLength is zero, this will also be zero.
    const batchTableBinaryByteLength = 0;
    //The length of the polygon indices buffer in bytes.
    const polygonIndicesByteLength = 0;
    // The length of the polygon positions buffer in bytes.
    const polygonPositionsByteLength = 0;
    // The length of the polyline positions buffer in bytes.
    const polylinePositionsByteLength = 0;
    // The length of the point positions buffer in bytes.
    const pointPositionsByteLength = positions.byteLength;

    const hdrBuff = Buffer.alloc(44);
    
    hdrBuff.write('vctr', 0); //magic
    hdrBuff.writeUInt32LE(version, 4);
    hdrBuff.writeUInt32LE(byteLength, 8);
    hdrBuff.writeUInt32LE(featureTableJSONByteLength, 12);
    hdrBuff.writeUInt32LE(featureTableBinaryByteLength, 16);
    hdrBuff.writeUInt32LE(batchTableJSONByteLength, 20);
    hdrBuff.writeUInt32LE(batchTableBinaryByteLength, 24);
    hdrBuff.writeUInt32LE(polygonIndicesByteLength, 28);
    hdrBuff.writeUInt32LE(polygonPositionsByteLength, 32);
    hdrBuff.writeUInt32LE(polylinePositionsByteLength, 36);
    hdrBuff.writeUInt32LE(pointPositionsByteLength, 40);

    const tileBuff = Buffer.alloc(byteLength);
    const out = new BufferWrtitableStream(tileBuff);

    out.write(hdrBuff);

    out.write(featureTableJSONPad);
    out.write(batchTableHdrPad);

    out.write(new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength));

    return tileBuff;
}

function encodePositions(
    rectangle,
    minimumHeight,
    maximumHeight,
    positions,
) {
    const maxShort = 32767;

    const length = positions.length;
    const buffer = new Uint16Array(length * 3);

    let lastU = 0;
    let lastV = 0;
    let lastH = 0;

    for (let i = 0; i < length; ++i) {
        const position = positions[i];

        let u = (position.longitude - rectangle.west) / rectangle.width;
        let v = (position.latitude - rectangle.south) / rectangle.height;
        let h =
            (position.height - minimumHeight) / (maximumHeight - minimumHeight);

        u = clamp(u, 0.0, 1.0);
        v = clamp(v, 0.0, 1.0);
        h = clamp(h, 0.0, 1.0);

        u = Math.floor(u * maxShort);
        v = Math.floor(v * maxShort);
        h = Math.floor(h * maxShort);

        buffer[i] = zigZag(u - lastU);
        buffer[i + length] = zigZag(v - lastV);
        buffer[i + length * 2] = zigZag(h - lastH);

        lastU = u;
        lastV = v;
        lastH = h;
    }

    return buffer;
}

function zigZag(value) {
    return ((value << 1) ^ (value >> 15)) & 0xffff;
}

function clamp(value, min3, max3) {
    return value < min3 ? min3 : value > max3 ? max3 : value;
}

