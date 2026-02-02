/**
 * Binary Search Index Encoder/Decoder
 * 
 * Binary format (gzip compressed):
 * - Header: magic (4 bytes) + version (4 bytes) + timestamp (8 bytes)
 * - String Table: count + [length + UTF-8 bytes for each string]
 * - File IDs: count + [string table indices]
 * - Documents: count + [para count + para string indices for each doc]
 * - Tokens: count + [token string idx + refs count + refs for each token]
 */

import pako from "pako";

const MAGIC = 0x53495831; // 'SIX1' in hex

// VarInt encoding - smaller numbers use fewer bytes
function writeVarInt(value, buffer, offset) {
    let written = 0;
    while (value > 0x7f) {
        buffer[offset + written] = (value & 0x7f) | 0x80;
        value >>>= 7;
        written++;
    }
    buffer[offset + written] = value;
    return written + 1;
}

function readVarInt(buffer, offset) {
    let value = 0;
    let shift = 0;
    let byte;
    let bytesRead = 0;
    do {
        byte = buffer[offset + bytesRead];
        value |= (byte & 0x7f) << shift;
        shift += 7;
        bytesRead++;
    } while (byte & 0x80);
    return { value, bytesRead };
}

// Calculate VarInt size without writing
function varIntSize(value) {
    let size = 1;
    while (value > 0x7f) {
        value >>>= 7;
        size++;
    }
    return size;
}

// Signed VarInt (for negative file indices in token refs)
function writeSignedVarInt(value, buffer, offset) {
    // ZigZag encoding: (n << 1) ^ (n >> 31)
    const encoded = (value << 1) ^ (value >> 31);
    return writeVarInt(encoded >>> 0, buffer, offset);
}

function readSignedVarInt(buffer, offset) {
    const { value, bytesRead } = readVarInt(buffer, offset);
    // ZigZag decode: (n >>> 1) ^ -(n & 1)
    const decoded = (value >>> 1) ^ -(value & 1);
    return { value: decoded, bytesRead };
}

function signedVarIntSize(value) {
    const encoded = (value << 1) ^ (value >> 31);
    return varIntSize(encoded >>> 0);
}

/**
 * Encode search index to binary format
 */
export function encodeBinaryIndex(indexData) {
    // Build string table from all strings
    const stringMap = new Map();
    const strings = [];

    const addString = (str) => {
        if (!stringMap.has(str)) {
            stringMap.set(str, strings.length);
            strings.push(str);
        }
        return stringMap.get(str);
    };

    // Add file IDs
    const fileIdIndices = indexData.f.map(id => addString(id));

    // Add paragraphs and compute document structure
    const docStructure = [];
    const fileIndices = Object.keys(indexData.d).map(k => parseInt(k, 10)).sort((a, b) => a - b);
    for (const fileIdx of fileIndices) {
        const paragraphs = indexData.d[fileIdx];
        const paraIndices = paragraphs.map(p => addString(p));
        docStructure.push({ fileIdx, paraIndices });
    }

    // Add token strings
    const tokenEntries = Object.entries(indexData.t);
    const tokenData = tokenEntries.map(([token, refs]) => ({
        tokenIdx: addString(token),
        refs
    }));

    // Calculate buffer size
    let size = 16; // header: magic (4) + version (4) + timestamp (8)

    // String table size
    size += varIntSize(strings.length);
    const encoder = new TextEncoder();
    const encodedStrings = strings.map(s => encoder.encode(s));
    for (const encoded of encodedStrings) {
        size += varIntSize(encoded.length) + encoded.length;
    }

    // File IDs size
    size += varIntSize(fileIdIndices.length);
    for (const idx of fileIdIndices) {
        size += varIntSize(idx);
    }

    // Documents size
    size += varIntSize(docStructure.length);
    for (const doc of docStructure) {
        size += varIntSize(doc.fileIdx);
        size += varIntSize(doc.paraIndices.length);
        for (const paraIdx of doc.paraIndices) {
            size += varIntSize(paraIdx);
        }
    }

    // Tokens size
    size += varIntSize(tokenData.length);
    for (const { tokenIdx, refs } of tokenData) {
        size += varIntSize(tokenIdx);
        size += varIntSize(refs.length);
        for (const ref of refs) {
            size += signedVarIntSize(ref);
        }
    }

    // Allocate buffer
    const buffer = new Uint8Array(size);
    const view = new DataView(buffer.buffer);
    let offset = 0;

    // Write header
    view.setUint32(offset, MAGIC, false);
    offset += 4;
    view.setUint32(offset, indexData.v || 4, false);
    offset += 4;
    // Write timestamp as two 32-bit values (high and low)
    const timestamp = indexData.timestamp || Date.now();
    view.setUint32(offset, Math.floor(timestamp / 0x100000000), false);
    offset += 4;
    view.setUint32(offset, timestamp >>> 0, false);
    offset += 4;

    // Write string table
    offset += writeVarInt(strings.length, buffer, offset);
    for (const encoded of encodedStrings) {
        offset += writeVarInt(encoded.length, buffer, offset);
        buffer.set(encoded, offset);
        offset += encoded.length;
    }

    // Write file IDs
    offset += writeVarInt(fileIdIndices.length, buffer, offset);
    for (const idx of fileIdIndices) {
        offset += writeVarInt(idx, buffer, offset);
    }

    // Write documents
    offset += writeVarInt(docStructure.length, buffer, offset);
    for (const doc of docStructure) {
        offset += writeVarInt(doc.fileIdx, buffer, offset);
        offset += writeVarInt(doc.paraIndices.length, buffer, offset);
        for (const paraIdx of doc.paraIndices) {
            offset += writeVarInt(paraIdx, buffer, offset);
        }
    }

    // Write tokens
    offset += writeVarInt(tokenData.length, buffer, offset);
    for (const { tokenIdx, refs } of tokenData) {
        offset += writeVarInt(tokenIdx, buffer, offset);
        offset += writeVarInt(refs.length, buffer, offset);
        for (const ref of refs) {
            offset += writeSignedVarInt(ref, buffer, offset);
        }
    }

    // Compress with gzip
    return pako.gzip(buffer);
}

