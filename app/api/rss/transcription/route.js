import { downloadData, validatePathAccess } from "@util/aws";
import { getZipTextEntryId } from "@util/updateSessions/metadataParser";
import JSZip from "jszip";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function decodeBase64Url(value) {
	if (!value || value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) {
		throw new Error("INVALID_PARAM");
	}

	return Buffer.from(value, "base64url").toString("utf8");
}

function findTranscriptEntry(zip, fileName) {
	const expectedId = getZipTextEntryId(fileName);
	if (!expectedId) return null;

	let match = null;
	zip.forEach((relativePath, zipEntry) => {
		if (match || zipEntry.dir) return;
		if (getZipTextEntryId(relativePath) === expectedId) {
			match = zipEntry;
		}
	});
	return match;
}

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const zipPath = decodeBase64Url(searchParams.get("p"));
		const fileName = decodeBase64Url(searchParams.get("f"));

		validatePathAccess(zipPath);
		validatePathAccess(fileName);
		if (!zipPath.endsWith(".zip") || fileName.includes("/")) {
			return new NextResponse("Invalid Path", { status: 400 });
		}

		const blob = await downloadData({ path: zipPath, binary: true });
		const zip = await JSZip.loadAsync(blob);
		const entry = findTranscriptEntry(zip, fileName);
		if (!entry) {
			return new NextResponse("Not Found", { status: 404 });
		}

		const data = await entry.async("string");
		return new NextResponse(data, {
			status: 200,
			headers: {
				"Content-Type": "text/plain",
				"Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
			},
		});
	} catch (err) {
		console.error("[RSS Transcription Proxy] Unexpected error:", err);
		return new NextResponse("Not Found", { status: 404 });
	}
}
