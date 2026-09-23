import { downloadDataEdge } from "@util/storage/awsFetch";
import { TextEncoder } from "util";

beforeAll(() => {
	global.TextEncoder = TextEncoder;
	if (!globalThis.crypto?.subtle) {
		const nodeCrypto = require("crypto");
		Object.defineProperty(globalThis, "crypto", {
			value: nodeCrypto.webcrypto,
			configurable: true,
		});
	}
});

const originalEnv = process.env;

beforeEach(() => {
	jest.clearAllMocks();
	process.env = {
		...originalEnv,
		AWS_ENDPOINT: "sfo3.digitaloceanspaces.com",
		AWS_BUCKET: "my-bucket",
		AWS_ID: "access-key-id",
		AWS_SECRET: "secret-access-key",
	};
	global.fetch = jest.fn();
});

afterAll(() => {
	process.env = originalEnv;
});

function mockResponse({ ok = true, status = 200, text, arrayBuffer } = {}) {
	return {
		ok,
		status,
		text: text || jest.fn().mockResolvedValue("file contents"),
		arrayBuffer:
			arrayBuffer ||
			jest.fn().mockResolvedValue(new TextEncoder().encode("binary").buffer),
	};
}

describe("downloadDataEdge", () => {
	it("fetches binary content as a Uint8Array by default", async () => {
		global.fetch.mockResolvedValue(mockResponse());

		const result = await downloadDataEdge({ path: "sessions/file.bin" });

		expect(result).toBeInstanceOf(Uint8Array);
		const [url] = global.fetch.mock.calls[0];
		expect(url).toMatch(
			/^https:\/\/sfo3\.digitaloceanspaces\.com\/my-bucket\/sessions\/file\.bin\?/,
		);
		expect(url).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
		expect(url).toContain("X-Amz-Signature=");
	});

	it("fetches text content when binary is false", async () => {
		global.fetch.mockResolvedValue(
			mockResponse({ text: jest.fn().mockResolvedValue("hello text") }),
		);

		const result = await downloadDataEdge({
			path: "sessions/file.txt",
			binary: false,
		});

		expect(result).toBe("hello text");
	});

	it("strips a leading slash from the path when building the key", async () => {
		global.fetch.mockResolvedValue(mockResponse());

		await downloadDataEdge({ path: "/sessions/file.bin" });

		const [url] = global.fetch.mock.calls[0];
		expect(url).toContain("/my-bucket/sessions/file.bin?");
	});

	it("uses a custom bucket name when provided", async () => {
		global.fetch.mockResolvedValue(mockResponse());

		await downloadDataEdge({ path: "file.bin", bucketName: "other-bucket" });

		const [url] = global.fetch.mock.calls[0];
		expect(url).toContain("/other-bucket/file.bin?");
	});

	it("defaults to the DigitalOcean endpoint and adds https:// when missing a protocol", async () => {
		delete process.env.AWS_ENDPOINT;
		global.fetch.mockResolvedValue(mockResponse());

		await downloadDataEdge({ path: "file.bin" });

		const [url] = global.fetch.mock.calls[0];
		expect(url).toMatch(/^https:\/\/sfo3\.digitaloceanspaces\.com\//);
	});

	it("keeps a custom endpoint that already declares an http(s) protocol", async () => {
		process.env.AWS_ENDPOINT = "http://localhost:9000";
		global.fetch.mockResolvedValue(mockResponse());

		await downloadDataEdge({ path: "file.bin" });

		const [url] = global.fetch.mock.calls[0];
		expect(url).toMatch(/^http:\/\/localhost:9000\//);
	});

	it("throws a generic error for non-404 failures", async () => {
		global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 500 }));

		await expect(downloadDataEdge({ path: "file.bin" })).rejects.toThrow(
			'S3 fetch failed: 500 for key "file.bin"',
		);
	});

	it("throws a NoSuchKey-named error for 404 failures", async () => {
		global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 404 }));

		await expect(downloadDataEdge({ path: "file.bin" })).rejects.toMatchObject({
			name: "NoSuchKey",
		});
	});
});
