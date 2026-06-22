import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { error, log } from "@util/api/logger";
import { getSafeError } from "@util/api/safeError";
import { roleAuth } from "@util/auth/roles";
import { getSessionUser } from "@util/auth/session";
import { fileTitle } from "@util/data/path";
import { getSessions } from "@util/domain/sessionFeed";
import {
	metadataInfo as awsMetadataInfo,
	validatePathAccess,
} from "@util/storage/aws";
import { getWasabi } from "@util/storage/wasabi";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const component = "player";
function getWasabiKey(path) {
	let key = path.startsWith("/") ? path.substring(1) : path;
	if (key.startsWith("sessions/")) {
		key = key.substring("sessions/".length);
	} else if (key.startsWith("wasabi/")) {
		key = key.substring("wasabi/".length);
	}
	return key;
}

async function getSessionTranscriptPath(s3Key) {
	try {
		const parts = s3Key.split("/");
		if (parts.length < 3) return null;

		const [group, year] = parts;
		let id = fileTitle(parts[parts.length - 1]);
		const resolutionMatch = id.match(/(.*)_(\d+x\d+)/);
		if (resolutionMatch) {
			id = resolutionMatch[1];
		}

		const sessions = await getSessions({ group });
		const session = sessions.find(
			(s) => s.group === group && s.year === year && s.id === id,
		);

		if (!session) return null;
		return {
			path: session.transcriptPath || session.subtitles?.path || null,
		};
	} catch (err) {
		console.warn("[Player] Failed to load transcript metadata:", err);
		return null;
	}
}

export async function GET(request) {
	try {
		const { client: wasabiClient, bucket: BUCKET_NAME } = await getWasabi();
		const path = request.headers.get("path") || "";
		const user = await getSessionUser(request);
		if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

		let decodedPath = decodeURIComponent(path);
		validatePathAccess(decodedPath);
		let s3Key = getWasabiKey(decodedPath);

		const fileName = s3Key.split("/").pop();

		const playerCommand = new GetObjectCommand({
			Bucket: BUCKET_NAME,
			Key: s3Key,
			ResponseContentDisposition: "inline",
		});
		const playerUrl = await getSignedUrl(wasabiClient, playerCommand, {
			expiresIn: 10800,
		});

		const downloadCommand = new GetObjectCommand({
			Bucket: BUCKET_NAME,
			Key: s3Key,
			ResponseContentDisposition: `attachment; filename="${fileName}"`,
		});
		const downloadUrl = await getSignedUrl(wasabiClient, downloadCommand, {
			expiresIn: 10800,
		});

		let subtitles = null;
		let transcriptionUrl = null;
		const sessionTranscript = await getSessionTranscriptPath(s3Key);
		const sessionTranscriptPath = sessionTranscript?.path;
		const dotIndex = s3Key.lastIndexOf(".");
		if (dotIndex !== -1) {
			const vttPath = sessionTranscriptPath?.endsWith(".vtt")
				? getWasabiKey(sessionTranscriptPath)
				: s3Key.substring(0, dotIndex) + ".vtt";
			const exists = await awsMetadataInfo({ path: "sessions/" + vttPath });
			if (exists) {
				subtitles =
					"/api/subtitle?path=" + encodeURIComponent("sessions/" + vttPath);
			}
			const txtPath = sessionTranscriptPath?.endsWith(".txt")
				? getWasabiKey(sessionTranscriptPath)
				: s3Key.substring(0, dotIndex) + ".txt";
			const txtExists = await awsMetadataInfo({ path: "sessions/" + txtPath });
			if (txtExists) {
				const txtCommand = new GetObjectCommand({
					Bucket: BUCKET_NAME,
					Key: txtPath,
					ResponseContentDisposition: `attachment; filename="${fileName.substring(0, fileName.lastIndexOf("."))}.txt"`,
				});
				transcriptionUrl = await getSignedUrl(wasabiClient, txtCommand, {
					expiresIn: 10800,
				});
			}
		}

		log({
			component,
			message: `User ${user.id} generated player & download URLs for: ${s3Key}`,
		});

		return NextResponse.json(
			{
				path: playerUrl,
				downloadUrl,
				subtitles,
				transcriptionUrl,
			},
			{
				headers: {
					"Cache-Control": "no-store",
				},
			},
		);
	} catch (err) {
		error({ component, error: "Access Error", err });
		return NextResponse.json({ err: getSafeError(err) }, { status: 403 });
	}
}
