import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { roleAuth } from "@util/auth/roles";
import { getSessionUser } from "@util/auth/session";
import { getSessions } from "@util/domain/sessionFeed";
import {
	metadataInfo as awsMetadataInfo,
	getDownloadUrl as getAwsDownloadUrl,
} from "@util/storage/aws";
import {
	getWasabi,
	metadataInfo as wasabiMetadataInfo,
} from "@util/storage/wasabi";
import { GET } from "./route";

jest.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: jest.fn() }));
jest.mock("next/cache", () => ({
	unstable_cache: jest.fn((callback) => callback),
}));
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
jest.mock("next/server", () => ({
	NextResponse: {
		json: (body, init = {}) => ({
			body,
			status: init.status || 200,
			headers: init.headers || {},
			json: async () => body,
		}),
	},
}));

function request(path = "wasabi/american/2024/2024-08-26 The Serpents.mp4") {
	return { headers: { get: (name) => (name === "path" ? path : null) } };
}

describe("/api/player transcript URLs", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getSessionUser.mockResolvedValue({ id: "user", role: "student" });
		roleAuth.mockReturnValue(true);
		getWasabi.mockResolvedValue({ client: {}, bucket: "media" });
		getSignedUrl
			.mockResolvedValueOnce("https://wasabi.example/player")
			.mockResolvedValueOnce("https://wasabi.example/download");
		getAwsDownloadUrl.mockResolvedValue("https://aws.example/transcript");
		awsMetadataInfo.mockResolvedValue(null);
		wasabiMetadataInfo.mockResolvedValue({ type: "image/jpeg" });
		getSessions.mockResolvedValue([]);
	});

	it("signs an explicit transcript against AWS while media stays on Wasabi", async () => {
		getSessions.mockResolvedValue([
			{
				group: "american",
				year: "2024",
				id: "2024-08-26 The Serpents",
				transcriptPath:
					"/aws/sessions/american/2024/2024-08-26 The Serpents.txt",
			},
		]);
		awsMetadataInfo.mockImplementation(async ({ path }) =>
			path.endsWith("The Serpents.txt") ? { type: "text/plain" } : null,
		);

		const response = await GET(request());

		expect(await response.json()).toMatchObject({
			path: "https://wasabi.example/player",
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

	it("signs the inferred same-name transcript against AWS", async () => {
		awsMetadataInfo.mockImplementation(async ({ path }) =>
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
			path: "https://wasabi.example/player",
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
		wasabiMetadataInfo.mockResolvedValue(null);
		awsMetadataInfo.mockResolvedValue({ type: "image/png" });
		getAwsDownloadUrl
			.mockResolvedValueOnce("https://aws.example/image")
			.mockResolvedValueOnce("https://aws.example/download");

		const response = await GET(
			request("wasabi/will/2026/2026-06-30 Beastly.png"),
		);

		expect(await response.json()).toMatchObject({
			path: "https://aws.example/image",
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
	});

	it("signs AWS images against AWS without using Wasabi", async () => {
		getAwsDownloadUrl
			.mockResolvedValueOnce("https://aws.example/image")
			.mockResolvedValueOnce("https://aws.example/download");

		const response = await GET(
			request("/aws/sessions/will/2026/2026-06-30 Beastly.png"),
		);

		expect(await response.json()).toMatchObject({
			path: "https://aws.example/image",
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
});
