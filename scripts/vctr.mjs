// import { Buffer } from 'node:buffer';
import fs from 'fs';
// const fs = require('fs');


const pth = process.argv[1].split('/').filter(p => p != '');
pth.pop();
pth.pop();
pth.push('data');

class CesiumMath {
    static toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
}

class Rectangle {

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

class Cartographic {
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

function createVctrTile() {
    const version = 1;
    const maxHeight = 100.0;
    const minHeight = 0.0;

    const rectangle = Rectangle.fromDegrees(-1.0, -1.0, 1.0, 1.0);

    const cartoPositions = [
        Cartographic.fromDegrees(0.0, 0.0, 90.0),
        Cartographic.fromDegrees(0.5, 0.0, 90.0),
        Cartographic.fromDegrees(-0.5, 0.0, 90.0),
        Cartographic.fromDegrees(0.0, 0.5, 90.0),
        Cartographic.fromDegrees(0.0, -0.5, 90.0),
    ];

    const positions = encodePositions(
        rectangle,
        minHeight,
        maxHeight,
        cartoPositions,
    );

    const binfile = '/' + [...pth, 'points.vctr'].join('/');
    console.log('outFile:', binfile);

    const featureTableHdr = {
        REGION: [rectangle.west, rectangle.south, rectangle.east, rectangle.north, minHeight, maxHeight],
        POINTS_LENGTH: cartoPositions.length,
    };

    const featureTableHdrJSON = JSON.stringify(featureTableHdr);
    const featureTableJSONPad = featureTableHdrJSON + ' '.repeat(4 - featureTableHdrJSON.length % 4);

    const batchTableHdr = {
        title: ["Name A", "Name B", "Name C", "Name D", "Name E" ]
    }
    const batchTableHdrJSON = JSON.stringify(batchTableHdr);
    const batchTableHdrPad = batchTableHdrJSON + ' '.repeat(4 - batchTableHdrJSON.length % 4);

    // The length of the entire tile, including the header, in bytes.
    const byteLength = 44 + positions.byteLength + featureTableJSONPad.length; 
    // The length of the feature table JSON section in bytes.
    const featureTableJSONByteLength = featureTableJSONPad.length;
    // The length of the feature table binary section in bytes. If featureTableJSONByteLength is zero, this will also be zero.
    const featureTableBinaryByteLength = 0;
    // The length of the batch table JSON section in bytes. Zero indicates that there is no batch table.
    const batchTableJSONByteLength = batchTableHdrPad.length;
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

    const outStream = fs.createWriteStream(binfile);
    outStream.write(hdrBuff);

    outStream.write(featureTableJSONPad);
    outStream.write(batchTableHdrPad);

    outStream.write(new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength));

    outStream.end()

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
};

createVctrTile();