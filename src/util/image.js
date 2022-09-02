export async function thumbnailify(base64Image, by) {
    var img = new Image();

    return new Promise((resolve, reject) => {
        img.onload = () => {
            var width = img.width,
                height = img.height,
                canvas = document.createElement("canvas"),
                ctx = canvas.getContext("2d");

            canvas.width = width / by;
            canvas.height = height / by;

            ctx.drawImage(
                img,
                0,
                0,
                width / by,
                height / by
            );

            canvas.toBlob(resolve);
        };

        img.onerror = () => {
            reject();
        };

        img.src = base64Image;
    });
}

export function shrinkImage(buffer, by) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.addEventListener("load", async () => {
            const content = await thumbnailify(reader.result, by);
            resolve(content);
        }, false);
        reader.readAsDataURL(buffer);
    });
}
