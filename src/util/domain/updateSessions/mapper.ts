import {
	fileTitle,
	isAudioFile,
	isImageFile,
	isSubtitleFile,
	isSummaryFile,
	isVideoFile,
} from "@util/data/path";

export function createSessionItem(
	id: any,
	fileList: any,
	yearName: any,
	groupName: any,
	sessionTags: any,
	sessionDuration: any,
	sessionSummaryText: any,
	sessionTranscription: any,
	sessionTranscriptPath: any,
) {
	const [, date, sessionName] = id.trim().match(/(\d+-\d+-\d+) (.*)/) || [];
	if (!date || !sessionName) {
		return null;
	}

	const audioFiles = fileList.filter((f: any) => isAudioFile(f.name));
	const audioFile = audioFiles.length
		? audioFiles[audioFiles.length - 1]
		: null;

	const videoFiles = fileList.filter((f: any) => isVideoFile(f.name));

	const imageFiles = fileList.filter((f: any) => isImageFile(f.name));
	const imageFile = imageFiles.length
		? imageFiles[imageFiles.length - 1]
		: null;

	const subtitleFiles = fileList.filter((f: any) => isSubtitleFile(f.name));
	const subtitleFile = subtitleFiles.length
		? subtitleFiles[subtitleFiles.length - 1]
		: null;

	const summaryFiles = fileList.filter((f: any) => isSummaryFile(f.name));
	const summaryFile = summaryFiles.length
		? summaryFiles[summaryFiles.length - 1]
		: null;

	if (!audioFile && !videoFiles.length && !imageFile) {
		return null;
	}

	const isOverview = sessionName.startsWith("Overview - ");
	const isAi = !imageFile && sessionName.endsWith(" - AI");
	const ai = isOverview || isAi;
	const key = groupName + "_" + id;

	const item: Record<string, any> = {
		key,
		id,
		name: sessionName,
		date,
		year: yearName,
		group: groupName,
		ai,
		tags: (sessionTags || [])
			.map((tag: any) =>
				typeof tag === "string" ? tag.trim().replace(/\.+$/, "") : tag,
			)
			.filter((tag: any) => tag),
		duration: sessionDuration,
		summaryText: sessionSummaryText,
		transcription: sessionTranscription || false,
		transcriptPath: sessionTranscriptPath || null,
		files: (fileList || []).map((f: any) => f.name),
	};

	if (audioFile) {
		item.audio = audioFile;
	}

	if (videoFiles.length) {
		for (const file of videoFiles) {
			const fileId = fileTitle(file.name);
			const resolutionMatch = fileId.match(/(.*)_(\d+x\d+)/);
			if (resolutionMatch) {
				const [, , resolution] = resolutionMatch;
				if (!item.resolutions) {
					item.resolutions = {};
				}
				item.resolutions[resolution] = file;
			} else {
				item.video = file;
			}
		}
	}

	if (imageFile) {
		item.thumbnail = true;
		item.image = imageFile;
	}

	if (subtitleFile) {
		item.subtitles = subtitleFile;
	}

	if (summaryFile) {
		item.summary = {
			...summaryFile,
			path: summaryFile.path.replace(/^\/aws/, "").replace(/^\//, ""),
		};
	}

	if (videoFiles.length) {
		item.type = "video";
		item.typeOrder = 10;
	} else if (audioFile) {
		item.type = "audio";
		item.typeOrder = 20;
	} else if (imageFile) {
		item.type = "image";
		item.duration = 0.1;
		item.typeOrder = 30;
	} else {
		item.type = "unknown";
		item.typeOrder = 40;
	}

	if (!item.duration) {
		item.duration = 0.5;
	}

	if (ai) {
		if (sessionName.endsWith(" - AI")) {
			item.type = "ai";
		} else if (sessionName.startsWith("Overview - ")) {
			item.type = "overview";
		}
		item.typeOrder -= 5;
	}

	return item;
}
