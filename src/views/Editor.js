import { useEffect, useCallback, useState } from "react";
import { useStoreState } from "@util/store";
import EditorWidget from "@widgets/Editor";
import { Store } from "pullstate";
import { useParentPath } from "@util/pages";
import storage from "@util/storage";
import Progress from "@widgets/Progress";
import { useSync } from "@sync/sync";
import Download from "@widgets/Download";
import Save from "@widgets/Save";
import { exportData } from "@util/importExport";
import pako from "pako";
import { isCompressedJSONFile } from "@util/path";

const EditorStoreDefaults = {
    content: ""
};

export const EditorStore = new Store(EditorStoreDefaults);

export default function Editor({ name, path }) {
    const [syncCounter] = useSync();
    const parentPath = useParentPath();
    path = path || (parentPath + "/" + name).split("/").slice(1).join("/");
    const { content } = useStoreState(EditorStore, s => ({ content: s.content }));
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const readFile = useCallback(() => {
        storage.readFile(path).then(content => {
            // Handle .json.gz files - decompress them
            if (isCompressedJSONFile(path) && content) {
                try {
                    // If content is base64-encoded (string starting with H4sI)
                    if (typeof content === 'string' && content.startsWith('H4sI')) {
                        // Decode base64 to binary
                        const binaryString = atob(content);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        content = bytes;
                    }
                    // Decompress using pako
                    const decompressed = pako.ungzip(content, { to: 'string' });
                    content = decompressed;
                } catch (err) {
                    console.error('Failed to decompress .json.gz file:', err);
                    content = content || "";
                }
            }

            EditorStore.update(s => {
                s.content = content || "";
            });
            setLoading(false);
        });
    }, [path]);

    useEffect(() => {
        setLoading(true);
        readFile();
    }, [path, readFile]);

    useEffect(() => {
        readFile();
    }, [syncCounter, readFile]);

    const saveFile = async () => {
        setSaving(true);
        await storage.createFolderPath(path);

        let contentToSave = content[0];

        // Handle .json.gz files - compress them before saving
        if (isCompressedJSONFile(path)) {
            try {
                // Compress using pako
                const compressed = pako.gzip(contentToSave);
                // Convert to base64 for storage
                let binary = '';
                const bytes = new Uint8Array(compressed);
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                contentToSave = btoa(binary);
            } catch (err) {
                console.error('Failed to compress .json.gz file:', err);
                // Fall back to saving uncompressed
            }
        }

        await storage.writeFile(path, contentToSave);
        setSaving(false);
    };

    const downloadFile = () => {
        if (content[0]) {
            exportData(content[0], name, "text/plain");
        }
    };

    return <>
        <Download visible={!loading} onClick={downloadFile} />
        <Save visible={!loading} onClick={saveFile} saving={saving} />
        {!loading && <EditorWidget state={content} />}
        {loading && <Progress />}
    </>;
}
