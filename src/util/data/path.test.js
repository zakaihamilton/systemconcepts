import {
	fileExtension,
	fileFolder,
	fileName,
	fileTitle,
	getImageMimeType,
	isAudioFile,
	isBinaryFile,
	isCompressedJSONFile,
	isDurationFile,
	isImageFile,
	isMediaFile,
	isSubtitleFile,
	isSummaryFile,
	isTagsFile,
	isVideoFile,
	makePath,
} from "./path";

describe("makePath", () => {
	it("joins components with a leading slash", () => {
		expect(makePath("a", "b", "c")).toBe("/a/b/c");
	});

	it("filters out falsy components", () => {
		expect(makePath("a", null, undefined, "", "b")).toBe("/a/b");
	});

	it("normalizes components that already contain slashes", () => {
		expect(makePath("/a/", "/b/c/")).toBe("/a/b/c");
	});

	it("returns a lone slash when given no components", () => {
		expect(makePath()).toBe("/");
	});
});

describe("isBinaryFile", () => {
	it("returns true for known binary extensions", () => {
		expect(isBinaryFile("video.mp4")).toBe(true);
		expect(isBinaryFile("archive.zip")).toBe(true);
	});

	it("returns false for non-binary extensions", () => {
		expect(isBinaryFile("notes.txt")).toBe(false);
	});
});

describe("isCompressedJSONFile", () => {
	it("returns true for .json.gz files", () => {
		expect(isCompressedJSONFile("data.json.gz")).toBe(true);
	});

	it("returns false for other files", () => {
		expect(isCompressedJSONFile("data.json")).toBe(false);
	});
});

describe("isMediaFile", () => {
	it("returns true for video and audio extensions", () => {
		expect(isMediaFile("clip.mp4")).toBe(true);
		expect(isMediaFile("clip.m4a")).toBe(true);
	});

	it("returns false for other extensions", () => {
		expect(isMediaFile("image.png")).toBe(false);
	});
});

describe("isVideoFile", () => {
	it("returns true for .mp4 files", () => {
		expect(isVideoFile("clip.mp4")).toBe(true);
	});

	it("returns false for non-video files", () => {
		expect(isVideoFile("clip.m4a")).toBe(false);
	});
});

describe("isAudioFile", () => {
	it("returns true for .m4a files", () => {
		expect(isAudioFile("clip.m4a")).toBe(true);
	});

	it("returns false for non-audio files", () => {
		expect(isAudioFile("clip.mp4")).toBe(false);
	});
});

describe("isImageFile", () => {
	it("returns true for image extensions", () => {
		expect(isImageFile("photo.png")).toBe(true);
		expect(isImageFile("photo.jpg")).toBe(true);
		expect(isImageFile("photo.jpeg")).toBe(true);
	});

	it("returns false for non-image extensions", () => {
		expect(isImageFile("photo.gif")).toBe(false);
	});
});

describe("getImageMimeType", () => {
	it("returns image/png for .png files", () => {
		expect(getImageMimeType("photo.PNG")).toBe("image/png");
	});

	it("returns image/jpeg for .jpg and .jpeg files", () => {
		expect(getImageMimeType("photo.jpg")).toBe("image/jpeg");
		expect(getImageMimeType("photo.jpeg")).toBe("image/jpeg");
	});

	it("returns a generic mime type for unknown extensions", () => {
		expect(getImageMimeType("file.bin")).toBe("application/octet-stream");
	});
});

describe("isSubtitleFile", () => {
	it("returns true for .vtt files", () => {
		expect(isSubtitleFile("captions.vtt")).toBe(true);
	});

	it("returns false for other files", () => {
		expect(isSubtitleFile("captions.srt")).toBe(false);
	});
});

describe("isSummaryFile", () => {
	it("returns true for .md files", () => {
		expect(isSummaryFile("notes.md")).toBe(true);
	});

	it("returns false for other files", () => {
		expect(isSummaryFile("notes.txt")).toBe(false);
	});
});

describe("isTagsFile", () => {
	it("returns true for .tags files", () => {
		expect(isTagsFile("session.tags")).toBe(true);
	});

	it("returns false for other files", () => {
		expect(isTagsFile("session.txt")).toBe(false);
	});
});

describe("isDurationFile", () => {
	it("returns true for .duration files", () => {
		expect(isDurationFile("session.duration")).toBe(true);
	});

	it("returns false for other files", () => {
		expect(isDurationFile("session.txt")).toBe(false);
	});
});

describe("fileExtension", () => {
	it("returns the extension of a file", () => {
		expect(fileExtension("/a/b/file.txt")).toBe("txt");
	});

	it("returns the whole path when there is no extension", () => {
		expect(fileExtension("/a/b/file")).toBe("/a/b/file");
	});
});

describe("fileTitle", () => {
	it("returns the file name without its extension", () => {
		expect(fileTitle("/a/b/file.txt")).toBe("file");
	});

	it("returns the full name when there is no extension", () => {
		expect(fileTitle("/a/b/file")).toBe("file");
	});

	it("handles file names with multiple dots", () => {
		expect(fileTitle("archive.tar.gz")).toBe("archive.tar");
	});
});

describe("fileName", () => {
	it("returns the last path segment", () => {
		expect(fileName("/a/b/file.txt")).toBe("file.txt");
	});
});

describe("fileFolder", () => {
	it("returns all but the last path segment with a leading slash", () => {
		expect(fileFolder("/a/b/file.txt")).toBe("/a/b");
	});

	it("returns an empty string for a top-level file", () => {
		expect(fileFolder("/file.txt")).toBe("");
	});
});
