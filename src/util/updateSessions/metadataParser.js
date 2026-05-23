export function getZipTextEntryId(relativePath) {
	const fileName = relativePath.split("/").pop();
	if (!fileName || fileName.startsWith("._")) return null;
	if (!fileName.toLowerCase().endsWith(".txt")) return null;
	return fileName.slice(0, -4);
}

export function normalizeTags(tags) {
	if (!Array.isArray(tags)) return [];
	return tags
		.map((tag) =>
			typeof tag === "string" ? tag.trim().replace(/\.+$/, "") : tag,
		)
		.filter((tag) => tag);
}

export function parseSessionMetadataJSON(content, property) {
	const metadataMap = Object.create(null);
	if (!content) return metadataMap;

	const data = typeof content === "string" ? JSON.parse(content) : content;
	if (!data || !Array.isArray(data.sessions)) {
		return metadataMap;
	}

	data.sessions.forEach((session) => {
		const sessionName = session.sessionName || session.name || session.id;
		if (!sessionName || !session[property]) return;

		metadataMap[sessionName] =
			property === "tags"
				? normalizeTags(session[property])
				: session[property];
	});

	return metadataMap;
}

export function parseSummariesMarkdown(content) {
	const summaries = Object.create(null);
	if (!content) return summaries;

	const lines = content.split("\n");
	let currentSessionId = null;
	let currentBuffer = [];

	const saveCurrentBuffer = () => {
		if (currentSessionId && currentBuffer.length > 0) {
			summaries[currentSessionId] = currentBuffer.join("\n").trim();
		}
	};

	for (const line of lines) {
		if (line.startsWith("## ")) {
			saveCurrentBuffer();

			const header = line.substring(3).trim();
			if (/^\d{4}-\d{2}-\d{2}/.test(header)) {
				currentSessionId = header;
				currentBuffer = [];
			} else {
				currentSessionId = null;
			}
		} else if (currentSessionId) {
			if (line.trim() === "---") continue;
			currentBuffer.push(line);
		}
	}
	saveCurrentBuffer();

	return summaries;
}
