import { useCallback, useEffect, useMemo } from "react";
import { Store } from "pullstate";
import storage from "@util/storage";
import { v4 as uuidv4 } from 'uuid';
import { tagsFilePath } from "@util/tags";

export const ContentStore = new Store({
    data: null,
    busy: false
});

export function createID() {
    return uuidv4();
}

export function useContent({ counter }) {
    const { data, busy } = ContentStore.useState();
    const refresh = useCallback(async () => {
        ContentStore.update(s => {
            s.data = null;
            s.busy = true;
        });
        const data = JSON.parse(await storage.readFile(tagsFilePath));
        ContentStore.update(s => {
            s.busy = false;
            s.data = data;
        });
    }, []);
    const toPath = contentId => "content/" + contentId;
    const remove = useCallback(async (contentId) => {
        const path = toPath(contentId);
        await storage.deleteFolder(path);
    }, []);
    useEffect(() => {
        refresh();
    }, [counter]);
    return { data, busy: busy, remove, toPath };
}
