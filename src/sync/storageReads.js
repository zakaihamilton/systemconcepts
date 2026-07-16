/**
 * Read a file without a separate existence probe.
 *
 * Storage adapters return null for missing local files, while remote adapters
 * may throw a 404/ENOENT/NoSuchKey error. Only those known missing-file cases
 * are converted to null; authentication and transient failures still surface.
 */
export function isMissingFileError(error) {
	const code = String(error?.code || error?.name || "").toLowerCase();
	const status = Number(error?.status || error?.statusCode || 0);
	const message = String(error?.message || error || "").toLowerCase();
	return (
		status === 404 ||
		code === "enoent" ||
		code === "nosuchkey" ||
		message.includes("enoent") ||
		message.includes("nosuchkey") ||
		message.includes("no such key") ||
		message.includes("failed to fetch file: 404")
	);
}

export async function readFileIfExists(storage, path) {
	try {
		const content = await storage.readFile(path);
		return content === undefined ? null : content;
	} catch (error) {
		if (isMissingFileError(error)) {
			return null;
		}
		throw error;
	}
}
