import type { ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";

type ListedStorageItem = {
	name: string | undefined;
	type?: "dir";
	count?: number;
	stat?: {
		type: "dir" | "file";
		size: number | undefined;
		mtimeMs: number | undefined;
	};
};

type ListObjectContentWithType = NonNullable<
	ListObjectsV2CommandOutput["Contents"]
>[number] & {
	ContentType?: string;
};

type ListObjectsOptions = {
	excludePrivateDirectory?: boolean;
};

export function listObjectsV2ToItems(
	response: ListObjectsV2CommandOutput,
	{ excludePrivateDirectory = false }: ListObjectsOptions = {},
): ListedStorageItem[] {
	const items: ListedStorageItem[] = [];

	response.CommonPrefixes?.forEach((prefix) => {
		const prefixPath = prefix.Prefix!;
		const name = prefixPath
			.substring(0, prefixPath.length - 1)
			.split("/")
			.pop();
		if (excludePrivateDirectory && name === "private") return;

		items.push({ type: "dir", name });
	});

	response.Contents?.forEach((content) => {
		const name = content.Key!.split("/").pop();
		if (!name) return;

		const contentType = (content as ListObjectContentWithType).ContentType;
		const type = contentType === "application/x-directory" ? "dir" : "file";
		items.push({
			name,
			stat: {
				type,
				size: content.Size,
				mtimeMs: content.LastModified && content.LastModified.valueOf(),
			},
		});
	});

	return items;
}
