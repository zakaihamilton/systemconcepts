import { roleAuth } from "./roles";

describe("roleAuth", () => {
	it("returns true when the role level is equal to the compared level", () => {
		expect(roleAuth("teacher", "teacher")).toBe(true);
	});

	it("returns true when the role level is higher than the compared level", () => {
		expect(roleAuth("admin", "student")).toBe(true);
	});

	it("returns false when the role level is lower than the compared level", () => {
		expect(roleAuth("visitor", "teacher")).toBe(false);
	});

	it("returns false when the role id is unknown", () => {
		expect(roleAuth("unknown", "student")).toBe(false);
	});

	it("returns false when the compared id is unknown", () => {
		expect(roleAuth("student", "unknown")).toBe(false);
	});
});
