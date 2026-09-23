import {
	getSProxyUrl,
	getTranscriptProxyUrlFast,
} from "@util/domain/sessionFeedEdge";
import { buildSessionsJson } from "./sessionsApiResponse";

jest.mock("@util/domain/sessionFeedEdge", () => ({
	getSProxyUrl: jest.fn(),
	getTranscriptProxyUrlFast: jest.fn(),
	sortSessions: jest.fn((sessions) => sessions),
}));

describe("buildSessionsJson", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getSProxyUrl.mockImplementation(async (path: any) => `https://cdn/${path}`);
		getTranscriptProxyUrlFast.mockImplementation(async (session: any) =>
			session.transcription ? "https://cdn/transcript.txt" : null,
		);
	});

	it("awaits signed media URLs before serializing the API response", async () => {
		const body = await buildSessionsJson({
			sessions: [
				{
					id: "2026-06-01 The Good Servant",
					group: "jeff",
					year: "2026",
					date: "2026-06-01",
					name: "The Good Servant",
					duration: 3519.4,
					image: { path: "sessions/jeff/2026/cover.jpg" },
					transcription: true,
				},
			],
			baseUrl: "https://systemconcepts.app",
		});

		expect(JSON.parse(body)).toEqual([
			{
				id: "2026-06-01 The Good Servant",
				group: "jeff",
				year: "2026",
				date: "2026-06-01",
				name: "The Good Servant",
				duration: 3519,
				tags: [],
				summaryText: null,
				imageUrl: "https://cdn/sessions/jeff/2026/cover.jpg",
				transcriptionUrl: "https://cdn/transcript.txt",
			},
		]);
		expect(getSProxyUrl).toHaveBeenCalledWith(
			"sessions/jeff/2026/cover.jpg",
			"https://systemconcepts.app",
		);
		expect(getTranscriptProxyUrlFast).toHaveBeenCalledWith(
			expect.objectContaining({ id: "2026-06-01 The Good Servant" }),
			"https://systemconcepts.app",
		);
	});

	it("serializes missing media URLs as null instead of empty objects", async () => {
		const body = await buildSessionsJson({
			sessions: [
				{
					id: "2026-09-15 Groundhog Day",
					group: "jeff",
					year: "2026",
					date: "2026-09-15",
					name: "Groundhog Day",
				},
			],
			baseUrl: "https://systemconcepts.app",
		});

		expect(JSON.parse(body)[0]).toEqual(
			expect.objectContaining({ imageUrl: null, transcriptionUrl: null }),
		);
	});
});
