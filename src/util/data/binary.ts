import { getImageMimeType } from "@util/data/path";
import storage from "@util/storage/storage";
import { decode, encode } from "base64-arraybuffer-es6";

export async function binaryToString(blob: any) {
	const buffer = await blob.arrayBuffer();
	const body = encode(buffer);
	return body;
}

export function stringToBinary(string: string, type?: string) {
	const buffer = decode(string);
	const blob = new Blob([new Uint8Array(buffer)], { type });
	return blob;
}

export async function readBinary(path: any) {
	const buffer = await storage.readFile(path);
	if (!buffer) {
		throw "FILE_NOT_FOUND - " + path;
	}
	if (typeof buffer !== "string") {
		throw new TypeError(`Expected base64 text for binary file: ${path}`);
	}
	const type = getImageMimeType(path);
	return typeof buffer === "string"
		? stringToBinary(buffer, type)
		: new Blob([buffer], { type });
}

export async function writeBinary(path: any, blob: any) {
	const body = await binaryToString(blob);
	await storage.writeFile(path, body);
}
