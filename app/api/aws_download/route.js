import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSafeError } from "@util/api/safeError";
import { roleAuth } from "@util/auth/roles";
import { getSessionUser } from "@util/auth/session";
import {
	normalizeListedItem,
	validateGroup,
	validateYear,
} from "@util/domain/updateSessions/metadataAggregator";
import { getS3, list, validatePathAccess } from "@util/storage/aws";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SESSION_METADATA_HEADERS = {
	"Cache-Control": "no-store",
};

async function presignIfExists(s3, key) {
	try {
		const url = await getSignedUrl(
			s3,
			new GetObjectCommand({
				Bucket: process.env.AWS_BUCKET,
				Key: key,
			}),
			{ expiresIn: 3600 },
		);
		return url;
	} catch (err) {
		console.warn("[AWS DOWNLOAD API] Failed to presign key:", key, err);
		return null;
	}
}

export async function GET(request) {
	try {
		const url = new URL(request.url);
		const group = url.searchParams.get("group");
		const year = url.searchParams.get("year");
		const path = `sessions/${group || ""}/${year || ""}`;

		validateGroup(group);
		validateYear(year);
		validatePathAccess(path);

		const user = await getSessionUser(request);
		if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

		const basePath = `sessions/${group}/${year}`;
		const metadataBasePath = `sessions/${group}`;
		const items = (await list({ path: basePath })).map((item) =>
			normalizeListedItem(item, basePath),
		);
		items.sort((a, b) => a.name.localeCompare(b.name));

		const s3 = await getS3({});
		const [tagsUrl, durationUrl, mdUrl, zipUrl] = await Promise.all([
			presignIfExists(s3, `${metadataBasePath}/${year}.tags`),
			presignIfExists(s3, `${metadataBasePath}/${year}.duration`),
			presignIfExists(s3, `${metadataBasePath}/${year}.md`),
			presignIfExists(s3, `${metadataBasePath}/${year}.zip`),
		]);

		return NextResponse.json(
			{
				group,
				year,
				items,
				urls: {
					tags: tagsUrl,
					duration: durationUrl,
					md: mdUrl,
					zip: zipUrl,
				},
			},
			{
				status: 200,
				headers: new Headers(SESSION_METADATA_HEADERS),
			},
		);
	} catch (err) {
		return NextResponse.json({ err: getSafeError(err) }, { status: 403 });
	}
}
