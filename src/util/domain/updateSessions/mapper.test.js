import { createSessionItem } from "./mapper";

function file(name, path) {
	return { name, path: path || `/aws/sessions/test/2024/${name}` };
}

describe("createSessionItem", () => {
	it("returns null when the id does not match the date/name pattern", () => {
		expect(
			createSessionItem("not-a-valid-id", [file("a.mp4")], "2024", "test"),
		).toBeNull();
	});

	it("returns null when there is no audio, video, or image file", () => {
		const result = createSessionItem(
			"2024-05-05 Test Session",
			[file("2024-05-05 Test Session.txt")],
			"2024",
			"test",
		);
		expect(result).toBeNull();
	});

	it("creates a video session item with the expected type and order", () => {
		const result = createSessionItem(
			"2024-05-05 Test Session",
			[file("2024-05-05 Test Session.mp4")],
			"2024",
			"test",
			["ai.", " sync "],
			42,
			"Summary text",
			true,
			"/aws/sessions/test/2024/2024-05-05 Test Session.txt",
		);

		expect(result).toMatchObject({
			key: "test_2024-05-05 Test Session",
			id: "2024-05-05 Test Session",
			name: "Test Session",
			date: "2024-05-05",
			year: "2024",
			group: "test",
			type: "video",
			typeOrder: 10,
			tags: ["ai", "sync"],
			duration: 42,
			summaryText: "Summary text",
			transcription: true,
			transcriptPath: "/aws/sessions/test/2024/2024-05-05 Test Session.txt",
		});
		expect(result.video.name).toBe("2024-05-05 Test Session.mp4");
		expect(result.files).toEqual(["2024-05-05 Test Session.mp4"]);
	});

	it("creates an audio session item and defaults duration when missing", () => {
		const result = createSessionItem(
			"2024-05-05 Test Session",
			[file("2024-05-05 Test Session.m4a")],
			"2024",
			"test",
		);

		expect(result.type).toBe("audio");
		expect(result.typeOrder).toBe(20);
		expect(result.duration).toBe(0.5);
		expect(result.transcription).toBe(false);
		expect(result.transcriptPath).toBeNull();
		expect(result.tags).toEqual([]);
	});

	it("creates an image session item with thumbnail flag and fixed duration", () => {
		const result = createSessionItem(
			"2024-05-05 Test Session",
			[file("2024-05-05 Test Session.png")],
			"2024",
			"test",
		);

		expect(result.type).toBe("image");
		expect(result.typeOrder).toBe(30);
		expect(result.duration).toBe(0.1);
		expect(result.thumbnail).toBe(true);
		expect(result.image.name).toBe("2024-05-05 Test Session.png");
	});

	it("marks overview sessions as ai and lowers the type order", () => {
		const result = createSessionItem(
			"2024-05-05 Overview - Test",
			[file("2024-05-05 Overview - Test.mp4")],
			"2024",
			"test",
		);

		expect(result.ai).toBe(true);
		expect(result.type).toBe("overview");
		expect(result.typeOrder).toBe(5);
	});

	it("marks sessions ending in ' - AI' as ai type when there is no image", () => {
		const result = createSessionItem(
			"2024-05-05 Test Session - AI",
			[file("2024-05-05 Test Session - AI.m4a")],
			"2024",
			"test",
		);

		expect(result.ai).toBe(true);
		expect(result.type).toBe("ai");
		expect(result.typeOrder).toBe(15);
	});

	it("does not treat an image session ending in ' - AI' as ai", () => {
		const result = createSessionItem(
			"2024-05-05 Test Session - AI",
			[file("2024-05-05 Test Session - AI.png")],
			"2024",
			"test",
		);

		expect(result.ai).toBe(false);
		expect(result.type).toBe("image");
	});

	it("maps resolution-suffixed video files into a resolutions map", () => {
		const result = createSessionItem(
			"2024-05-05 Test Session",
			[
				file("2024-05-05 Test Session.mp4"),
				file("2024-05-05 Test Session_1280x720.mp4"),
				file("2024-05-05 Test Session_640x360.mp4"),
			],
			"2024",
			"test",
		);

		expect(result.video.name).toBe("2024-05-05 Test Session.mp4");
		expect(Object.keys(result.resolutions)).toEqual(
			expect.arrayContaining(["1280x720", "640x360"]),
		);
	});

	it("picks the last file when multiple audio/image/subtitle/summary files exist", () => {
		const result = createSessionItem(
			"2024-05-05 Test Session",
			[
				file("2024-05-05 Test Session.m4a"),
				file("2024-05-05 Test Session.png"),
				file("2024-05-05 Test Session.vtt"),
				file("2024-05-05 Test Session.md"),
				file("2024-05-05 Test Session.en.vtt"),
			],
			"2024",
			"test",
		);

		expect(result.subtitles.name).toBe("2024-05-05 Test Session.en.vtt");
		expect(result.summary.path).toBe(
			"sessions/test/2024/2024-05-05 Test Session.md",
		);
	});

	it("strips a leading /aws prefix from the summary path", () => {
		const result = createSessionItem(
			"2024-05-05 Test Session",
			[
				file("2024-05-05 Test Session.mp4"),
				file(
					"2024-05-05 Test Session.md",
					"/aws/sessions/test/2024/2024-05-05 Test Session.md",
				),
			],
			"2024",
			"test",
		);

		expect(result.summary.path).toBe(
			"sessions/test/2024/2024-05-05 Test Session.md",
		);
	});

	it("trims and filters trailing-dot tags", () => {
		const result = createSessionItem(
			"2024-05-05 Test Session",
			[file("2024-05-05 Test Session.mp4")],
			"2024",
			"test",
			[" tag1. ", "tag2..", "", "   ", 3],
		);

		expect(result.tags).toEqual(["tag1", "tag2", 3]);
	});

	it("handles an empty file list gracefully for the files field", () => {
		const result = createSessionItem(
			"2024-05-05 Test Session",
			[],
			"2024",
			"test",
			null,
			null,
			null,
			null,
			null,
		);

		expect(result).toBeNull();
	});
});
