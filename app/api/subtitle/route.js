import { error } from "@util/api/logger";
import { roleAuth } from "@util/auth/roles";
import { getSessionUser } from "@util/auth/session";
import { downloadData, validatePathAccess } from "@util/storage/aws";
import JSZip from "jszip";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const component = "subtitle";

export async function GET(request) {
	try {
		const url = new URL(request.url);
		const path = url.searchParams.get("path");
		const file = url.searchParams.get("file");
		const user = await getSessionUser(request);
		if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

		let decodedPath = decodeURIComponent(path);
		validatePathAccess(decodedPath);

		let data;
		let contentType = "text/vtt";
		if (file) {
			validatePathAccess(file);
			const blob = await downloadData({ path: decodedPath, binary: true });
			const zip = await JSZip.loadAsync(blob);
			const entry = zip.file(file);
			if (!entry) throw "NOT_FOUND";
			data = await entry.async("string");
			contentType = file.endsWith(".txt") ? "text/plain" : "text/vtt";
		} else {
			data = await downloadData({ path: decodedPath });
			contentType = decodedPath.endsWith(".txt") ? "text/plain" : "text/vtt";
		}

		return new NextResponse(data, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Cache-Control":
					"private, max-age=86400, stale-while-revalidate=604800",
			},
		});
	} catch (err) {
		error({ component, error: "Subtitle fetch error", err });
		return new NextResponse(null, { status: 404 });
	}
}
