import storage from "@/util/storage";
import { decode, encode } from "base64-arraybuffer-es6";

export async function binaryToString(blob) {
    const buffer = await blob.arrayBuffer();
    const body = encode(buffer);
    return body;
}

export function stringToBinary(string) {
    const buffer = decode(string);
    const blob = new Blob([new Uint8Array(buffer)]);
    return blob;
}

export async function readBinary(path) {
    const buffer = await storage.readFile(path);
    return await stringToBinary(buffer);
}

export async function writeBinary(blob, path) {
    const body = await binaryToString(blob);
    await storage.writeFile(path, body);
}
