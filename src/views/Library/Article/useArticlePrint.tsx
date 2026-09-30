import { exportData } from "@util/storage/importExport";
import { useCallback } from "react";
import { LibraryTagKeys } from "../Icons";
import styles from "./Article.module.css";

export function useArticlePrint({ contentRef, selectedTag, content }: any) {
	const formatArticleWithTags = useCallback((tag: any, text: any) => {
		if (!tag) return text;
		const metadata = LibraryTagKeys.map((key) => {
			const val = tag[key];
			if (!val) return null;
			const label = key.charAt(0).toUpperCase() + key.slice(1);
			return `${label}: ${val}`;
		})
			.filter(Boolean)
			.join("\n");

		return `${metadata}\n\n${"=".repeat(20)}\n\n${text || ""}`;
	}, []);

	const handlePrint = useCallback(() => {
		const rootElement = contentRef.current;
		if (!rootElement) return;

		const iframe = document.createElement("iframe");
		iframe.id = "print-root";
		Object.assign(iframe.style, {
			position: "absolute",
			top: "-9999px",
			left: "-9999px",
			width: "100%",
			height: "auto",
		});
		document.body.appendChild(iframe);

		const cssStyles = Array.from(
			document.querySelectorAll("style, link[rel='stylesheet']"),
		)
			.map((node) => node.outerHTML)
			.join("");

		const frameWindow = iframe.contentWindow;
		if (!frameWindow) {
			document.body.removeChild(iframe);
			return;
		}
		const doc = frameWindow.document;
		doc.open();
		doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                ${cssStyles}
                <style>
                    :global(body), html, body {
                        background: white !important;
                        height: auto !important;
                        overflow: visible !important;
                        width: 100% !important;
                    }
                    [class*="Article_root"] {
                        position: static !important;
                        height: auto !important;
                        overflow: visible !important;
                        display: block !important;
                        visibility: visible !important;
                        margin: 0 !important;
                        padding: 20px !important;
                        width: 100% !important;
                    }
                    @media print {
                        body { -webkit-print-color-adjust: exact; }
                        .print-hidden { display: none !important; }
                    }
                </style>
            </head>
            <body>
                <div id="print-root" class="${styles.root}">
                    ${rootElement.outerHTML}
                </div>
                <script>
                    window.onload = () => {
                        setTimeout(() => {
                            window.print();
                            setTimeout(() => {
                                window.top.postMessage("print-complete", "*");
                            }, 1000);
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
		doc.close();

		let cleanupExecuted = false;
		const cleanup = (e?: any) => {
			if (cleanupExecuted) return;
			if (e && e.data !== "print-complete") return;

			cleanupExecuted = true;
			setTimeout(() => {
				if (document.body.contains(iframe)) {
					document.body.removeChild(iframe);
				}
			}, 5000);
			window.removeEventListener("message", cleanup);
		};

		window.addEventListener("message", cleanup);

		// Fallback cleanup after 30 seconds to prevent memory leak
		setTimeout(() => cleanup(), 30000);
	}, [contentRef]);

	const handleExport = useCallback(() => {
		if (!selectedTag || !content) return;
		const formatted = formatArticleWithTags(selectedTag, content);
		const filename = `${selectedTag.article || "Article"}${selectedTag.number ? `_${selectedTag.number}` : ""}.md`;
		exportData(formatted, filename, "text/plain");
	}, [selectedTag, content, formatArticleWithTags]);

	return { handlePrint, handleExport };
}
