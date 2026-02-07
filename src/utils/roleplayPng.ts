import { atob } from 'react-native-quick-base64';

export const getPngChunkText = (filedata: string) => {
    const binaryString = atob(filedata);
    const bytes = Uint8Array.from(binaryString, (a) => a.charCodeAt(0));
    const chunk = extractChunks(bytes);
    let rawText = '';
    if (chunk.type === 'tEXt') {
        const textBytes = decodePNG(chunk.data).text;
        rawText = utf8Decode(textBytes);
    } else if (chunk.type === 'iTXt') {
        rawText = decodeITXt(chunk.data);
    } else if (chunk.type === 'zTXt') {
        throw new Error('Compressed zTXt not supported');
    } else {
        throw new Error('Unsupported PNG text chunk');
    }

    // Some cards store base64-encoded JSON, others store plain JSON.
    try {
        const raw = atob(rawText);
        return JSON.parse(utf8Decode(Uint8Array.from(raw, (a) => a.charCodeAt(0))));
    } catch {
        return JSON.parse(rawText);
    }
};

function extractChunks(data: Uint8Array): { type: 'tEXt' | 'iTXt' | 'zTXt'; data: Uint8Array } {
    if (data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4e || data[3] !== 0x47) {
        throw new Error('Invalid .png file header');
    }
    if (data[4] !== 0x0d || data[5] !== 0x0a || data[6] !== 0x1a || data[7] !== 0x0a) {
        throw new Error('Invalid .png file header');
    }

    let idx = 8;
    let firstiter = true;
    const uint8 = new Uint8Array(4);
    const int32 = new Int32Array(uint8.buffer);
    const uint32 = new Uint32Array(uint8.buffer);

    while (idx < data.length) {
        uint8[3] = data[idx++];
        uint8[2] = data[idx++];
        uint8[1] = data[idx++];
        uint8[0] = data[idx++];

        const length = uint32[0] + 4;
        const chunk = new Uint8Array(length);

        chunk[0] = data[idx++];
        chunk[1] = data[idx++];
        chunk[2] = data[idx++];
        chunk[3] = data[idx++];

        const name =
            String.fromCharCode(chunk[0]) +
            String.fromCharCode(chunk[1]) +
            String.fromCharCode(chunk[2]) +
            String.fromCharCode(chunk[3]);

        if (firstiter && name !== 'IHDR') {
            throw new Error('IHDR header missing');
        } else {
            firstiter = false;
        }

        if (name !== 'tEXt' && name !== 'iTXt' && name !== 'zTXt') {
            idx += length;
            continue;
        }

        for (let i = 4; i < length; i++) {
            chunk[i] = data[idx++];
        }

        uint8[3] = data[idx++];
        uint8[2] = data[idx++];
        uint8[1] = data[idx++];
        uint8[0] = data[idx++];

        const crcActual = int32[0];
        const crcExpect = crc32_buf(chunk);
        if (crcExpect !== crcActual) {
            throw new Error('CRC values for ' + name + ' header do not match');
        }
        return { type: name as 'tEXt' | 'iTXt' | 'zTXt', data: new Uint8Array(chunk.buffer.slice(4)) };
    }

    throw new Error('No tEXt chunk found');
}

function decodePNG(data: Uint8Array) {
    const index = data.indexOf(0);
    const name = data.slice(0, index);
    const textUint8Array = data.slice(index + 1);
    return {
        keyword: name,
        text: textUint8Array,
    };
}

function decodeITXt(data: Uint8Array) {
    let offset = 0;
    const keywordEnd = data.indexOf(0, offset);
    if (keywordEnd === -1) return '';
    offset = keywordEnd + 1;
    const compressionFlag = data[offset++];
    offset++; // compression method
    const languageEnd = data.indexOf(0, offset);
    if (languageEnd === -1) return '';
    offset = languageEnd + 1;
    const translatedEnd = data.indexOf(0, offset);
    if (translatedEnd === -1) return '';
    offset = translatedEnd + 1;
    if (compressionFlag === 1) {
        throw new Error('Compressed iTXt not supported');
    }
    return utf8Decode(data.slice(offset));
}

function utf8Decode(bytes: Uint8Array) {
    return new TextDecoder().decode(bytes);
}

