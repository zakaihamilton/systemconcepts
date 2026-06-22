import { LOCAL_SYNC_PATH } from "@sync/constants";
import { logger as structuredLogger } from "@util/api/logger";
import { readBinary } from "@util/data/binary";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import JSZip from "jszip";
import {
	getZipTextEntryId,
	normalizeTags,
	parseSessionMetadataJSON,
	parseSummariesMarkdown,
} from "./metadataParser";

async function loadFromCache(
	property,
	name,
	year,
	isMerged,
	isBundled,
	loader,
	isLoaded,
) {
	try {
		if (isBundled) {
			const bundlePath = makePath(LOCAL_SYNC_PATH, "bundle.json");
			if (await storage.exists(bundlePath)) {
				const content = await storage.readFile(bundlePath);
				const data = JSON.parse(content);
				loader(data);
			}
		}

		if (!isLoaded() && isMerged) {
			const mergedPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
			if (await storage.exists(mergedPath)) {
				const content = await storage.readFile(mergedPath);
				const data = JSON.parse(content);
				loader(data);
			}
		}

		if (!isLoaded()) {
			const localYearPath = makePath(
				LOCAL_SYNC_PATH,
				name,
				`${year.name}.json`,
			);
			if (await storage.exists(localYearPath)) {
				const content = await storage.readFile(localYearPath);
				const data = JSON.parse(content);
				loader(data);
			}
		}
	} catch (err) {
		structuredLogger.warn(`[Sync] Failed to read cache for ${property}`, err);
	}
}

async function loadMetadata(
	property,
	extension,
	year,
	name,
	path,
	forceUpdate,
	isMerged,
	isBundled,
) {
	const sessionMetadataMap = {};
	let updateLocalMetadata = forceUpdate;

	if (!forceUpdate) {
		let metadataLoaded = false;
		const metadataLoader = (data) => {
			if (data && Array.isArray(data.sessions)) {
				data.sessions.forEach((session) => {
					if (session && session[property]) {
						// Check if array has length for tags, or if value exists for others
						const hasValue = Array.isArray(session[property])
							? session[property].length > 0
							: session[property];
						if (hasValue) {
							let value = session[property];
							if (property === "tags" && Array.isArray(value)) {
								value = normalizeTags(value);
							}
							sessionMetadataMap[session.id] = value;
							if (session.name) {
								sessionMetadataMap[session.name] = value;

								if (session.name.startsWith(year.name)) {
									metadataLoaded = true;
								}
							}
						}
					}
				});
			}
		};

		await loadFromCache(
			property,
			name,
			year,
			isMerged,
			isBundled,
			metadataLoader,
			() => metadataLoaded,
		);

		if (!metadataLoaded) {
			updateLocalMetadata = true;
		}
	}

	if (updateLocalMetadata) {
		const metadataFileName = `${year.name}${extension}`;
		const metadataRemotePath = makePath(path, metadataFileName);
		if (await storage.exists(metadataRemotePath)) {
			try {
				const content = await storage.readFile(metadataRemotePath);
				Object.assign(
					sessionMetadataMap,
					parseSessionMetadataJSON(content, property),
				);
			} catch (err) {
				structuredLogger.error(
					`[Sync] Error reading ${property} file ${metadataRemotePath}:`,
					err,
				);
				throw err;
			}
		}
	}
	return sessionMetadataMap;
}

export async function loadTags(
	year,
	name,
	path,
	forceUpdate,
	isMerged,
	isBundled,
) {
	return loadMetadata(
		"tags",
		".tags",
		year,
		name,
		path,
		forceUpdate,
		isMerged,
		isBundled,
	);
}

export async function loadDurations(
	year,
	name,
	path,
	forceUpdate,
	isMerged,
	isBundled,
) {
	return loadMetadata(
		"duration",
		".duration",
		year,
		name,
		path,
		forceUpdate,
		isMerged,
		isBundled,
	);
}

export async function loadSummaries(
	year,
	name,
	path,
	forceUpdate,
	isMerged,
	isBundled,
) {
	const sessionMetadataMap = Object.create(null);
	let updateLocalMetadata = forceUpdate;
	const property = "summaryText";

	if (!forceUpdate) {
		let metadataLoaded = false;
		const metadataLoader = (data) => {
			if (data && Array.isArray(data.sessions)) {
				data.sessions.forEach((session) => {
					if (session && session[property]) {
						const value = session[property];
						if (value) {
							sessionMetadataMap[session.id] = value;
							if (session.name) {
								sessionMetadataMap[session.name] = value;
								if (session.name.startsWith(year.name)) {
									metadataLoaded = true;
								}
							}
						}
					}
				});
			}
		};

		await loadFromCache(
			property,
			name,
			year,
			isMerged,
			isBundled,
			metadataLoader,
			() => metadataLoaded,
		);

		if (!metadataLoaded) {
			updateLocalMetadata = true;
		}
	}

	if (updateLocalMetadata) {
		const metadataFileName = `${year.name}.md`;
		const metadataRemotePath = makePath(path, metadataFileName);
		if (await storage.exists(metadataRemotePath)) {
			try {
				const content = await storage.readFile(metadataRemotePath);
				Object.assign(sessionMetadataMap, parseSummariesMarkdown(content));
			} catch (err) {
				structuredLogger.error(
					`[Sync] Error reading ${property} file ${metadataRemotePath}:`,
					err,
				);
				throw err;
			}
		}
	}
	return sessionMetadataMap;
}

export async function loadTranscriptions(
	year,
	name,
	path,
	forceUpdate,
	isMerged,
	isBundled,
) {
	const sessionMetadataMap = Object.create(null);
	let updateLocalMetadata = forceUpdate;
	const property = "transcription";

	if (!forceUpdate) {
		let metadataLoaded = false;
		const metadataLoader = (data) => {
			if (data && Array.isArray(data.sessions)) {
				data.sessions.forEach((session) => {
					if (session && session[property]) {
						const value = session[property];
						if (value) {
							sessionMetadataMap[session.id] = value;
							if (session.name) {
								sessionMetadataMap[session.name] = value;
								if (session.name.startsWith(year.name)) {
									metadataLoaded = true;
								}
							}
						}
					}
				});
			}
		};

		await loadFromCache(
			property,
			name,
			year,
			isMerged,
			isBundled,
			metadataLoader,
			() => metadataLoaded,
		);

		if (!metadataLoaded) {
			updateLocalMetadata = true;
		}
	}

	if (updateLocalMetadata) {
		const metadataFileName = `${year.name}.zip`;
		const metadataRemotePath = makePath(path, metadataFileName);
		if (await storage.exists(metadataRemotePath)) {
			try {
				const blob = await readBinary(metadataRemotePath);
				if (blob) {
					const zip = new JSZip();
					await zip.loadAsync(blob);

					zip.forEach((relativePath, zipEntry) => {
						const id = !zipEntry.dir && getZipTextEntryId(relativePath);
						if (id) {
							// Extract the session ID from the filename
							// Format is usually: "YYYY-MM-DD Title.txt" or just the session ID
							sessionMetadataMap[id] = true;
						}
					});
				}
			} catch (err) {
				structuredLogger.error(
					`[Sync Transcription] Error reading ${property} file ${metadataRemotePath}:`,
					err,
				);
				// Don't throw, as the zip might simply not exist yet or be corrupted,
				// but we should still allow sync to continue
			}
		}
	}
	return sessionMetadataMap;
}
