import { blobToBase64, shrinkImage, thumbnailify } from "./image";

describe("thumbnailify", () => {
	const originalImage = global.Image;
	const originalCreateElement = document.createElement.bind(document);
	let canvasMock;
	let toBlobMock;
	let createElementSpy;

	beforeEach(() => {
		toBlobMock = jest.fn((callback) =>
			callback(new Blob(["thumb"], { type: "image/webp" })),
		);
		canvasMock = {
			width: 0,
			height: 0,
			getContext: jest.fn(() => ({ drawImage: jest.fn() })),
			toBlob: toBlobMock,
		};
		createElementSpy = jest
			.spyOn(document, "createElement")
			.mockImplementation((tag) => {
				if (tag === "canvas") return canvasMock;
				return originalCreateElement(tag);
			});
	});

	afterEach(() => {
		global.Image = originalImage;
		createElementSpy.mockRestore();
	});

	it("scales the image down to fit within maxSize", async () => {
		global.Image = class {
			set src(_value) {
				this.width = 1200;
				this.height = 600;
				this.onload();
			}
		};

		const result = await thumbnailify("data:image/png;base64,AAAA", 600);

		expect(result).toBeInstanceOf(Blob);
		expect(canvasMock.width).toBe(600);
		expect(canvasMock.height).toBe(300);
		expect(toBlobMock).toHaveBeenCalledWith(
			expect.any(Function),
			"image/webp",
			0.8,
		);
	});

	it("does not upscale an image smaller than maxSize", async () => {
		global.Image = class {
			set src(_value) {
				this.width = 100;
				this.height = 50;
				this.onload();
			}
		};

		await thumbnailify("data:image/png;base64,AAAA", 600);

		expect(canvasMock.width).toBe(100);
		expect(canvasMock.height).toBe(50);
	});

	it("rejects when the image fails to load", async () => {
		global.Image = class {
			set src(_value) {
				this.onerror();
			}
		};

		await expect(thumbnailify("bad-data")).rejects.toThrow(
			"Failed to load image for thumbnail generation",
		);
	});
});

describe("shrinkImage", () => {
	const originalImage = global.Image;
	const originalFileReader = global.FileReader;
	const originalCreateElement = document.createElement.bind(document);
	let createElementSpy;

	beforeEach(() => {
		createElementSpy = jest
			.spyOn(document, "createElement")
			.mockImplementation((tag) => {
				if (tag === "canvas") {
					return {
						width: 0,
						height: 0,
						getContext: () => ({ drawImage: jest.fn() }),
						toBlob: (callback) =>
							callback(new Blob(["thumb"], { type: "image/webp" })),
					};
				}
				return originalCreateElement(tag);
			});
		global.Image = class {
			set src(_value) {
				this.width = 100;
				this.height = 100;
				this.onload();
			}
		};
	});

	afterEach(() => {
		global.Image = originalImage;
		global.FileReader = originalFileReader;
		createElementSpy.mockRestore();
	});

	it("resolves with a thumbnail blob once the buffer is read", async () => {
		global.FileReader = class {
			addEventListener(event, handler) {
				this[`on${event}`] = handler;
			}
			readAsDataURL(_buffer) {
				this.result = "data:image/png;base64,AAAA";
				this.onload();
			}
		};

		const result = await shrinkImage(new Blob(["source"]));
		expect(result).toBeInstanceOf(Blob);
	});

	it("rejects when reading the buffer fails", async () => {
		global.FileReader = class {
			addEventListener(event, handler) {
				this[`on${event}`] = handler;
			}
			readAsDataURL(_buffer) {
				this.onerror(new Error("read failed"));
			}
		};

		await expect(shrinkImage(new Blob(["source"]))).rejects.toBeInstanceOf(
			Error,
		);
	});
});

describe("blobToBase64", () => {
	const originalFileReader = global.FileReader;

	afterEach(() => {
		global.FileReader = originalFileReader;
	});

	it("resolves with the base64 data URL", async () => {
		global.FileReader = class {
			readAsDataURL(_blob) {
				this.result = "data:image/png;base64,AAAA";
				this.onloadend();
			}
		};

		const result = await blobToBase64(new Blob(["source"]));
		expect(result).toBe("data:image/png;base64,AAAA");
	});

	it("rejects when the blob cannot be read", async () => {
		global.FileReader = class {
			readAsDataURL(_blob) {
				this.onerror();
			}
		};

		await expect(blobToBase64(new Blob(["source"]))).rejects.toThrow(
			"Failed to convert blob to base64",
		);
	});
});
