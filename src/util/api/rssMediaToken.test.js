import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import {
	createRssMediaToken,
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
});