/**
 * Decode binary format to search index object
 */
export function decodeBinaryIndex(compressedData) {
    // Handle Uint8Array or ArrayBuffer
    const inputData = compressedData instanceof ArrayBuffer
        ? new Uint8Array(compressedData)
        : compressedData;

    // Decompress
    const buffer = pako.ungzip(inputData);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let offset = 0;

    // Read header
    const magic = view.getUint32(offset, false);
    offset += 4;
    if (magic !== MAGIC) {
        throw new Error("Invalid search index binary format");
    }

    const version = view.getUint32(offset, false);
    offset += 4;

    const timestampHigh = view.getUint32(offset, false);
    offset += 4;
    const timestampLow = view.getUint32(offset, false);
    offset += 4;
    const timestamp = timestampHigh * 0x100000000 + timestampLow;

    // Read string table
    let result = readVarInt(buffer, offset);
    const stringCount = result.value;
    offset += result.bytesRead;

    const decoder = new TextDecoder();
    const strings = [];
    for (let i = 0; i < stringCount; i++) {
        result = readVarInt(buffer, offset);
        const len = result.value;
        offset += result.bytesRead;
        const strBytes = buffer.slice(offset, offset + len);
        strings.push(decoder.decode(strBytes));
        offset += len;
    }

    // Read file IDs
    result = readVarInt(buffer, offset);
    const fileIdCount = result.value;
    offset += result.bytesRead;

    const f = [];
    for (let i = 0; i < fileIdCount; i++) {
        result = readVarInt(buffer, offset);
        f.push(strings[result.value]);
        offset += result.bytesRead;
    }

    // Read documents
    result = readVarInt(buffer, offset);
    const docCount = result.value;
    offset += result.bytesRead;

    const d = {};
    for (let i = 0; i < docCount; i++) {
        result = readVarInt(buffer, offset);
        const fileIdx = result.value;
        offset += result.bytesRead;

        result = readVarInt(buffer, offset);
        const paraCount = result.value;
        offset += result.bytesRead;

        const paragraphs = [];
        for (let j = 0; j < paraCount; j++) {
            result = readVarInt(buffer, offset);
            paragraphs.push(strings[result.value]);
            offset += result.bytesRead;
        }
        d[fileIdx] = paragraphs;
    }

    // Read tokens
    result = readVarInt(buffer, offset);
    const tokenCount = result.value;
    offset += result.bytesRead;

    const t = {};
    for (let i = 0; i < tokenCount; i++) {
        result = readVarInt(buffer, offset);
        const token = strings[result.value];
        offset += result.bytesRead;

        result = readVarInt(buffer, offset);
        const refsCount = result.value;
        offset += result.bytesRead;

        const refs = [];
        for (let j = 0; j < refsCount; j++) {
            result = readSignedVarInt(buffer, offset);
            refs.push(result.value);
            offset += result.bytesRead;
        }
        t[token] = refs;
    }

    return { v: version, timestamp, f, d, t };
}
