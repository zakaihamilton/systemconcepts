import { logger as structuredLogger } from "@util/api/logger";
import { exportData, exportFile, importData } from "@util/storage/importExport";

jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe("exportData", () => {
	let clickSpy;
	let appendSpy;
	let removeSpy;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useRealTimers();
		global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
		global.URL.revokeObjectURL = jest.fn();
		clickSpy = jest
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});
		appendSpy = jest.spyOn(document.body, "appendChild");
		removeSpy = jest.spyOn(document.body, "removeChild");
		delete window.navigator.msSaveOrOpenBlob;
	});

	afterEach(() => {
		clickSpy.mockRestore();
		appendSpy.mockRestore();
		removeSpy.mockRestore();
	});

	it("creates a download link for typed data via a Blob object URL", async () => {
		exportData("hello world", "greeting.txt", "text/plain");

		expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
		expect(clickSpy).toHaveBeenCalledTimes(1);
		const anchor = appendSpy.mock.calls[0][0];
		expect(anchor.download).toBe("greeting.txt");
		expect(anchor.href).toBe("blob:mock-url");

		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(removeSpy).toHaveBeenCalledWith(anchor);
		expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
	});

	it("passes untyped data straight through to createObjectURL", () => {
		const blob = new Blob(["raw"], { type: "text/plain" });
		exportData(blob, "raw.txt");

		expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
	});

	it("decodes base64-encoded gzip payloads before exporting", () => {
		const base64 = "H4sIAAA=";
		exportData(base64, "archive.gz", "application/gzip");

		const [passed] = URL.createObjectURL.mock.calls[0][0].constructor
			? [URL.createObjectURL.mock.calls[0][0]]
			: [];
		expect(passed).toBeInstanceOf(Blob);
	});

	it("logs and falls back to the original string when base64 decoding fails", () => {
		global.atob = () => {
			throw new Error("invalid base64");
		};
		exportData("H4sInotvalid", "archive.gz", "application/gzip");

		expect(structuredLogger.error).toHaveBeenCalledWith(
			"Failed to decode base64 data:",
			expect.any(Error),
		);
		expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
	});

	it("uses msSaveOrOpenBlob when available instead of an anchor download", () => {
		window.navigator.msSaveOrOpenBlob = jest.fn();

		exportData("hello", "greeting.txt", "text/plain");

		expect(window.navigator.msSaveOrOpenBlob).toHaveBeenCalledWith(
			expect.any(Blob),
			"greeting.txt",
		);
		expect(appendSpy).not.toHaveBeenCalled();
	});
});

describe("exportFile", () => {
	let clickSpy;
	let appendSpy;
	let removeSpy;

	beforeEach(() => {
		jest.useRealTimers();
		clickSpy = jest
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});
		appendSpy = jest.spyOn(document.body, "appendChild");
		removeSpy = jest.spyOn(document.body, "removeChild");
	});

	afterEach(() => {
		clickSpy.mockRestore();
		appendSpy.mockRestore();
		removeSpy.mockRestore();
	});

	it("triggers a direct download of the given URL and cleans up the anchor", async () => {
		exportFile("https://example.com/file.pdf", "file.pdf");

		expect(clickSpy).toHaveBeenCalledTimes(1);
		const anchor = appendSpy.mock.calls[0][0];
		expect(anchor.href).toBe("https://example.com/file.pdf");
		expect(anchor.download).toBe("file.pdf");

		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(removeSpy).toHaveBeenCalledWith(anchor);
	});
});

describe("importData", () => {
	let clickSpy;

	beforeEach(() => {
		clickSpy = jest
			.spyOn(HTMLInputElement.prototype, "click")
			.mockImplementation(function () {
				this.dispatchEvent(new Event("change"));
			});
	});

	afterEach(() => {
		clickSpy.mockRestore();
	});

	it("resolves with the selected file's name and text contents", async () => {
		const file = new File(["file contents"], "notes.txt", {
			type: "text/plain",
		});
		let capturedInput;
		const originalCreateElement = document.createElement.bind(document);
		jest.spyOn(document, "createElement").mockImplementation((tag) => {
			const el = originalCreateElement(tag);
			if (tag === "input") {
				capturedInput = el;
				Object.defineProperty(el, "files", { value: [file] });
			}
			return el;
		});

		const result = await importData();

		expect(result).toEqual({ name: "notes.txt", body: "file contents" });
		expect(capturedInput.type).toBe("file");

		document.createElement.mockRestore();
	});

	it("rejects when the file reader errors out", async () => {
		const readerError = new Error("read failure");
		class FakeFileReader {
			readAsText() {
				setTimeout(() => {
					this.error = readerError;
					this.onerror?.();
				}, 0);
			}
		}
		const originalFileReader = global.FileReader;
		global.FileReader = FakeFileReader;

		const originalCreateElement = document.createElement.bind(document);
		jest.spyOn(document, "createElement").mockImplementation((tag) => {
			const el = originalCreateElement(tag);
			if (tag === "input") {
				Object.defineProperty(el, "files", {
					value: [new File(["x"], "bad.txt")],
				});
			}
			return el;
		});

		await expect(importData()).rejects.toBe(readerError);

		document.createElement.mockRestore();
		global.FileReader = originalFileReader;
	});

	it("rejects when the file reader is aborted", async () => {
		class FakeFileReader {
			readAsText() {
				setTimeout(() => {
					this.onabort?.();
				}, 0);
			}
		}
		const originalFileReader = global.FileReader;
		global.FileReader = FakeFileReader;

		const originalCreateElement = document.createElement.bind(document);
		jest.spyOn(document, "createElement").mockImplementation((tag) => {
			const el = originalCreateElement(tag);
			if (tag === "input") {
				Object.defineProperty(el, "files", {
					value: [new File(["x"], "bad.txt")],
				});
			}
			return el;
		});

		await expect(importData()).rejects.toBeUndefined();

		document.createElement.mockRestore();
		global.FileReader = originalFileReader;
	});
});
