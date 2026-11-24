import { FILES_MANIFEST } from "@sync/constants";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import { compactLegacySessionThumbnails } from "@util/domain/sessionCompaction";
import { toSessionListItem } from "@util/domain/sessionListItem";
import storage from "@util/storage/storage";

const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

async function readJsonIfExists(path: string) {
	if (await storage.exists(path)) {
		const content = await storage.readFile(path);
		return JSON.parse(content);
	}
	return null;
}

async function loadBundledSessions() {
	let bundledSessions: any[] = [];
	const bundlePath = makePath("local/sync/bundle.json");
	if (await storage.exists(bundlePath)) {
		try {
			const content = await storage.readFile(bundlePath);
			const data = JSON.parse(content);
			if (data?.sessions) {
				bundledSessions = data.sessions;
			}
		} catch (err: any) {
			structuredLogger.error("[Sessions] Error reading bundle.json:", err);
		}
	}
	return bundledSessions;
}

async function loadPersonalMetadata(): Promise<Record<string, any>> {
	const personalMetadata: Record<string, any> = {};
	const personalBasePath = "local/personal";
	if (!(await storage.exists(personalBasePath))) {
		return personalMetadata;
	}

	try {
		const listing = await storage.getRecursiveList(personalBasePath);
		const metadataFiles = listing.filter(
			(item: any) =>
				item.type !== "dir" &&
				item.name?.endsWith(".json") &&
				!item.name.includes("undefined") &&
				!item.path.includes("metadata/sessions"),
		);

		structuredLogger.debug(
			`[Sessions] Found ${metadataFiles.length} personal metadata files`,
		);

		for (const file of metadataFiles) {
			try {
				const content = await storage.readFile(file.path);
				const data = JSON.parse(content);
				let relativePath = file.path.replace(personalBasePath, "");
				while (relativePath.startsWith("/")) {
					relativePath = relativePath.substring(1);
				}

				const parts = relativePath.split("/");
				let groupName = "";
				const isBundleFile = parts.length === 1 && parts[0] === "bundle.json";

				if (parts.length === 1 && !isBundleFile) {
					groupName = parts[0].replace(".json", "");
				} else if (parts.length === 2) {
					groupName = parts[0];
				} else if (!isBundleFile) {
					continue;
				}

				for (const [bundleKey, sessionData] of Object.entries(data) as [
					string,
					any,
				][]) {
					const key = isBundleFile
						? bundleKey.replace(/\.json$/, "")
						: `${groupName}/${bundleKey.replace(/\.json$/, "")}`;

					if (key) {
						personalMetadata[key] = {
							position: sessionData.position || 0,
							duration: sessionData.duration || 0,
						};
					}
				}
			} catch {
				structuredLogger.error(
					`[Sessions] Error parsing personal file ${file.path}:`,
				);
			}
		}

		if (Object.keys(personalMetadata).length > 0) {
			structuredLogger.debug(
				`[Sessions] Loaded ${Object.keys(personalMetadata).length} personal metadata entries`,
			);
		}
	} catch (err: any) {
		structuredLogger.error("[Sessions] Error loading personal metadata:", err);
	}

	return personalMetadata;
}

async function resolveGroupTasks(nonBundledGroups: any[], filesManifest: any) {
	const CHUNK_SIZE = 3;
	const groupsWithYears: any[] = [];

	for (let i = 0; i < nonBundledGroups.length; i += CHUNK_SIZE) {
		const chunk = nonBundledGroups.slice(i, i + CHUNK_SIZE);
		const chunkResults = await Promise.all(
			chunk.map(async (group) => {
				const groupName = group.name;
				const mergedPath = `/${groupName}.json`;
				let isMerged =
					filesManifest &&
					filesManifest.some((f: any) => f.path === mergedPath);
				if (!filesManifest) {
					isMerged = await storage.exists(
						makePath(`local/sync/${groupName}.json`),
					);
				}

				if (isMerged) {
					const path = makePath(`local/sync/${groupName}.json`);
					if (await storage.exists(path)) {
						const content = await storage.readFile(path);
						const groupData = JSON.parse(content);
						if (groupData && groupData.sessions) {
							return { group, sessions: groupData.sessions };
						}
					}
				}

				let years: any[] = [];
				if (filesManifest) {
					const yearRegex = new RegExp(`^/${groupName}/(\\d+)\\.json$`);
					years = filesManifest
						.filter((f: any) => yearRegex.test(f.path))
						.map((f: any) => ({ name: f.path.match(yearRegex)[1] }));
				} else {
					try {
						const listing = await storage.getListing(
							makePath("local/sync", groupName),
						);
						if (listing) {
							years = listing
								.filter((f: any) => f.name.endsWith(".json"))
								.map((f: any) => ({ name: f.name.replace(".json", "") }));
						}
					} catch {
						// ignore missing dir
					}
				}

				return { group, years };
			}),
		);
		groupsWithYears.push(...chunkResults);

		if (i + CHUNK_SIZE < nonBundledGroups.length) {
			await yieldToEventLoop();
		}
	}

	return groupsWithYears.flatMap(({ group, years, sessions }: any) => {
		if (sessions) {
			return [{ group, sessions }];
		}
		return years.map((year: any) => ({ group, year }));
	});
}

