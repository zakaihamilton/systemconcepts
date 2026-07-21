import { formatDuration } from "@util/data/string";

/**
 * The session catalogue is shared by the list, schedule, Apps, and detail
 * routes. Keep only the fields those views actually use so parsing a synced
 * session file cannot retain its transcript, descriptions, and media metadata
 * for every session in the browser heap.
 */
export function toSessionListItem(
	session,
	{ cdn = {}, groupInfo, personal } = {},
) {
	const imagePath = session.image?.path;
	const storedImagePath =
		imagePath?.startsWith("wasabi/") ||
		imagePath?.startsWith("/aws/") ||
		imagePath?.startsWith("aws/")
			? imagePath
			: null;
	const cdnImagePath =
		!storedImagePath && imagePath && cdn.url
			? cdn.url + encodeURI(imagePath.replace("/aws", ""))
			: null;
	const duration = Math.max(session.duration || 0, personal?.duration || 0);
	const hasLegacyThumbnail =
		typeof session.thumbnail === "string" &&
		session.thumbnail.startsWith("data:image/");
	const thumbnail =
		typeof session.thumbnail === "string" && !hasLegacyThumbnail
			? session.thumbnail
			: session.thumbnail === true
				? cdnImagePath || storedImagePath
				: hasLegacyThumbnail
					? cdnImagePath || storedImagePath || null
					: cdnImagePath || session.thumbnail || null;

	return {
		id: session.id,
		key: session.key,
		name: session.name,
		date: session.date,
		year: session.year,
		group: session.group,
		type: session.type,
		typeOrder: session.typeOrder,
		color: session.color || groupInfo?.color,
		duration,
		position: personal?.position ?? session.position,
		thumbnail,
		imagePath: storedImagePath || cdnImagePath || null,
		image: imagePath ? { path: imagePath } : null,
		summary: session.summary?.path ? { path: session.summary.path } : null,
		tags: session.tags || [],
		tagsString: (session.tags || []).join(" "),
		isHebrew: /[\u0590-\u05FF]/.test(session.name || ""),
		hasDuration: duration > 1,
		durationStr: duration > 1 ? formatDuration(duration * 1000, true) : null,
		video: Boolean(session.video),
		audio: Boolean(session.audio),
		ai: Boolean(session.ai),
		subtitles: session.subtitles?.path || session.subtitles || null,
		transcription: Boolean(session.transcription),
		transcriptPath: session.transcriptPath || null,
		files: (session.files || []).filter(
			(file) => file.endsWith(".txt") || file.endsWith(".vtt"),
		),
	};
}
