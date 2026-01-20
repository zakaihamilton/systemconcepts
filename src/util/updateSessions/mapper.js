import { fileTitle, isAudioFile, isVideoFile, isImageFile, isSubtitleFile, isSummaryFile } from "@util/path";

export function createSessionItem(id, fileList, yearName, groupName, sessionTags, sessionDuration) {
    const [, date, sessionName] = id.trim().match(/(\d+-\d+-\d+) (.*)/) || [];
    if (!date || !sessionName) {
        return null;
    }

    const audioFiles = fileList.filter(f => isAudioFile(f.name));
    const audioFile = audioFiles.length ? audioFiles[audioFiles.length - 1] : null;

    const videoFiles = fileList.filter(f => isVideoFile(f.name));

    const imageFiles = fileList.filter(f => isImageFile(f.name));
    const imageFile = imageFiles.length ? imageFiles[imageFiles.length - 1] : null;

    const subtitleFiles = fileList.filter(f => isSubtitleFile(f.name));
    const subtitleFile = subtitleFiles.length ? subtitleFiles[subtitleFiles.length - 1] : null;

    const summaryFiles = fileList.filter(f => isSummaryFile(f.name));
    const summaryFile = summaryFiles.length ? summaryFiles[summaryFiles.length - 1] : null;

    if (!audioFile && !videoFiles.length && !imageFile) {
        return null;
    }

    const ai = !imageFile && (sessionName.endsWith(" - AI") || sessionName.startsWith("Overview - "));
    const key = groupName + "_" + id;

    const item = {
        key,
        id,
        name: sessionName,
        date,
        year: yearName,
        group: groupName,
        ai,
        tags: sessionTags,
        duration: sessionDuration
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
        item.summary = { ...summaryFile, path: summaryFile.path.replace(/^\/aws/, "").replace(/^\//, "") };
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
        }
        else if (sessionName.startsWith("Overview - ")) {
            item.type = "overview";
        }
        item.typeOrder -= 5;
    }

    return item;
}
