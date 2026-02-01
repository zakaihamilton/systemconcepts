export function makePath(...components) {
    components = components.filter(Boolean).map(component => {
        return component.split("/").filter(Boolean).join("/");
    });
    return "/" + components.join("/");
}

export function isBinaryFile(path) {
    path = makePath(path);
    const mediaExtensions = [".m4a", ".mp4", ".png", ".jpg", ".jpeg", ".DS_Store", ".gz", ".zip"];
    const hasMediaExt = !!mediaExtensions.find(ext => path.endsWith(ext));
    return hasMediaExt;
}

export function isMediaFile(path) {
    path = makePath(path);
    const mediaExtensions = [".mp4", ".m4a"];
    const hasMediaExt = !!mediaExtensions.find(ext => path.endsWith(ext));
    return hasMediaExt;
}

export function isVideoFile(path) {
    path = makePath(path);
    const videoExtensions = [".mp4"];
    const hasVideoExt = !!videoExtensions.find(ext => path.endsWith(ext));
    return hasVideoExt;
}

export function isAudioFile(path) {
    path = makePath(path);
    const audioExtensions = [".m4a"];
    const hasAudioExt = !!audioExtensions.find(ext => path.endsWith(ext));
    return hasAudioExt;
}

export function isImageFile(path) {
    path = makePath(path);
    const imageExtensions = [".png", ".jpg", ".jpeg"];
    const hasImageExt = !!imageExtensions.find(ext => path.endsWith(ext));
    return hasImageExt;
}

export function getImageMimeType(path) {
    path = makePath(path).toLowerCase();
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
    return "application/octet-stream";
}

export function isSubtitleFile(path) {
    path = makePath(path);
    const subtitleExtensions = [".vtt"];
    const hasSubtitleExt = !!subtitleExtensions.find(ext => path.endsWith(ext));
    return hasSubtitleExt;
}

export function isSummaryFile(path) {
    path = makePath(path);
    const summaryExtensions = [".md"];
    const hasSummaryExt = !!summaryExtensions.find(ext => path.endsWith(ext));
    return hasSummaryExt;
}

export function isTagsFile(path) {
    path = makePath(path);
    const tagsExtensions = [".tags"];
    const hasTagsExt = !!tagsExtensions.find(ext => path.endsWith(ext));
    return hasTagsExt;
}

export function isDurationFile(path) {
    path = makePath(path);
    const durationExtensions = [".duration"];
    const hasDurationExt = !!durationExtensions.find(ext => path.endsWith(ext));
    return hasDurationExt;
}

export function fileExtension(path) {
    path = makePath(path);
    const components = path.split(".");
    return components[components.length - 1];
}

export function fileTitle(path) {
    path = makePath(path);
    const last = path.split("/").pop();
    const components = last.split(".");
    const extension = components[components.length - 1] || "";
    const extensionLength = components.length > 1 ? extension.length + 1 : 0;
    const result = extensionLength ? last.slice(0, last.length - extensionLength) : last;
    return result;
}

export function fileName(path) {
    path = makePath(path);
    const last = path.split("/").pop();
    return last;
}
export function fileFolder(path) {
    path = makePath(path);
    const components = path.split("/");
    return components.slice(0, -1).join("/");
}
