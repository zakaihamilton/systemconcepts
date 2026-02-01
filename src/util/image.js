const MAX_THUMBNAIL_SIZE = 300;
const IMAGE_QUALITY = 0.7;

export async function thumbnailify(base64Image, maxSize = MAX_THUMBNAIL_SIZE) {
    var img = new Image();

    return new Promise((resolve, reject) => {
        img.onload = () => {
            var width = img.width,
                height = img.height,
                canvas = document.createElement("canvas"),
                ctx = canvas.getContext("2d");

            // Calculate scale to fit within maxSize while maintaining aspect ratio
            const scale = Math.min(1, maxSize / Math.max(width, height));
            const newWidth = Math.round(width * scale);
            const newHeight = Math.round(height * scale);

            canvas.width = newWidth;
            canvas.height = newHeight;

            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            // Use WebP with compression for significantly smaller file sizes
            canvas.toBlob(resolve, 'image/webp', IMAGE_QUALITY);
        };

        img.onerror = () => {
            reject(new Error('Failed to load image for thumbnail generation'));
        };

        img.src = base64Image;
    });
}

export function shrinkImage(buffer, maxSize = MAX_THUMBNAIL_SIZE) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.addEventListener("load", async () => {
            try {
                const content = await thumbnailify(reader.result, maxSize);
                resolve(content);
            } catch (err) {
                reject(err);
            }
        }, false);
        reader.addEventListener("error", reject);
        reader.readAsDataURL(buffer);
    });
}

/**
 * Convert a Blob to a Base64 data URL string
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} - Base64 data URL
 */
export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to convert blob to base64'));
        reader.readAsDataURL(blob);
    });
}
