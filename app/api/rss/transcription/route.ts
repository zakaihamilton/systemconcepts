import { logger as structuredLogger } from "@util/api/logger";
import { verifyRssMediaToken } from "@util/api/rssMediaToken";
import { normalizeTranscriptTimestamps } from "@util/data/transcriptTimestamps";
import { getZipTextEntryId } from "@util/domain/updateSessions/metadataParser";
import { downloadData, validatePathAccess } from "@util/storage/aws";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { NO_STORE_HEADERS } from "../cache";

export const dynamic = "force-dynamic";

function getTranscriptCacheHeaders(expiresAt: any) {
	const expiration = Number.parseInt(expiresAt, 10);
	const remainingSeconds = Number.isSafeInteger(expiration)
		? Math.max(0, expiration - Math.floor(Date.now() / 1000))
		: 0;
	if (remainingSeconds === 0) return NO_STORE_HEADERS;

	const policy = `public, max-age=${remainingSeconds}`;
	return {
		"Cache-Control": policy,
		"Vercel-CDN-Cache-Control": policy,
	};
}

function decodeBase64Url(value: any) {
	if (!value || value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) {
		throw new Error("INVALID_PARAM");
	}

	return Buffer.from(value, "base64url").toString("utf8");
}

function findTranscriptEntry(zip: any, fileName: any) {
	const expectedId = getZipTextEntryId(fileName);
	if (!expectedId) return null;

	let exactMatch: any = null;
	const normalizedMatches: any[] = [];
	const normalizeId = (value: string) =>
		value.toLowerCase().replace(/[^a-z0-9]/g, "");
	const normalizedExpectedId = normalizeId(expectedId);
	zip.forEach((relativePath: any, zipEntry: any) => {
		if (zipEntry.dir) return;
		const entryId = getZipTextEntryId(relativePath);
		if (!entryId) return;
		if (entryId === expectedId) exactMatch = zipEntry;
		else if (normalizeId(entryId) === normalizedExpectedId)
			normalizedMatches.push(zipEntry);
	});
	if (exactMatch) return exactMatch;
	return normalizedMatches.length === 1 ? normalizedMatches[0] : null;
}

export async function GET(request: any) {
	try {
		const { searchParams } = new URL(request.url);
		const zipPath = decodeBase64Url(searchParams.get("p"));
		const fileName = decodeBase64Url(searchParams.get("f"));
		const resource = `${zipPath}\n${fileName}`;
		const authorized = await verifyRssMediaToken({
			route: "transcript",
			resource,
			expiresAt: searchParams.get("exp"),
			signature: searchParams.get("sig"),
		});
		if (!authorized)
			return new NextResponse("Not Found", {
				status: 404,
				headers: NO_STORE_HEADERS,
			});

		validatePathAccess(zipPath);
		if (
			!zipPath.endsWith(".zip") ||
			/[\/\\\0\n]/.test(fileName)
		) {
			return new NextResponse("Invalid Path", {
				status: 400,
				headers: NO_STORE_HEADERS,
			});
		}

		const blob = await downloadData({ path: zipPath, binary: true });
		const zip = await JSZip.loadAsync(blob);
		const entry = findTranscriptEntry(zip, fileName);
		if (!entry) {
			return new NextResponse("Not Found", {
				status: 404,
				headers: NO_STORE_HEADERS,
			});
		}

		const data = normalizeTranscriptTimestamps(await entry.async("string"));
		return new NextResponse(data, {
			status: 200,
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				...getTranscriptCacheHeaders(searchParams.get("exp")),
			},
		});
	} catch (err: any) {
		structuredLogger.error("[RSS Transcription Proxy] Unexpected error:", err);
		return new NextResponse("Not Found", {
			status: 404,
			headers: NO_STORE_HEADERS,
		});
	}
}
