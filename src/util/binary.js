import storage from "@util/storage";
import { getImageMimeType } from "@util/path";
import { decode, encode } from "base64-arraybuffer-es6";

export async function binaryToString(blob) {
    const buffer = await blob.arrayBuffer();
    const body = encode(buffer);
    return body;
}

export function stringToBinary(string, type) {
    const buffer = decode(string);
    const blob = new Blob([new Uint8Array(buffer)], { type });
    return blob;
}

export async function readBinary(path) {
    const buffer = await storage.readFile(path);
    const type = getImageMimeType(path);
    return stringToBinary(buffer, type);
}

export async function writeBinary(path, blob) {
    const body = await binaryToString(blob);
    await storage.writeFile(path, body);
}
