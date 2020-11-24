export function makePath(...components) {
    components = components.filter(Boolean).map(component => {
        return component.split("/").filter(Boolean).join("/");
    });
    return "/" + components.join("/");
}

export function isBinaryFile(path) {
    path = makePath(path);
    const mediaExtensions = [".m4a", ".mp4", ".png", ".jpg", ".jpeg"];
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
