import { logger as structuredLogger } from "@util/api/logger";

/**
 * Parses an imported groups JSON file (array, `{ groups }`, or keyed map)
 * and updates group state while preserving existing internal fields.
 */
export async function importGroupsFile(
	file: File | undefined,
	setGroups: (updater: (currentGroups: any[]) => any[]) => void,
): Promise<void> {
	if (!file) return;

	try {
		const text = await file.text();
		const importedData = JSON.parse(text);

		// Handle multiple formats: array, or object { groups: [...] }, or object { "groupName": { ... } }
		let importedGroups: any[] = [];
		if (Array.isArray(importedData)) {
			importedGroups = importedData;
		} else if (importedData.groups && Array.isArray(importedData.groups)) {
			importedGroups = importedData.groups;
		} else {
			importedGroups = Object.entries(importedData as Record<string, any>).map(
				([name, info]) => ({
					name,
					...info,
				}),
			);
		}

		if (!importedGroups.length) {
			throw new Error("Invalid format: no groups found in the imported file");
		}

		setGroups((currentGroups: any[]) =>
			importedGroups.map((imported: any) => {
				const existing =
					currentGroups.find((g: any) => g.name === imported.name) || {};
				return {
					...existing,
					name: imported.name,
					color:
						imported.color !== undefined
							? imported.color
							: existing.color || "",
					disabled:
						imported.disabled !== undefined
							? !!imported.disabled
							: existing.disabled || false,
					merged:
						imported.merged !== undefined
							? !!imported.merged
							: existing.merged || false,
					bundled:
						imported.bundled !== undefined
							? !!imported.bundled
							: existing.bundled || false,
				};
			}),
		);
	} catch (err: any) {
		structuredLogger.error("Error importing groups:", err);
		alert("Failed to import groups.json: " + err.message);
	}
}
