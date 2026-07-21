import { toSessionListItem } from "./sessionListItem";

describe("toSessionListItem", () => {
	it("keeps list and detail fields without retaining heavy session content", () => {
		const item = toSessionListItem(
			{
				id: "session-1",
				name: "Session",
				date: "2026-01-01",
				year: "2026",
				group: "american",
				type: "video",
				duration: 30,
				image: { path: "/aws/image.png", bytes: "large image metadata" },
				summary: { path: "summaries/session.md", text: "large summary" },
				description: "large description",
				summaryText: "large inline summary",
				video: { path: "video.mp4" },
				audio: { path: "audio.m4a" },
				files: ["session.txt", "session.vtt", "session.mp4"],
			},
			{ cdn: { url: "https://cdn.example" }, groupInfo: { color: "blue" } },
		);

		expect(item).toMatchObject({
			id: "session-1",
			image: { path: "/aws/image.png" },
			summary: { path: "summaries/session.md" },
			color: "blue",
			video: true,
			audio: true,
			files: ["session.txt", "session.vtt"],
		});
		expect(item).not.toHaveProperty("description");
		expect(item).not.toHaveProperty("summaryText");
	});

	it("drops legacy base64 thumbnails and uses the source image path", () => {
		const item = toSessionListItem({
			id: "session-1",
			name: "Session",
			image: { path: "/aws/sessions/group/2026/session.jpg" },
			thumbnail: "data:image/webp;base64,large-thumbnail",
		});

		expect(item.thumbnail).toBe("/aws/sessions/group/2026/session.jpg");
		expect(item.thumbnail).not.toContain("data:image");
	});
});
