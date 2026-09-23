import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { roleAuth } from "@util/auth/roles";
import { getSessionUser } from "@util/auth/session";
import { getSessions } from "@util/domain/sessionFeed";
import {
	metadataInfo as awsMetadataInfo,
	getDownloadUrl as getAwsDownloadUrl,
} from "@util/storage/aws";
import { isProductionDeployment } from "@util/storage/storageRedirect";
import {
	getWasabi,
	metadataInfo as wasabiMetadataInfo,
} from "@util/storage/wasabi";
import { GET } from "./route";

jest.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: jest.fn() }));
jest.mock("@util/auth/session", () => ({
	getSessionUser: jest.fn(),
	getAuthErrorStatus: jest.fn(() => 403),
}));
jest.mock("@util/auth/roles", () => ({ roleAuth: jest.fn() }));
jest.mock("@util/api/logger", () => ({
	error: jest.fn(),
	log: jest.fn(),
	logger: { warn: jest.fn() },
}));
jest.mock("@util/api/safeError", () => ({
	getSafeError: jest.fn((err) => String(err?.message || err)),
}));
jest.mock("@util/domain/sessionFeed", () => ({ getSessions: jest.fn() }));
jest.mock("@util/storage/aws", () => ({
	getDownloadUrl: jest.fn(),
	metadataInfo: jest.fn(),
	validatePathAccess: jest.fn(),
}));
jest.mock("@util/storage/wasabi", () => ({
	getWasabi: jest.fn(),
	metadataInfo: jest.fn(),
}));
jest.mock("@util/storage/storageRedirect", () => ({
	isProductionDeployment: jest.fn(),
}));
jest.mock("next/server", () => ({
	NextResponse: {
		json: (body: any, init: ResponseInit = {}) => ({
			body,
			status: init.status || 200,
			headers: init.headers || {},
			json: async () => body,
		}),
	},
}));

function request(
	path = "wasabi/american/2024/2024-08-26 The Serpents.mp4",
	url = "https://systemconcepts.app/api/player",
) {
	const host = new URL(url).host;
	return {
		url,
		headers: {
			get: (name: any) => {
				if (name === "path") return path;
				if (name === "host") return host;
				return null;
			},
		},
	};
}

