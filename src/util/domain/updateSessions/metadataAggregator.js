import { logger as structuredLogger } from "@util/api/logger";
import JSZip from "jszip";
import {
	getZipTextEntryId,
	parseSessionMetadataJSON,
	parseSummariesMarkdown,
} from "./metadataParser";

export function validateGroup(group) {
	if (!group || typeof group !== "string") {
		throw new Error("INVALID_GROUP");
	}
	if (!/^[^./\\][^/\\]*$/.test(group) || group.includes("..")) {
		throw new Error("INVALID_GROUP");
	}
}

export function validateYear(year) {
	if (!/^\d{4}$/.test(String(year || ""))) {
		throw new Error("INVALID_YEAR");
	}
}

export function normalizeListedItem(item, basePath) {
	const name = item.name;
	const itemPath = `${basePath}/${name}`;
	const stat = item.stat || {};
	return {
		name,
		path: `/aws/${itemPath}`,
		type: item.type || stat.type,
		stat,
		size: stat.size,
		mtimeMs: stat.mtimeMs,
	};
}

export async function parseTranscriptionZip(buffer) {
	const transcriptions = Object.create(null);
	if (!buffer) return transcriptions;

	const zip = new JSZip();
	await zip.loadAsync(buffer);
	zip.forEach((relativePath, zipEntry) => {
		const id = !zipEntry.dir && getZipTextEntryId(relativePath);
		if (id) {
			transcriptions[id] = true;
		}
	});
	return transcriptions;
}

export async function aggregateSessionMetadataFromSources({
	group,
	year,
	items,
	tagsContent,
	durationsContent,
	summariesContent,
	transcriptionsBuffer,
}) {
	let transcriptions = Object.create(null);
	try {
		transcriptions = await parseTranscriptionZip(transcriptionsBuffer);
	} catch (err) {
		structuredLogger.warn(
			`[SessionMetadata] Failed to parse transcription zip for ${group}/${year}`,
			err,
		);
	}

	const sortedItems = [...(items || [])].sort((a, b) =>
		a.name.localeCompare(b.name),
	);

	return {
		group,
		year,
		items: sortedItems,
		tags: parseSessionMetadataJSON(tagsContent, "tags"),
		durations: parseSessionMetadataJSON(durationsContent, "duration"),
		summaries: parseSummariesMarkdown(summariesContent),
		transcriptions,
	};
}
