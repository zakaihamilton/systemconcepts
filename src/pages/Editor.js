import { useEffect, useRef, useState, useCallback } from "react";
import { useStoreState } from "@util/store";
import EditorWidget from "@widgets/Editor";
import { Store } from "pullstate";
import { useParentPath } from "@util/pages";
import storage from "@util/storage";
import Progress from "@widgets/Progress";
import { useSync } from "@util/sync";
import Download from "@widgets/Download";
import { exportData } from "@util/importExport";

const EditorStoreDefaults = {
    content: "",
    autoSave: false
};

export const EditorStore = new Store(EditorStoreDefaults);

export default function Editor({ name }) {
    const [syncCounter] = useSync();
    const timerRef = useRef();
    const path = (useParentPath() + "/" + name).split("/").slice(1).join("/");
    const { content } = useStoreState(EditorStore, s => ({ content: s.content }));
    const [loading, setLoading] = useState(false);
    const readFile = useCallback(() => {
        storage.readFile(path).then(content => {
            if (content !== null) {
                EditorStore.update(s => {
                    s.content = content || "";
                });
                EditorStore.update(s => {
                    s.autoSave = true;
                });
            }
            setLoading(false);
        });
    }, []);
    useEffect(() => {
        setLoading(true);
        readFile();
        const unsubscribe = EditorStore.subscribe(s => s.content, (data, s) => {
            if (s.autoSave && content !== data) {
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                }
                timerRef.current = setTimeout(() => {
                    storage.writeFile(path, data);
                }, 1000);
            }
        });
        return () => {
            unsubscribe();
        }
    }, []);

    useEffect(() => {
        readFile();
    }, [syncCounter]);

    const downloadFile = () => {
        if (content) {
            exportData(content[0], name, "text/plain");
        }
    };

    return <>
        <Download visible={!loading} onClick={downloadFile} />
        {!loading && <EditorWidget state={content} />}
        {loading && <Progress />}
    </>;
}
