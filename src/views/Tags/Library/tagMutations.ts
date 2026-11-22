import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { bumpLibraryCounter } from "@sync/libraryCounter";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import { LibraryStore } from "@views/Library/Store";

function groupTagIdsByPath(affectedTags: any[]): Record<string, any[]> {
	const filesToUpdate: Record<string, any[]> = {};
	for (const tag of affectedTags) {
		if (tag.path) {
			if (!filesToUpdate[tag.path]) {
				filesToUpdate[tag.path] = [];
			}
			filesToUpdate[tag.path].push(tag._id);
		}
	}
	return filesToUpdate;
}

async function persistUpdatedTags(updatedTags: any[]): Promise<void> {
	const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
	await storage.writeFile(tagsPath, JSON.stringify(updatedTags, null, 2));
	LibraryStore.update((s) => {
		s.tags = updatedTags;
	});
	await bumpLibraryCounter();
}

async function updateTagFieldInFiles(
	affectedTags: any[],
	mutateItem: (item: any) => void,
): Promise<void> {
	const filesToUpdate = groupTagIdsByPath(affectedTags);
	for (const [relativePath, ids] of Object.entries(filesToUpdate)) {
		const filePath = makePath(LIBRARY_LOCAL_PATH, relativePath);
		if (!(await storage.exists(filePath))) continue;

		const content = await storage.readFile(filePath);
		let data = JSON.parse(content);
		let changed = false;

		if (Array.isArray(data)) {
			data = data.map((item) => {
				if (ids.includes(item._id)) {
					mutateItem(item);
					changed = true;
				}
				return item;
			});
		} else if (data._id && ids.includes(data._id)) {
			mutateItem(data);
			changed = true;
		}

		if (changed) {
			await storage.writeFile(filePath, JSON.stringify(data, null, 2));
		}
	}
}

/**
 * Renames a tag value across tags.json and all affected library article files.
 */
export async function renameLibraryTag(
	tags: any[],
	category: string,
	oldValue: string,
	newValue: string,
): Promise<any[]> {
	const updatedTags = tags.map((tag) =>
		tag[category] === oldValue ? { ...tag, [category]: newValue } : tag,
	);
	const affectedTags = tags.filter((tag) => tag[category] === oldValue);

	await updateTagFieldInFiles(affectedTags, (item) => {
		item[category] = newValue;
	});
	await persistUpdatedTags(updatedTags);
	return updatedTags;
}

/**
 * Deletes a tag field across tags.json and all affected library article files.
 */
export async function deleteLibraryTag(
	tags: any[],
	category: string,
	oldValue: string,
): Promise<any[]> {
	const updatedTags = tags.map((tag) => {
		if (tag[category] === oldValue) {
			const newTag = { ...tag };
			delete newTag[category];
			return newTag;
		}
		return tag;
	});
	const affectedTags = tags.filter((tag) => tag[category] === oldValue);

	await updateTagFieldInFiles(affectedTags, (item) => {
		delete item[category];
	});
	await persistUpdatedTags(updatedTags);
	return updatedTags;
}

/**
 * Deletes all articles matching a tag category/value from article files and tags.json.
 */
export async function deleteLibraryTagArticles(
	tags: any[],
	category: string,
	filterValue: string,
): Promise<any[]> {
	const articlesToDelete = tags.filter((tag) => tag[category] === filterValue);
	const idsToDelete = articlesToDelete.map((tag) => tag._id);
	const updatedTags = tags.filter((tag) => !idsToDelete.includes(tag._id));
	const filesToUpdate = groupTagIdsByPath(articlesToDelete);

	for (const [relativePath, ids] of Object.entries(filesToUpdate)) {
		const filePath = makePath(LIBRARY_LOCAL_PATH, relativePath);
		if (!(await storage.exists(filePath))) continue;

		const content = await storage.readFile(filePath);
		let data = JSON.parse(content);
		let shouldWrite = false;
		let shouldDelete = false;

		if (Array.isArray(data)) {
			const newData = data.filter((item) => !ids.includes(item._id));
			if (newData.length === 0) {
				shouldDelete = true;
			} else if (newData.length !== data.length) {
				data = newData;
				shouldWrite = true;
			}
		} else if (data._id && ids.includes(data._id)) {
			shouldDelete = true;
		}

		if (shouldDelete) {
			await storage.deleteFile(filePath);
		} else if (shouldWrite) {
			await storage.writeFile(filePath, JSON.stringify(data, null, 2));
		}
	}

	await persistUpdatedTags(updatedTags);
	return updatedTags;
}
