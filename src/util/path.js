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

export function isImageFile(path) {
    path = makePath(path);
    const imageExtensions = [".png", ".jpg", ".jpeg"];
    const hasImageExt = !!imageExtensions.find(ext => path.endsWith(ext));
    return hasImageExt;
}