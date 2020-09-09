import { useEffect, useRef, useState } from "react";
import { useStoreState } from "@/util/store";
import EditorWidget from "@/widgets/Editor";
import { Store } from "pullstate";
import { getPreviousPath } from "@/util/pages";
import storage from "@/util/storage";
import Progress from "@/widgets/Progress";

const EditorStoreDefaults = {
    content: "",
    autoSave: false
};

export const EditorStore = new Store(EditorStoreDefaults);

export default function Editor({ name }) {
    const timerRef = useRef();
    const path = (getPreviousPath() + "/" + name).split("/").slice(1).join("/");
    const { content } = useStoreState(EditorStore, s => ({ content: s.content }));
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
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

    return <>
        {!loading && <EditorWidget state={content} />}
        {loading && <Progress />}
    </>;
}
