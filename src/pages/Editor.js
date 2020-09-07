import { useEffect, useRef } from "react";
import { useStoreState } from "@/util/store";
import EditorWidget from "@/widgets/Editor";
import { Store } from "pullstate";
import { getPreviousPath } from "@/util/pages";
import storage from "@/util/storage";

const EditorStoreDefaults = {
    content: "",
    autoSave: false
};

export const EditorStore = new Store(EditorStoreDefaults);

export default function Editor({ name }) {
    const timerRef = useRef();
    const path = (getPreviousPath() + "/" + name).split("/").slice(1).join("/");
    const { content } = useStoreState(EditorStore, s => ({ content: s.content }));

    useEffect(() => {
        storage.readFile(path).then(content => {
            if (content !== null) {
                EditorStore.update(s => {
                    s.content = content || "";
                });
                EditorStore.update(s => {
                    s.autoSave = true;
                });
            }
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
        <EditorWidget state={content} />
    </>;
}
