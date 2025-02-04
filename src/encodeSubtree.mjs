import BitStream from "./bitstream.mjs";
import { traverseZMortonOrder } from "./qtree.mjs";
import {lenb, padStr, BufferWrtitableStream} from "./binutil.mjs"

// see: https://github.com/CesiumGS/3d-tiles/blob/main/specification/ImplicitTiling/README.adoc

export function encodeSubtree(tile, depth) {

    let tileAvailableCount = 0;
    const tileAvailability = new BitStream();

    let contentAvailableCount = 0;
    const contentAvailability = new BitStream();

    let subtreeAvailableCount = 0;
    const subtreeAvailability = new BitStream();

    traverseZMortonOrder(tile, depth, leaf => {
        const tileAvalable = leaf.children !== undefined;
        const contentAvailable = tileAvalable && leaf.points?.length > 0;

        tileAvailability.push(tileAvalable);
        contentAvailability.push(contentAvailable);

        tileAvalable && tileAvailableCount++;
        contentAvailable && contentAvailableCount++;
    });

    traverseZMortonOrder(tile, depth + 1, leaf => {
        if (leaf.z === tile.z + depth) {
            const subtreeAvailable = leaf.children !== undefined;
            subtreeAvailability.push(subtreeAvailable);
            subtreeAvailable && subtreeAvailableCount++;
        }
    });

    const tileAvailabilityBB = tileAvailability.asUint8Array();
    const contentAvailabilityBB = contentAvailability.asUint8Array();
    const subtreeAvailabilityBB = subtreeAvailability.asUint8Array();

    const bufferViews = [];

    const bufByteLength = tileAvailabilityBB.byteLength + contentAvailabilityBB.byteLength + subtreeAvailabilityBB.byteLength;
    
    const dataBB = Buffer.alloc(bufByteLength);
    const dataStream = new BufferWrtitableStream(dataBB);

    let offset = 0;
    [tileAvailabilityBB, contentAvailabilityBB, subtreeAvailabilityBB].forEach(section => {
        bufferViews.push({
            buffer: 0,
            byteOffset: offset,
            byteLength: section.byteLength,
        });
        dataStream.write(section);

        offset += section.byteLength;
    });

    const data = {
        buffers: [{byteLength: bufByteLength}],
        bufferViews,
        tileAvailability: {"bitstream": 0, "availableCount": tileAvailableCount},
        contentAvailability: [{"bitstream": 1, "availableCount": contentAvailableCount}],
        childSubtreeAvailability: {"bitstream": 2, "availableCount": subtreeAvailableCount}
    }
    const dataJson = JSON.stringify(data);
    const dataJsonPad = padStr(dataJson, 8);

    const version = 1;

    const hdr = Buffer.alloc(24);
    
    hdr.write('subt', 0);
    hdr.writeUInt32LE(version, 4);
    hdr.writeUInt32LE(lenb(dataJsonPad), 8);
    hdr.writeUInt32LE(bufByteLength, 16);

    const subtreeBuf = Buffer.alloc(24 + lenb(dataJsonPad) + bufByteLength + (8 - bufByteLength % 8));

    const out = new BufferWrtitableStream(subtreeBuf);

    out.write(hdr);

    out.write(dataJsonPad);
    out.write(dataBB);

    return subtreeBuf;
    
}