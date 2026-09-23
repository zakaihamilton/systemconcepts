import { downloadDataEdge } from "@util/storage/awsFetch";
import pako from "pako";
import { getCacheObjectPath } from "./apiCacheKeys";

const decoder = new TextDecoder("utf-8");

function decodeCachedBody(data: any) {
	return decoder.decode(pako.inflate(data));
}

export async function readApiCacheEdge(type: any, key: any) {
	const path = getCacheObjectPath(type, key);
	try {
		const data = await downloadDataEdge({ path, binary: true });
		return decodeCachedBody(data);
	} catch {
		return null;
	}
}
