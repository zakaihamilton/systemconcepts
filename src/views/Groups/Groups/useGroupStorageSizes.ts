import { logger as structuredLogger } from "@util/api/logger";
import storage from "@util/storage/storage";
import { useEffect, useState } from "react";

/**
 * Computes approximate local storage sizes (in bytes) per group across
 * bundled, merged, and split year-file layouts, refreshing when sync finishes.
 */
export function useGroupStorageSizes(
	groups: any[],
	counter: number,
	busy: boolean,
): Record<string, number> {
	const [groupSizes, setGroupSizes] = useState<Record<string, number>>({});
	const [sizeRefreshTrigger, setSizeRefreshTrigger] = useState(0);

	useEffect(() => {
		const calculateSizes = async () => {
			const sizes: Record<string, number> = {};
			let bundleData: any = null;

			// Check if we need to load bundle
			const hasBundled = groups.some((g: any) => g.bundled);
			if (hasBundled) {
				const bundlePath = "local/sync/bundle.json";
				try {
					if (await storage.exists(bundlePath)) {
						const content = await storage.readFile(bundlePath);
						bundleData = JSON.parse(content);
					}
				} catch (err: any) {
					structuredLogger.error("Error reading bundle for size check:", err);
				}
			}

			for (const group of groups) {
				try {
					const isMerged = group.merged ?? group.disabled;
					let totalSize = 0;

					if (group.bundled) {
						if (bundleData && Array.isArray(bundleData.sessions)) {
							const groupSessions = bundleData.sessions.filter(
								(s: any) => s.group === group.name,
							);
							// Approximate the size by stringifying the sessions belonging to this group
							if (groupSessions.length > 0) {
								totalSize = JSON.stringify(groupSessions).length;
							}
						}
					} else if (isMerged) {
						const mergedPath = `local/sync/${group.name}.json`;
						if (await storage.exists(mergedPath)) {
							const content = await storage.readFile(mergedPath);
							totalSize = content ? content.length : 0;
						}
					} else {
						const splitPath = `local/sync/${group.name}`;
						if (await storage.exists(splitPath)) {
							const yearFiles = await storage.getListing(splitPath);
							if (yearFiles) {
								for (const yearFile of yearFiles) {
									if (yearFile.name.endsWith(".json")) {
										const filePath = `${splitPath}/${yearFile.name}`;
										const content = await storage.readFile(filePath);
										totalSize += content ? content.length : 0;
									}
								}
							}
						}
					}

					sizes[group.name] = totalSize;
				} catch (err: any) {
					structuredLogger.error(
						`Error calculating size for ${group.name}:`,
						err,
					);
					sizes[group.name] = 0;
				}
			}
			setGroupSizes(sizes);
		};

		if (groups.length > 0) {
			calculateSizes();
		}
	}, [groups, counter, sizeRefreshTrigger]);

	useEffect(() => {
		if (!busy) {
			setSizeRefreshTrigger((prev) => prev + 1);
		}
	}, [busy]);

	return groupSizes;
}
