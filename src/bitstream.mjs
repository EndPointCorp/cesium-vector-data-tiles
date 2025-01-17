
// https://github.com/CesiumGS/cesium/blob/dc667cd6decdaf14079038bc32773f421e585724/packages/engine/Source/Scene/ImplicitAvailabilityBitstream.js

export default class BitStream {

    /**
     * 
     * @param {Uint8Array} bitstream 
     * @param {int} index 
     * @returns 0 or 1
     */
    static readBit(bitstream, index) {
        // byteIndex is floor(index / 8)
        const byteIndex = index >> 3;
        const bitIndex = index % 8;
      
        return ((bitstream[byteIndex] >> bitIndex) & 1) === 1;
   }

    constructor() {
        this.index = 0;
        this.buffer = [];
    }

    push(...bits) {
        for (let bit of bits) {
            this.ensureCapacity();

            // byteIndex is floor(index / 8)
            const byteIndex = this.index >> 3;
            const bitIndex = this.index % 8;

            const bitMask = 1 << bitIndex;

            if (bit) {
                this.buffer[byteIndex] = (this.buffer[byteIndex] >>> 0) | bitMask;
            }
            else {
                this.buffer[byteIndex] = (this.buffer[byteIndex] >>> 0) & ~bitMask;
            }

            this.index++;
        }
    }

    ensureCapacity() {
        //   floor(index / 8)
        if ((this.index + 1) >> 3 > this.buffer.length) {
            this.buffer.push(0);
        }
    }

    asUint8Array() {
        if (this.buffer.some(b => b > 0xFF)) {
            throw new Error('uint8 array value out of bounds');
        }

        return Uint8Array.from(this.buffer);
    }
    
    asString() {
        var str = '';
        for (var i = 0; i < this.index; i++) {
            str += BitStream.readBit(this.buffer, i) ? '1' : '0';
        }
        return str;
    }
    
}

