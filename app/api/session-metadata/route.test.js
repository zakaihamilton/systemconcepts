import { roleAuth } from "@util/auth/roles";
import { getSessionUser } from "@util/auth/session";
import { aggregateSessionMetadata } from "@util/domain/updateSessions/sessionMetadataServer";
import { GET } from "./route";

jest.mock("@util/auth/session", () => ({
	getSessionUser: jest.fn(),
}));
jest.mock("@util/auth/roles", () => ({
	roleAuth: jest.fn(),
}));
jest.mock("@util/api/safeError", () => ({
	getSafeError: jest.fn((err) => String(err?.message || err)),
}));
jest.mock("@util/domain/updateSessions/sessionMetadataServer", () => ({
	aggregateSessionMetadata: jest.fn(),
}));
jest.mock("next/server", () => ({
	NextResponse: {
		json: (body, init = {}) => ({
			status: init.status || 200,
			json: async () => body,
			headers: {
				get: (name) => init.headers?.get?.(name) || null,
			},
		}),
	},
}));

function request(url, cookie = "id=user; hash=secret") {
	return {
		url,
		headers: {
			get: (name) => (name.toLowerCase() === "cookie" ? cookie : null),
		},
	};
}

describe("/api/session-metadata", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getSessionUser.mockResolvedValue({ id: "user", role: "student" });
		roleAuth.mockReturnValue(true);
		aggregateSessionMetadata.mockResolvedValue({
			group: "test",
			year: "2024",
			items: [],
			tags: { "2024-05-05 Test": ["ai"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});
	});

	it("authorizes metadata reads and returns the aggregated payload", async () => {
		const response = await GET(
			request("http://localhost/api/session-metadata?group=test&year=2024"),
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(getSessionUser).toHaveBeenCalled();
		expect(roleAuth).toHaveBeenCalledWith("student", "student");
		expect(aggregateSessionMetadata).toHaveBeenCalledWith({
			group: "test",
			year: "2024",
		});
		expect(body.tags["2024-05-05 Test"]).toEqual(["ai"]);
		expect(response.headers.get("Cache-Control")).toContain("no-store");
	});

	it("rejects requests without credentials before reading metadata", async () => {
		getSessionUser.mockRejectedValue("ACCESS_DENIED");

		const response = await GET(
			request("http://localhost/api/session-metadata?group=test&year=2024", ""),
		);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body.err).toBe("ACCESS_DENIED");
		expect(getSessionUser).toHaveBeenCalled();
		expect(aggregateSessionMetadata).not.toHaveBeenCalled();
	});

	it("rejects users without session metadata read access", async () => {
		roleAuth.mockReturnValue(false);

		const response = await GET(
			request("http://localhost/api/session-metadata?group=test&year=2024"),
		);

		expect(response.status).toBe(403);
		expect(aggregateSessionMetadata).not.toHaveBeenCalled();
	});
});
