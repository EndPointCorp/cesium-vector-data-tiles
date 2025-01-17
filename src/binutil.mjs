import { Writable } from "stream";

export function lenb(str) {
    return Buffer.byteLength(str, 'utf8');
}

export function padStr(str, pad) {
    const p = pad === undefined ? 4 : pad;
    return str + ' '.repeat(p - lenb(str) % p);
}

export class BufferWrtitableStream extends Writable {
    constructor(buffer) {
        super();
        this.size = 0;
        this.buffer = buffer;
    }

    _write(chunk, encoding, done) {
        chunk.copy(this.buffer, this.size, 0);
        this.size += chunk.length;
        done();
    }
}