function enrichSession(
	session: any,
	groupInfo: any,
	includeDisabledForMerged: boolean,
	cdn: any,
	personalMetadata: Record<string, any>,
) {
	const isMerged = includeDisabledForMerged
		? (groupInfo?.merged ?? groupInfo?.disabled)
		: groupInfo?.merged;
	const personalKey = `${session.group}/${(isMerged || groupInfo?.bundled) && session.year ? session.year + "/" : ""}${session.date} ${session.name}`;
	return toSessionListItem(session, {
		cdn,
		groupInfo,
		personal: personalMetadata[personalKey],
	});
}

export async function loadSessionsData({
	groupsSettings,
	groupMetadata,
}: {
	groupsSettings: any;
	groupMetadata: any;
}) {
	const startTime = performance.now();
	structuredLogger.debug("[Sessions] Loading sessions...");

	try {
		await compactLegacySessionThumbnails();
	} catch (err: any) {
		structuredLogger.warn(
			"[Sessions] Legacy thumbnail compaction failed; continuing with session load.",
			err,
		);
	}

	const [groupsSyncData, filesManifest] = await Promise.all([
		readJsonIfExists(makePath("local/sync/groups.json")),
		readJsonIfExists(makePath("local/sync", FILES_MANIFEST)),
	]);
	const cdn = groupsSettings?.cdn || {};

	const groups = Array.isArray(groupsSyncData?.groups)
		? groupsSyncData.groups
		: [];

	let bundledSessions = await loadBundledSessions();
	const personalMetadata = await loadPersonalMetadata();

	const timeAfterManifests = performance.now();
	structuredLogger.debug(
		`[Sessions] Loaded manifests in ${(timeAfterManifests - startTime).toFixed(1)}ms`,
	);

	const bundledGroups = new Set<any>();
	const nonBundledGroups: any[] = [];
	for (const group of groups) {
		if (group.bundled) {
			bundledGroups.add(group.name);
		} else {
			nonBundledGroups.push(group);
		}
	}

	const tasks = await resolveGroupTasks(nonBundledGroups, filesManifest);

	const timeAfterGroups = performance.now();
	structuredLogger.debug(
		`[Sessions] Processed ${groups.length} groups (${bundledGroups.size} bundled) in ${(timeAfterGroups - timeAfterManifests).toFixed(1)}ms`,
	);

	const groupInfoMap = new Map<any, any>();
	if (groupMetadata) {
		for (const info of groupMetadata) {
			groupInfoMap.set(info.name, info);
		}
	}

	// Project bundled sessions immediately so parsed source files can be collected.
	bundledSessions = bundledSessions
		.filter((session: any) => bundledGroups.has(session.group))
		.map((session: any) =>
			enrichSession(
				session,
				groupInfoMap.get(session.group),
				true,
				cdn,
				personalMetadata,
			),
		);

	const YEAR_CHUNK_SIZE = 5;
	let allSessions = bundledSessions.slice();

	for (let i = 0; i < tasks.length; i += YEAR_CHUNK_SIZE) {
		const chunk = tasks.slice(i, i + YEAR_CHUNK_SIZE);
		const chunkResults = await Promise.all(
			chunk.map(async ({ group, year, sessions }: any) => {
				let _path = "";
				try {
					let dataSessions = sessions;
					if (!dataSessions) {
						_path = makePath("local/sync", group.name, `${year.name}.json`);
						const data = await readJsonIfExists(_path);
						if (data && data.sessions) {
							dataSessions = data.sessions;
						}
					}

					if (!dataSessions) {
						return [];
					}

					const groupInfo = groupInfoMap.get(group.name);
					return dataSessions.map((session: any) =>
						enrichSession(session, groupInfo, false, cdn, personalMetadata),
					);
				} catch (err: any) {
					structuredLogger.error("Error reading sessions file", _path, err);
					return [];
				}
			}),
		);

		allSessions = allSessions.concat(chunkResults.flat());

		if (i + YEAR_CHUNK_SIZE < tasks.length) {
			await yieldToEventLoop();
		}
	}

	const timeAfterSessions = performance.now();
	structuredLogger.debug(
		`[Sessions] Loaded ${allSessions.length} sessions in ${(timeAfterSessions - timeAfterGroups).toFixed(1)}ms`,
	);
	structuredLogger.debug(
		`[Sessions] Total load time: ${(timeAfterSessions - startTime).toFixed(1)}ms`,
	);

	return { sessions: allSessions, groups };
}
