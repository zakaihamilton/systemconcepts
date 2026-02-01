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
        await storage.writeFile(path, content[0]);
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
