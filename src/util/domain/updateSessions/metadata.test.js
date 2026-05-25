import { readBinary } from "@util/data/binary";
import storage from "@util/storage/storage";
import JSZip from "jszip";
import { loadTranscriptions } from "./metadata";

jest.mock("@util/data/binary", () => ({
	readBinary: jest.fn(),
}));

jest.mock("@util/storage/storage", () => ({
	exists: jest.fn(),
	readFile: jest.fn(),
}));

describe("update session metadata", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("loads transcription zip entries by session id when the zip contains folders", async () => {
		const zip = new JSZip();
		zip.file(
			"Transcriptions/2024-05-05 Test Session.TXT",
			"Transcript content",
		);
		zip.file("__MACOSX/Transcriptions/._2024-05-05 Test Session.TXT", "");

		const blob = await zip.generateAsync({ type: "blob" });

		storage.exists.mockResolvedValue(true);
		readBinary.mockResolvedValue(blob);

		const transcriptions = await loadTranscriptions(
			{ name: "2024" },
			"test",
			"/aws/sessions/test",
			true,
			false,
			false,
		);

		expect(transcriptions["2024-05-05 Test Session"]).toBe(true);
		expect(
			transcriptions["Transcriptions/2024-05-05 Test Session.TXT"],
		).toBeUndefined();
		expect(transcriptions["._2024-05-05 Test Session"]).toBeUndefined();
	});
});
