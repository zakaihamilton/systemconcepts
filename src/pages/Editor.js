import { useEffect, useRef, useState, useCallback } from "react";
import { useStoreState } from "@/util/store";
import EditorWidget from "@/widgets/Editor";
import { Store } from "pullstate";
import { getPreviousPath } from "@/util/pages";
import storage from "@/util/storage";
import Progress from "@/widgets/Progress";
import { useSync } from "@/util/sync";

const EditorStoreDefaults = {
    content: "",
    autoSave: false
};

export const EditorStore = new Store(EditorStoreDefaults);

export default function Editor({ name }) {
    const [syncCounter] = useSync();
    const timerRef = useRef();
    const path = (getPreviousPath() + "/" + name).split("/").slice(1).join("/");
    const { content } = useStoreState(EditorStore, s => ({ content: s.content }));
    const [loading, setLoading] = useState(false);
    const readFile = useCallback(() => {
        storage.readFile(path, "utf8").then(content => {
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
                    storage.writeFile(path, data, "utf8");
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

    return <>
        {!loading && <EditorWidget state={content} />}
        {loading && <Progress />}
    </>;
}
