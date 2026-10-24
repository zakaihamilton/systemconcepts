function normalizeTranscriptTimestamp(timestamp: string) {
	const [time, milliseconds] = timestamp.split(".");
	const parts = time.split(":").map(Number);
	const hasHours = parts.length === 3;
	const totalSeconds = hasHours
		? parts[0] * 3600 + parts[1] * 60 + parts[2]
		: parts[0] * 60 + parts[1];
	const hours = Math.floor(totalSeconds / 3600);
	const includeHours = hasHours || hours > 0;
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const minuteText = String(
		includeHours ? minutes : Math.floor(totalSeconds / 60),
	).padStart(2, "0");
	const secondText = String(seconds).padStart(2, "0");
	const hourText = String(hours).padStart(
		Math.max(2, hasHours ? String(parts[0]).length : 0),
		"0",
	);
	const normalizedTime = includeHours
		? [hourText, minuteText, secondText].join(":")
		: `${minuteText}:${secondText}`;
	return `${normalizedTime}.${milliseconds}`;
}

export function normalizeTranscriptTimestamps(content: string, isVtt = false) {
	return content
		.split(/\r?\n/)
		.map((line) => {
			if (isVtt && !line.includes("-->")) return line;
			return line.replace(
				/(^|[^\d:])((?:\d+:)?\d{2}:\d{2}\.\d{3})(?![\d:])/g,
				(_match, prefix, timestamp) =>
					`${prefix}${normalizeTranscriptTimestamp(timestamp)}`,
			);
		})
		.join("\n");
}
