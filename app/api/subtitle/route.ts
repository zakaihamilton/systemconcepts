import { error } from "@util/api/logger";
import { roleAuth } from "@util/auth/roles";
import { getAuthErrorStatus, getSessionUser } from "@util/auth/session";
import {
	downloadData,
	normalizeSessionContentPath,
	validatePathAccess,
} from "@util/storage/aws";
import JSZip from "jszip";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const component = "subtitle";

export async function GET(request: any) {
	try {
		const url = new URL(request.url);
		const path = url.searchParams.get("path");
		const file = url.searchParams.get("file");
		const user = await getSessionUser(request);
		if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

		const sessionPath = normalizeSessionContentPath(path);

		let data;
		let contentType = "text/vtt";
		if (file) {
			validatePathAccess(file);
			const blob = await downloadData({ path: sessionPath, binary: true });
			const zip = await JSZip.loadAsync(blob);
			const entry = zip.file(file);
			if (!entry) throw "NOT_FOUND";
			data = await entry.async("string");
			contentType = file.endsWith(".txt") ? "text/plain" : "text/vtt";
		} else {
			data = await downloadData({ path: sessionPath });
			contentType = sessionPath.endsWith(".txt") ? "text/plain" : "text/vtt";
		}

		return new NextResponse(data, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Cache-Control":
					"private, max-age=86400, stale-while-revalidate=604800",
			},
		});
	} catch (err: any) {
		error({ component, error: "Subtitle fetch error", err });
		return new NextResponse(null, { status: getAuthErrorStatus(err, 404) });
	}
}
