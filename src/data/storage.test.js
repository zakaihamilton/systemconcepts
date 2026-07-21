jest.mock("js-cookie");
jest.mock("@storage/aws", () => ({ provider: "aws" }));
jest.mock("@storage/local", () => ({ provider: "local" }));
jest.mock("@storage/wasabi", () => ({ provider: "wasabi" }));
jest.mock("@storage/remote", () => jest.fn(() => ({ provider: "remote" })));

describe("data/storage device registry", () => {
	let devices;
	let cookies;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		cookies = require("js-cookie");
		devices = require("./storage").default;
	});

	it("registers local storage as always enabled", () => {
		const local = devices.find((device) => device.id === "local");
		expect(local).toMatchObject({
			id: "local",
			name: "Local",
			enabled: true,
			provider: "local",
		});
	});

	it("disables personal, aws, and wasabi without auth cookies", () => {
		cookies.get.mockReturnValue(undefined);
		expect(devices.find((d) => d.id === "personal").enabled()).toBeFalsy();
		expect(devices.find((d) => d.id === "aws").enabled()).toBeFalsy();
		expect(devices.find((d) => d.id === "wasabi").enabled()).toBeFalsy();
	});

	it("enables personal, aws, and wasabi when id and hash cookies exist", () => {
		cookies.get.mockImplementation((key) =>
			key === "id" ? "user-1" : key === "hash" ? "session-hash" : undefined,
		);
		expect(devices.find((d) => d.id === "personal").enabled()).toBeTruthy();
		expect(devices.find((d) => d.id === "aws").enabled()).toBeTruthy();
		expect(devices.find((d) => d.id === "wasabi").enabled()).toBeTruthy();
	});

	it("wires remote personal storage with the personal endpoint", () => {
		const remote = require("@storage/remote");
		const personal = devices.find((device) => device.id === "personal");
		expect(remote).toHaveBeenCalledWith({
			fsEndPoint: "/api/personal",
			deviceId: "personal",
		});
		expect(personal.provider).toBe("remote");
	});
});
