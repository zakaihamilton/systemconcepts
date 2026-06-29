import { downloadDataEdge } from "@util/storage/awsFetch";
import pako from "pako";
import { getCacheObjectPath } from "./apiCacheKeys";

const decoder = new TextDecoder("utf-8");

function decodeCachedBody(data) {
	return decoder.decode(pako.inflate(data));
}

export async function readApiCacheEdge(type, key) {
	const path = getCacheObjectPath(type, key);
	try {
		const data = await downloadDataEdge({ path, binary: true });
		return decodeCachedBody(data);
	} catch {
		return null;
	}
}
