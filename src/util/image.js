export async function thumbnailify(base64Image, targetSize) {
    var img = new Image();

    return new Promise((resolve, reject) => {
        img.onload = () => {
            var width = img.width,
                height = img.height,
                canvas = document.createElement('canvas'),
                ctx = canvas.getContext("2d");

            canvas.width = canvas.height = targetSize;

            ctx.drawImage(
                img,
                width > height ? (width - height) / 2 : 0,
                height > width ? (height - width) / 2 : 0,
                width > height ? height : width,
                width > height ? height : width,
                0, 0,
                targetSize, targetSize
            );

            canvas.toBlob(resolve);
        };

        img.onerror = () => {
            reject();
        };

        img.src = base64Image;
    });
}

export function resizeImage(buffer, targetSize) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.addEventListener("load", async () => {
            const content = await thumbnailify(reader.result, targetSize);
            resolve(content);
        }, false);
        reader.readAsDataURL(buffer);
    });
}
