import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import {
	createRssMediaToken,
	createRssMediaUrl,
	isPublicRssMediaPath,
	verifyRssMediaToken,
} from "./rssMediaToken";

describe("RSS media capabilities", () => {
	const originalEnv = process.env;

	beforeAll(() => {
		Object.defineProperty(global, "crypto", {
			value: webcrypto,
			configurable: true,
		});
		Object.defineProperty(global, "TextEncoder", {
			value: TextEncoder,
			configurable: true,
		});
		process.env = { ...originalEnv, RSS_MEDIA_SECRET: "test-rss-media-secret" };
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	it("accepts a valid token only for its route and path", async () => {
		const resource = "sessions/alpha/2025/session.mp3";
		const token = await createRssMediaToken({
			route: "media",
			resource,
			now: 0,
		});

		await expect(
			verifyRssMediaToken({
				route: "media",
				resource,
				expiresAt: token.expiresAt,
				signature: token.signature,
				now: 1,
			}),
		).resolves.toBe(true);
		await expect(
			verifyRssMediaToken({
				route: "media",
				resource: "sessions/alpha/2025/other.mp3",
				expiresAt: token.expiresAt,
				signature: token.signature,
				now: 1,
			}),
		).resolves.toBe(false);
		await expect(
			verifyRssMediaToken({
				route: "transcript",
				resource,
				expiresAt: token.expiresAt,
				signature: token.signature,
				now: 1,
			}),
		).resolves.toBe(false);
	});

	it("rejects expired capabilities and non-public paths", async () => {
		const token = await createRssMediaToken({
			route: "media",
			resource: "sessions/alpha/file.mp3",
			now: 0,
		});
		expect(token.expiresAt).toBe(24 * 60 * 60);
		await expect(
			verifyRssMediaToken({
				route: "media",
				resource: "sessions/alpha/file.mp3",
				expiresAt: token.expiresAt,
				signature: token.signature,
				now: token.expiresAt * 1000,
			}),
		).resolves.toBe(false);
		expect(isPublicRssMediaPath("personal/alice/private.mp3")).toBe(false);
		expect(isPublicRssMediaPath("private/secret.mp3")).toBe(false);
		expect(isPublicRssMediaPath("sessions/../personal/alice.mp3")).toBe(false);
	});

	it("validates public path edge cases", () => {
		expect(isPublicRssMediaPath("")).toBe(false);
		expect(isPublicRssMediaPath(null)).toBe(false);
		expect(isPublicRssMediaPath("sessions/\0bad")).toBe(false);
		expect(isPublicRssMediaPath("/sessions/ok.mp3")).toBe(true);
		expect(isPublicRssMediaPath("wasabi/ok.mp3")).toBe(true);
	});

	it("rejects create for invalid paths and verify for bad signatures", async () => {
		await expect(
			createRssMediaToken({ route: "media", resource: "private/x" }),
		).rejects.toThrow("INVALID_MEDIA_PATH");

		await expect(
			verifyRssMediaToken({
				route: "media",
				resource: "sessions/a.mp3",
				expiresAt: "not-a-number",
				signature: "abc",
			}),
		).resolves.toBe(false);

		await expect(
			verifyRssMediaToken({
				route: "media",
				resource: "sessions/a.mp3",
				expiresAt: Math.floor(Date.now() / 1000) + 100,
				signature: "short",
			}),
		).resolves.toBe(false);

		await expect(
			verifyRssMediaToken({
				route: "media",
				resource: "private/x",
				expiresAt: 999999,
				signature: "a".repeat(32),
			}),
		).resolves.toBe(false);
	});

	it("builds media and transcript URLs with optional extension", async () => {
		const mediaUrl = await createRssMediaUrl({
			baseUrl: "https://example.com",
			route: "media",
			path: "/sessions/a.mp3",
			extension: "mp3",
		});
		expect(mediaUrl).toContain("https://example.com/api/rss/s?");
		expect(mediaUrl).toContain("e=mp3");

		const transcriptUrl = await createRssMediaUrl({
			baseUrl: "https://example.com",
			route: "transcript",
			path: "sessions/a.vtt",
		});
		expect(transcriptUrl).toContain("/api/rss/transcription?");
		expect(transcriptUrl).not.toContain("e=");
	});

	it("uses the development secret when RSS_MEDIA_SECRET is unset outside production", async () => {
		process.env = { ...originalEnv };
		delete process.env.RSS_MEDIA_SECRET;
		process.env.NODE_ENV = "test";
		const token = await createRssMediaToken({
			route: "media",
			resource: "sessions/dev.mp3",
		});
		expect(token.signature).toBeTruthy();
		process.env = { ...originalEnv, RSS_MEDIA_SECRET: "test-rss-media-secret" };
	});

	it("throws in production when RSS_MEDIA_SECRET is missing", async () => {
		process.env = { ...originalEnv, NODE_ENV: "production" };
		delete process.env.RSS_MEDIA_SECRET;
		await expect(
			createRssMediaToken({ route: "media", resource: "sessions/a.mp3" }),
		).rejects.toThrow("RSS_MEDIA_SECRET_NOT_CONFIGURED");
		process.env = { ...originalEnv, RSS_MEDIA_SECRET: "test-rss-media-secret" };
	});
});
