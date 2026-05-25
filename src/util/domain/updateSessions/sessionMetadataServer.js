import {
	downloadData,
	list,
	metadataInfo,
	validatePathAccess,
} from "@util/storage/aws";
import JSZip from "jszip";
import {
	getZipTextEntryId,
	parseSessionMetadataJSON,
	parseSummariesMarkdown,
} from "./metadataParser";

function validateGroup(group) {
	if (!group || typeof group !== "string") {
		throw new Error("INVALID_GROUP");
	}
	if (!/^[^./\\][^/\\]*$/.test(group) || group.includes("..")) {
		throw new Error("INVALID_GROUP");
	}
}

function validateYear(year) {
	if (!/^\d{4}$/.test(String(year || ""))) {
		throw new Error("INVALID_YEAR");
	}
}

async function readTextIfExists(path) {
	const info = await metadataInfo({ path });
	if (!info || info.type === "application/x-directory" || info.type === "dir") {
		return null;
	}
	return await downloadData({ path });
}

async function readBinaryIfExists(path) {
	const info = await metadataInfo({ path });
	if (!info || info.type === "application/x-directory" || info.type === "dir") {
		return null;
	}
	return await downloadData({ path, binary: true });
}

function normalizeListedItem(item, basePath) {
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

async function parseTranscriptionZip(buffer) {
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

export async function aggregateSessionMetadata({ group, year }) {
	validateGroup(group);
	validateYear(year);

	const basePath = `sessions/${group}/${year}`;
	validatePathAccess(basePath);

	const items = (await list({ path: basePath })).map((item) =>
		normalizeListedItem(item, basePath),
	);
	items.sort((a, b) => a.name.localeCompare(b.name));

	const metadataBasePath = `sessions/${group}`;
	const [
		tagsContent,
		durationsContent,
		summariesContent,
		transcriptionsBuffer,
	] = await Promise.all([
		readTextIfExists(`${metadataBasePath}/${year}.tags`),
		readTextIfExists(`${metadataBasePath}/${year}.duration`),
		readTextIfExists(`${metadataBasePath}/${year}.md`),
		readBinaryIfExists(`${metadataBasePath}/${year}.zip`),
	]);

	let transcriptions = Object.create(null);
	try {
		transcriptions = await parseTranscriptionZip(transcriptionsBuffer);
	} catch (err) {
		console.warn(
			`[SessionMetadata] Failed to parse transcription zip for ${group}/${year}`,
			err,
		);
	}

	return {
		group,
		year,
		items,
		tags: parseSessionMetadataJSON(tagsContent, "tags"),
		durations: parseSessionMetadataJSON(durationsContent, "duration"),
		summaries: parseSummariesMarkdown(summariesContent),
		transcriptions,
	};
}
