import { logger as structuredLogger } from "@util/api/logger";
export function exportData(data: any, filename: any, type?: string) {
	// Detect and decode base64-encoded binary data
	// Gzip files start with magic bytes 1f 8b which is "H4sI" in base64
	if (typeof data === "string" && data.startsWith("H4sI")) {
		try {
			// Decode base64 to binary string
			const binaryString = atob(data);
			// Convert binary string to Uint8Array
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			data = bytes;
		} catch (err: any) {
			structuredLogger.error("Failed to decode base64 data:", err);
			// Fall through to use original data
		}
	}

	var file = type ? new Blob([data], { type: type }) : data;
	if (window.navigator.msSaveOrOpenBlob)
		// IE10+
		window.navigator.msSaveOrOpenBlob(file, filename);
	else {
		// Others
		var a = document.createElement("a"),
			url = URL.createObjectURL(file);
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		setTimeout(function () {
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
		}, 0);
	}
}

export function exportFile(url: any, filename: any) {
	var a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	setTimeout(function () {
		document.body.removeChild(a);
	}, 0);
}

export function importData() {
	var input = document.createElement("input");
	input.type = "file";
	return new Promise<{ name: string; body: string }>((resolve, reject) => {
		input.addEventListener("change", (e) => {
			const file = (e.currentTarget as HTMLInputElement).files?.[0];
			if (!file) {
				reject(new Error("No file selected"));
				return;
			}
			var reader = new FileReader();
			reader.readAsText(file, "UTF-8");
			reader.onload = () => {
				resolve({
					name: file.name,
					body: typeof reader.result === "string" ? reader.result : "",
				});
			};
			reader.onerror = () => {
				reject(reader.error);
			};
			reader.onabort = () => {
				reject();
			};
		});
		input.click();
	});
}