describe("/api/player transcript URLs", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		asMock(isProductionDeployment).mockReturnValue(true);
		asMock(getSessionUser).mockResolvedValue({ id: "user", role: "student" });
		asMock(roleAuth).mockReturnValue(true);
		asMock(getWasabi).mockResolvedValue({ client: {}, bucket: "media" });
		asMock(getSignedUrl).mockResolvedValue("https://wasabi.example/download");
		asMock(getAwsDownloadUrl).mockResolvedValue(
			"https://aws.example/transcript",
		);
		asMock(awsMetadataInfo).mockResolvedValue(null);
		asMock(wasabiMetadataInfo).mockResolvedValue({ type: "image/jpeg" });
		asMock(getSessions).mockResolvedValue([]);
	});

	it("signs an explicit transcript against AWS while media stays on Wasabi", async () => {
		asMock(getSessions).mockResolvedValue([
			{
				group: "american",
				year: "2024",
				id: "2024-08-26 The Serpents",
				transcriptPath:
					"/aws/sessions/american/2024/2024-08-26 The Serpents.txt",
			},
		]);
		asMock(awsMetadataInfo).mockImplementation(async ({ path }: any) =>
			path.endsWith("The Serpents.txt") ? { type: "text/plain" } : null,
		);

		const response = await GET(request());

		expect(await response.json()).toMatchObject({
			path: "https://wasabi.example/download",
			downloadUrl: "https://wasabi.example/download",
			transcriptionUrl: "https://aws.example/transcript",
		});
		expect(getSignedUrl).toHaveBeenCalledTimes(2);
		expect(getAwsDownloadUrl).toHaveBeenCalledWith({
			path: "sessions/american/2024/2024-08-26 The Serpents.txt",
			expiresIn: 10800,
			responseContentDisposition:
				'attachment; filename="2024-08-26 The Serpents.txt"',
		});
	});

	it("generates a new signed media URL for every request", async () => {
		asMock(getSignedUrl)
			.mockResolvedValueOnce("https://wasabi.example/first")
			.mockResolvedValueOnce("https://wasabi.example/first-download")
			.mockResolvedValueOnce("https://wasabi.example/renewed")
			.mockResolvedValueOnce("https://wasabi.example/renewed-download");

		const first = await GET(request());
		const renewed = await GET(request());

		expect((await first.json()).path).toBe("https://wasabi.example/first");
		expect((await renewed.json()).path).toBe("https://wasabi.example/renewed");
	});

	it("streams media through the local function instead of exposing a signed URL", async () => {
		asMock(isProductionDeployment).mockReturnValue(false);
		const localRequest = request(undefined, "http://localhost:3000/api/player");

		const response = await GET(localRequest);

		expect((await response.json()).path).toBe(
			"http://localhost:3000/api/player/media?path=wasabi%2Famerican%2F2024%2F2024-08-26%20The%20Serpents.mp4",
		);
		expect(getSignedUrl).toHaveBeenCalledTimes(1);
	});

	it("signs the inferred same-name transcript against AWS", async () => {
		asMock(awsMetadataInfo).mockImplementation(async ({ path }: any) =>
			path.endsWith("The Serpents.txt") ? { type: "text/plain" } : null,
		);

		const response = await GET(request());

		expect((await response.json()).transcriptionUrl).toBe(
			"https://aws.example/transcript",
		);
		expect(getAwsDownloadUrl).toHaveBeenCalledWith(
			expect.objectContaining({
				path: "sessions/american/2024/2024-08-26 The Serpents.txt",
			}),
		);
	});

	it("returns no transcript URL when the AWS transcript is missing", async () => {
		const response = await GET(request());

		expect((await response.json()).transcriptionUrl).toBeNull();
		expect(getAwsDownloadUrl).not.toHaveBeenCalled();
		expect(getSignedUrl).toHaveBeenCalledTimes(2);
	});

	it("signs images on Wasabi without looking up or signing a transcript", async () => {
		const response = await GET(
			request("wasabi/american/2024/2024-08-26 The Serpents.jpg"),
		);

		expect(await response.json()).toMatchObject({
			path: "https://wasabi.example/download",
			downloadUrl: "https://wasabi.example/download",
			subtitles: null,
			transcriptionUrl: null,
		});
		expect(getSignedUrl).toHaveBeenCalledTimes(2);
		expect(getSessions).not.toHaveBeenCalled();
		expect(awsMetadataInfo).not.toHaveBeenCalled();
		expect(wasabiMetadataInfo).toHaveBeenCalledWith({
			path: "american/2024/2024-08-26 The Serpents.jpg",
		});
		expect(getAwsDownloadUrl).not.toHaveBeenCalled();
	});

	it("falls back to AWS when stale metadata points an image at Wasabi", async () => {
		asMock(wasabiMetadataInfo).mockResolvedValue(null);
		asMock(awsMetadataInfo).mockResolvedValue({ type: "image/png" });
		asMock(getAwsDownloadUrl).mockResolvedValue("https://aws.example/download");

		const response = await GET(
			request("wasabi/will/2026/2026-06-30 Beastly.png"),
		);

		expect(await response.json()).toMatchObject({
			path: "https://aws.example/download",
			downloadUrl: "https://aws.example/download",
			transcriptionUrl: null,
		});
		expect(getWasabi).not.toHaveBeenCalled();
		expect(getSignedUrl).not.toHaveBeenCalled();
		expect(awsMetadataInfo).toHaveBeenCalledWith({
			path: "sessions/will/2026/2026-06-30 Beastly.png",
		});
		expect(getAwsDownloadUrl).toHaveBeenNthCalledWith(1, {
			path: "sessions/will/2026/2026-06-30 Beastly.png",
			expiresIn: 10800,
			responseContentDisposition: "inline",
		});
		expect(getAwsDownloadUrl).toHaveBeenNthCalledWith(2, {
			path: "sessions/will/2026/2026-06-30 Beastly.png",
			expiresIn: 10800,
			responseContentDisposition:
				'attachment; filename="2026-06-30 Beastly.png"',
		});
	});

	it("signs AWS images against AWS without using Wasabi", async () => {
		asMock(getAwsDownloadUrl).mockResolvedValue("https://aws.example/download");

		const response = await GET(
			request("/aws/sessions/will/2026/2026-06-30 Beastly.png"),
		);

		expect(await response.json()).toMatchObject({
			path: "https://aws.example/download",
			downloadUrl: "https://aws.example/download",
			transcriptionUrl: null,
		});
		expect(getWasabi).not.toHaveBeenCalled();
		expect(getSignedUrl).not.toHaveBeenCalled();
		expect(getAwsDownloadUrl).toHaveBeenNthCalledWith(1, {
			path: "sessions/will/2026/2026-06-30 Beastly.png",
			expiresIn: 10800,
			responseContentDisposition: "inline",
		});
		expect(getAwsDownloadUrl).toHaveBeenNthCalledWith(2, {
			path: "sessions/will/2026/2026-06-30 Beastly.png",
			expiresIn: 10800,
			responseContentDisposition:
				'attachment; filename="2026-06-30 Beastly.png"',
		});
	});

	it("returns subtitles when a matching VTT exists on AWS", async () => {
		asMock(awsMetadataInfo).mockImplementation(async ({ path }: any) => {
			if (path.endsWith(".vtt")) return { type: "text/vtt" };
			return null;
		});
		const response = await GET(request());
		expect((await response.json()).subtitles).toBe(
			"/api/subtitle?path=" +
				encodeURIComponent(
					"sessions/american/2024/2024-08-26 The Serpents.vtt",
				),
		);
	});

	it("strips resolution suffixes when resolving transcript metadata", async () => {
		asMock(getSessions).mockResolvedValue([
			{
				group: "american",
				year: "2024",
				id: "2024-08-26 The Serpents",
				transcriptPath:
					"/aws/sessions/american/2024/2024-08-26 The Serpents.txt",
			},
		]);
		asMock(awsMetadataInfo).mockImplementation(async ({ path }: any) =>
			path.endsWith(".txt") ? { type: "text/plain" } : null,
		);
		await GET(
			request("sessions/american/2024/2024-08-26 The Serpents_1280x720.mp4"),
		);
		expect(getSessions).toHaveBeenCalledWith({ group: "american" });
	});

	it("warns and continues when session transcript lookup fails", async () => {
		const { logger } = require("@util/api/logger");
		asMock(getSessions).mockRejectedValue(new Error("feed down"));
		await GET(request());
		expect(logger.warn).toHaveBeenCalled();
	});

	it("returns an auth error when the user is not allowed", async () => {
		asMock(getSessionUser).mockResolvedValue(null);
		const response = await GET(request());
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ err: "ACCESS_DENIED" });
	});

	it("uses signed Wasabi URLs in production instead of proxying media", async () => {
		asMock(isProductionDeployment).mockReturnValue(true);

		const response = await GET(
			request(undefined, "https://systemconcepts.app/api/player"),
		);

		expect((await response.json()).path).toBe(
			"https://wasabi.example/download",
		);
		expect(getSignedUrl).toHaveBeenCalledTimes(2);
	});

	it("uses explicit session subtitle paths ending in .vtt", async () => {
		asMock(getSessions).mockResolvedValue([
			{
				group: "american",
				year: "2024",
				id: "2024-08-26 The Serpents",
				subtitles: {
					path: "/aws/sessions/american/2024/2024-08-26 The Serpents.vtt",
				},
			},
		]);
		asMock(awsMetadataInfo).mockImplementation(async ({ path }: any) =>
			path.endsWith(".vtt") ? { type: "text/vtt" } : null,
		);

		const response = await GET(request());

		expect((await response.json()).subtitles).toBe(
			"/api/subtitle?path=" +
				encodeURIComponent(
					"sessions/american/2024/2024-08-26 The Serpents.vtt",
				),
		);
	});

	it("uses explicit session transcript paths ending in .txt", async () => {
		asMock(getSessions).mockResolvedValue([
			{
				group: "american",
				year: "2024",
				id: "2024-08-26 The Serpents",
				transcriptPath: "wasabi/american/2024/2024-08-26 The Serpents.txt",
			},
		]);
		asMock(awsMetadataInfo).mockImplementation(async ({ path }: any) =>
			path.endsWith(".txt") ? { type: "text/plain" } : null,
		);

		const response = await GET(request());

		expect((await response.json()).transcriptionUrl).toBe(
			"https://aws.example/transcript",
		);
	});

	it("returns no transcript metadata when the session lookup finds no match", async () => {
		asMock(getSessions).mockResolvedValue([
			{
				group: "american",
				year: "2024",
				id: "other-session",
				transcriptPath: "/aws/sessions/american/2024/other.txt",
			},
		]);

		const response = await GET(request());

		expect((await response.json()).transcriptionUrl).toBeNull();
	});

	it("returns an auth error when session lookup is rejected", async () => {
		asMock(getSessionUser).mockRejectedValue("AUTHENTICATION_REQUIRED");

		const response = await GET(request());

		expect(response.status).toBe(403);
	});
});
