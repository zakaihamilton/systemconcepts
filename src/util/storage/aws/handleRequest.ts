import { logger as structuredLogger } from "@util/api/logger";
import { getSafeError } from "@util/api/safeError";
import { isBinaryFile } from "@util/data/path";
import {
	deleteFile,
	downloadData,
	list,
	metadataInfo,
	uploadData,
} from "./objects";
import { validatePathAccess } from "./pathSecurity";

export async function handleRequest({ readOnly, req, path }: any) {
	const headers = req.headers || {};

	const resolvePath = () => {
		if (path !== undefined) return path;
		const headerPath = headers.path;
		return headerPath ? decodeURIComponent(headerPath) : headerPath;
	};

	const currentPath = resolvePath();

	if (currentPath) {
		validatePathAccess(currentPath);
	}

	if (req.method === "GET") {
		const query = req.query || {};
		const binary = query.binary || headers.binary;
		const type = query.type || headers.type;
		const exists = query.exists || headers.exists;

		if (exists) {
			const metadata = await metadataInfo({ path: currentPath });
			if (metadata) {
				const resolvedType =
					metadata.type === "application/x-directory" ? "dir" : "file";
				return { ...metadata, type: resolvedType };
			}
			return {};
		}

		try {
			if (type === "dir") {
				return await list({
					path: currentPath,
					includeCounts: query.counts === "1" || headers.counts === "1",
				});
			}
			return await downloadData({ path: currentPath, binary });
		} catch (err: any) {
			if (
				err?.name === "NoSuchKey" ||
				err?.Code === "NoSuchKey" ||
				err?.$metadata?.httpStatusCode === 404
			) {
				return "";
			}
			structuredLogger.error("get error: ", err);
			return { err: getSafeError(err) };
		}
	} else if (req.method === "PUT") {
		if (readOnly) {
			throw { message: "READ_ONLY_ACCESS", status: 403 };
		}

		const items = Array.isArray(req.body) ? req.body : [req.body];

		for (const item of items) {
			let { body, path: itemPath } = item;

			validatePathAccess(itemPath);

			if (typeof body === "string" && isBinaryFile(itemPath)) {
				body = Buffer.from(body, "base64");
			}
			await uploadData({ path: itemPath, data: body });
		}
		return { success: true };
	} else if (req.method === "DELETE") {
		if (readOnly) {
			throw { message: "READ_ONLY_ACCESS", status: 403 };
		}
		await deleteFile({ path: currentPath });
		return { success: true };
	}
}
