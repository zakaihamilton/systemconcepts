import { useCallback, useEffect, useMemo } from "react";
import { Store } from "pullstate";
import storage from "@util/storage";
import { v4 as uuidv4 } from 'uuid';
import { tagsFilePath } from "@util/tags";

export const ContentStore = new Store({
    tags: null,
    data: null,
    busy: false
});

export function createID() {
    return uuidv4();
}

export function useContent({ counter }) {
    const { tags, data, busy } = ContentStore.useState();
    const getTags = useCallback(async () => {
        const path = "content/tags.json";
        let results = [];
        if (await storage.exists(path)) {
            const content = await storage.readFile(path);
            results = JSON.parse(content);
        }
        ContentStore.update(s => {
            s.tags = results;
        });
        return results;
    }, []);
    const uniqueTags = useMemo(() => {
        return Array.from(new Set((tags || []).map(tag => tag.id.split(".").pop())));
    }, [tags]);
    const refresh = useCallback(async () => {
        ContentStore.update(s => {
            s.data = null;
            s.tags = null;
            s.busy = true;
        });
        await getTags();
        const data = JSON.parse(await storage.readFile(tagsFilePath));
        ContentStore.update(s => {
            s.busy = false;
            s.data = data;
        });
    }, [tags]);
    const toPath = contentId => "content/" + contentId;
    const remove = useCallback(async (contentId) => {
        const path = toPath(contentId);
        await storage.deleteFolder(path);
    }, []);
    useEffect(() => {
        if (!data) {
            refresh();
        }
    }, [counter, data]);
    return { tags, data, busy: busy, remove, tags, toPath, uniqueTags };
}
