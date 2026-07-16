import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSafeError } from "@util/api/safeError";
import { roleAuth } from "@util/auth/roles";
import { getAuthErrorStatus, getSessionUser } from "@util/auth/session";
import {
	getDownloadUrl as getAwsDownloadUrl,
	validatePathAccess,
} from "@util/storage/aws";
import { getWasabi } from "@util/storage/wasabi";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getWasabiKey(path) {
	let key = path.startsWith("/") ? path.substring(1) : path;
	if (key.startsWith("aws/sessions/")) {
		key = key.substring("aws/sessions/".length);
	} else if (key.startsWith("sessions/")) {
		key = key.substring("sessions/".length);
	} else if (key.startsWith("wasabi/")) {
		key = key.substring("wasabi/".length);
	}
	return key;
}

export async function GET(request) {
	try {
		const user = await getSessionUser(request);
		if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

		const url = new URL(request.url);
		const path = decodeURIComponent(url.searchParams.get("path") || "");
		validatePathAccess(path);
		const isAwsPath = path.replace(/^\//, "").startsWith("aws/");
		const key = getWasabiKey(path);
		const range = request.headers.get("range");

		let sourceUrl;
		if (isAwsPath) {
			sourceUrl = await getAwsDownloadUrl({
				path: `sessions/${key}`,
				expiresIn: 60,
				responseContentDisposition: "inline",
			});
		} else {
			const { client, bucket } = await getWasabi();
			sourceUrl = await getSignedUrl(
				client,
				new GetObjectCommand({
					Bucket: bucket,
					Key: key,
					ResponseContentDisposition: "inline",
				}),
				{ expiresIn: 60 },
			);
		}

		const response = await fetch(sourceUrl, {
			headers: range ? { Range: range } : undefined,
		});
		const headers = new Headers({ "Cache-Control": "no-store" });
		for (const name of [
			"accept-ranges",
			"content-length",
			"content-range",
			"content-type",
			"etag",
			"last-modified",
		]) {
			const value = response.headers.get(name);
			if (value) headers.set(name, value);
		}

		return new NextResponse(response.body, {
			status: response.status,
			headers,
		});
	} catch (err) {
		return NextResponse.json(
			{ err: getSafeError(err) },
			{ status: getAuthErrorStatus(err) },
		);
	}
}