function signed_crc_table() {
    let c = 0;
    const table = new Array(256);
    for (let n = 0; n !== 256; ++n) {
        c = n;
        c = c & 1 ? -306674912 ^ (c >>> 1) : c >>> 1;
        c = c & 1 ? -306674912 ^ (c >>> 1) : c >>> 1;
        c = c & 1 ? -306674912 ^ (c >>> 1) : c >>> 1;
        c = c & 1 ? -306674912 ^ (c >>> 1) : c >>> 1;
        c = c & 1 ? -306674912 ^ (c >>> 1) : c >>> 1;
        c = c & 1 ? -306674912 ^ (c >>> 1) : c >>> 1;
        c = c & 1 ? -306674912 ^ (c >>> 1) : c >>> 1;
        c = c & 1 ? -306674912 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return new Int32Array(table);
}

const T0 = signed_crc_table();

function slice_by_16_tables(T: Int32Array) {
    let c = 0;
    let v = 0;
    let n = 0;
    const table = new Int32Array(4096);

    for (n = 0; n !== 256; ++n) table[n] = T[n];
    for (n = 0; n !== 256; ++n) {
        v = T[n];
        table[n + 256] = (v >>> 8) ^ T[v & 0xff];
        table[n + 512] = (table[n + 256] >>> 8) ^ T[table[n + 256] & 0xff];
        table[n + 768] = (table[n + 512] >>> 8) ^ T[table[n + 512] & 0xff];
        table[n + 1024] = (table[n + 768] >>> 8) ^ T[table[n + 768] & 0xff];
        table[n + 1280] = (table[n + 1024] >>> 8) ^ T[table[n + 1024] & 0xff];
        table[n + 1536] = (table[n + 1280] >>> 8) ^ T[table[n + 1280] & 0xff];
        table[n + 1792] = (table[n + 1536] >>> 8) ^ T[table[n + 1536] & 0xff];
        table[n + 2048] = (table[n + 1792] >>> 8) ^ T[table[n + 1792] & 0xff];
        table[n + 2304] = (table[n + 2048] >>> 8) ^ T[table[n + 2048] & 0xff];
        table[n + 2560] = (table[n + 2304] >>> 8) ^ T[table[n + 2304] & 0xff];
        table[n + 2816] = (table[n + 2560] >>> 8) ^ T[table[n + 2560] & 0xff];
        table[n + 3072] = (table[n + 2816] >>> 8) ^ T[table[n + 2816] & 0xff];
        table[n + 3328] = (table[n + 3072] >>> 8) ^ T[table[n + 3072] & 0xff];
        table[n + 3584] = (table[n + 3328] >>> 8) ^ T[table[n + 3328] & 0xff];
        table[n + 3840] = (table[n + 3584] >>> 8) ^ T[table[n + 3584] & 0xff];
    }
    return table;
}

const T16 = slice_by_16_tables(T0);

function crc32_buf(buf: Uint8Array) {
    let crc = -1;
    let i = 0;
    const len = buf.length - 15;

    for (; i < len; i += 16) {
        crc =
            T16[(crc ^ buf[i]) & 0xff] ^
            T16[256 + ((crc >>> 8) ^ buf[i + 1]) & 0xff] ^
            T16[512 + ((crc >>> 16) ^ buf[i + 2]) & 0xff] ^
            T16[768 + ((crc >>> 24) ^ buf[i + 3]) & 0xff] ^
            T16[1024 + (buf[i + 4] & 0xff)] ^
            T16[1280 + (buf[i + 5] & 0xff)] ^
            T16[1536 + (buf[i + 6] & 0xff)] ^
            T16[1792 + (buf[i + 7] & 0xff)] ^
            T16[2048 + (buf[i + 8] & 0xff)] ^
            T16[2304 + (buf[i + 9] & 0xff)] ^
            T16[2560 + (buf[i + 10] & 0xff)] ^
            T16[2816 + (buf[i + 11] & 0xff)] ^
            T16[3072 + (buf[i + 12] & 0xff)] ^
            T16[3328 + (buf[i + 13] & 0xff)] ^
            T16[3584 + (buf[i + 14] & 0xff)] ^
            T16[3840 + (buf[i + 15] & 0xff)];
    }

    for (; i < buf.length; i++) {
        crc = (crc >>> 8) ^ T0[(crc ^ buf[i]) & 0xff];
    }

    return crc ^ -1;
}
