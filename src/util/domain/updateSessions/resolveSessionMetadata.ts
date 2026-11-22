import { addSyncLog } from "@sync/sync";
import { logger as structuredLogger } from "@util/api/logger";
import { isDurationFile, isSummaryFile, isTagsFile } from "@util/data/path";
import storage from "@util/storage/storage";
import { createSessionItem } from "./mapper";
import {
	getDigitalOceanSessionFiles,
	getMetadataValue,
	getWasabiSessionFiles,
} from "./updateGroupSessionFiles";

export async function resolveSessionMetadata({
	id,
	name,
	yearName,
	targetSessionId,
	cachedYearSessions,
	wasabiFilesMap,
	digitalOceanFilesMap,
	sessionTagsMap,
	sessionDurationMap,
	sessionSummariesMap,
	sessionTranscriptionMap,
}: {
	id: string;
	name: string;
	yearName: string;
	targetSessionId?: string;
	cachedYearSessions: any[];
	wasabiFilesMap: Record<string, any>;
	digitalOceanFilesMap: Record<string, any>;
	sessionTagsMap: any;
	sessionDurationMap: any;
	sessionSummariesMap: any;
	sessionTranscriptionMap: any;
}) {
	if (targetSessionId && id !== targetSessionId) {
		const cachedSession = (cachedYearSessions || []).find(
			(s: any) => s.id === id || s.name === id,
		);
		if (cachedSession) {
			return cachedSession;
		}
	} else if (targetSessionId && id === targetSessionId) {
		addSyncLog(
			`[${name}] Force re-fetching metadata for targeted session: ${id}`,
			"info",
		);
	}

	const [, , sessionName] = id.trim().match(/(\d+-\d+-\d+) (.*)/) || [];
	let tags = getMetadataValue(sessionTagsMap, id, sessionName) || [];
	let duration = getMetadataValue(sessionDurationMap, id, sessionName);
	let summary = getMetadataValue(sessionSummariesMap, id, sessionName);
	let transcription = getMetadataValue(
		sessionTranscriptionMap,
		id,
		sessionName,
	);

	if (targetSessionId && id === targetSessionId) {
		addSyncLog(
			`[${name}] Resolved metadata keys - id: "${id}", sessionName: "${sessionName || "none"}"`,
			"info",
		);
		addSyncLog(
			`[${name}] Resolved tags from S3: ${JSON.stringify(tags)}`,
			"info",
		);
		addSyncLog(
			`[${name}] Resolved duration from S3: ${duration || "none"}`,
			"info",
		);
		addSyncLog(
			`[${name}] Resolved summary from S3: ${summary ? summary.substring(0, 80) + "..." : "none"}`,
			"info",
		);
		addSyncLog(
			`[${name}] Resolved transcription from S3: ${transcription || "none"}`,
			"info",
		);
	}

	let transcriptPath = null;
	const wasabiFiles = wasabiFilesMap[id] || [];
	const digitalOceanFiles = getDigitalOceanSessionFiles(
		digitalOceanFilesMap[id],
		wasabiFiles,
	);
	const files = [...getWasabiSessionFiles(wasabiFiles), ...digitalOceanFiles];
	const metadataFallbackFiles = [...digitalOceanFiles, ...wasabiFiles];

	if (!tags.length) {
		const tagsFile = metadataFallbackFiles.find((f) => isTagsFile(f.name));
		if (tagsFile) {
			try {
				const content = await storage.readFile(tagsFile.path);
				const parsed = JSON.parse(content);
				if (Array.isArray(parsed)) {
					tags = parsed;
				} else if (parsed && Array.isArray(parsed.tags)) {
					tags = parsed.tags;
				}
			} catch (err: any) {
				structuredLogger.warn(
					`[Sync] Failed to read tags file ${tagsFile.path}`,
					err,
				);
			}
		}
	}

	if (!duration || duration < 1) {
		const durationFile = metadataFallbackFiles.find((f) =>
			isDurationFile(f.name),
		);
		if (durationFile) {
			try {
				const content = await storage.readFile(durationFile.path);
				try {
					const parsed = JSON.parse(content);
					if (parsed && typeof parsed.duration === "number") {
						duration = parsed.duration;
					} else {
						duration = parseFloat(content);
					}
				} catch {
					duration = parseFloat(content);
				}
			} catch (err: any) {
				structuredLogger.warn(
					`[Sync] Failed to read duration file ${durationFile.path}`,
					err,
				);
			}
		}
	}

	if (!summary) {
		const summaryFile = metadataFallbackFiles.find((f) =>
			isSummaryFile(f.name),
		);
		if (summaryFile) {
			try {
				summary = await storage.readFile(summaryFile.path);
			} catch (err: any) {
				structuredLogger.warn(
					`[Sync] Failed to read summary file ${summaryFile.path}`,
					err,
				);
			}
		}
	}

	if (!transcription) {
		const txtFile = metadataFallbackFiles.find((f) =>
			f.name.toLowerCase().endsWith(".txt"),
		);
		if (txtFile) {
			transcription = true;
			transcriptPath = txtFile.path;
		}
	}

	const item = createSessionItem(
		id,
		files,
		yearName,
		name,
		tags,
		duration,
		summary,
		transcription,
		transcriptPath,
	);

	if (targetSessionId && id === targetSessionId) {
		addSyncLog(
			`[${name}] Targeted session metadata updated successfully: ${id}`,
			"success",
		);
	}

	return item;
}
