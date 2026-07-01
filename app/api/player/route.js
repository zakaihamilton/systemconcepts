import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { error, log, logger as structuredLogger } from "@util/api/logger";
import { getSafeError } from "@util/api/safeError";
import { roleAuth } from "@util/auth/roles";
import { getAuthErrorStatus, getSessionUser } from "@util/auth/session";
import {
	fileTitle,
	isAudioFile,
	isImageFile,
	isVideoFile,
} from "@util/data/path";
import { getSessions } from "@util/domain/sessionFeed";
import {
	metadataInfo as awsMetadataInfo,
	getDownloadUrl as getAwsDownloadUrl,
	validatePathAccess,
} from "@util/storage/aws";
import {
	getWasabi,
	metadataInfo as wasabiMetadataInfo,
} from "@util/storage/wasabi";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const component = "player";
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
		structuredLogger.warn("[Player] Failed to load transcript metadata:", err);
		return null;
	}
}

export async function GET(request) {
	try {
		const path = request.headers.get("path") || "";
		const user = await getSessionUser(request);
		if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

		let decodedPath = decodeURIComponent(path);
		validatePathAccess(decodedPath);
		const isAwsPath = decodedPath.replace(/^\//, "").startsWith("aws/");
		let s3Key = getWasabiKey(decodedPath);
		let useAwsPrimary = isAwsPath;
		if (!isAwsPath && isImageFile(s3Key)) {
			const wasabiImage = await wasabiMetadataInfo({ path: s3Key });
			if (!wasabiImage) {
				const awsImage = await awsMetadataInfo({ path: `sessions/${s3Key}` });
				useAwsPrimary = !!awsImage;
			}
		}

		const fileName = s3Key.split("/").pop();
		let playerUrl;
		let downloadUrl;
		if (useAwsPrimary) {
			const awsPath = `sessions/${s3Key}`;
			playerUrl = await getAwsDownloadUrl({
				path: awsPath,
				expiresIn: 10800,
				responseContentDisposition: "inline",
			});
			downloadUrl = await getAwsDownloadUrl({
				path: awsPath,
				expiresIn: 10800,
				responseContentDisposition: `attachment; filename="${fileName}"`,
			});
		} else {
			const { client: wasabiClient, bucket: BUCKET_NAME } = await getWasabi();
			const playerCommand = new GetObjectCommand({
				Bucket: BUCKET_NAME,
				Key: s3Key,
				ResponseContentDisposition: "inline",
			});
			playerUrl = await getSignedUrl(wasabiClient, playerCommand, {
				expiresIn: 10800,
			});

			const downloadCommand = new GetObjectCommand({
				Bucket: BUCKET_NAME,
				Key: s3Key,
				ResponseContentDisposition: `attachment; filename="${fileName}"`,
			});
			downloadUrl = await getSignedUrl(wasabiClient, downloadCommand, {
				expiresIn: 10800,
			});
		}

		let subtitles = null;
		let transcriptionUrl = null;
		const supportsTranscript = isAudioFile(s3Key) || isVideoFile(s3Key);
		if (supportsTranscript) {
			const sessionTranscript = await getSessionTranscriptPath(s3Key);
			const sessionTranscriptPath = sessionTranscript?.path;
			const dotIndex = s3Key.lastIndexOf(".");
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
				transcriptionUrl = await getAwsDownloadUrl({
					path: "sessions/" + txtPath,
					expiresIn: 10800,
					responseContentDisposition: `attachment; filename="${fileName.substring(0, fileName.lastIndexOf("."))}.txt"`,
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
		return NextResponse.json(
			{ err: getSafeError(err) },
			{ status: getAuthErrorStatus(err) },
		);
	}
}
