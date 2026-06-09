import {
	downloadData,
	list,
	metadataInfo,
	validatePathAccess,
} from "@util/storage/aws";
import {
	aggregateSessionMetadataFromSources,
	normalizeListedItem,
	validateGroup,
	validateYear,
} from "./metadataAggregator";

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

export async function aggregateSessionMetadata({ group, year }) {
	validateGroup(group);
	validateYear(year);

	const basePath = `sessions/${group}/${year}`;
	validatePathAccess(basePath);

	const items = (await list({ path: basePath })).map((item) =>
		normalizeListedItem(item, basePath),
	);

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

	return aggregateSessionMetadataFromSources({
		group,
		year,
		items,
		tagsContent,
		durationsContent,
		summariesContent,
		transcriptionsBuffer,
	});
}
