import { useCallback, useEffect, useMemo } from "react";
import { useTags } from "./tags";
import { Store } from "pullstate";
import storage from "@util/storage";

export const tagsBasePath = "/shared/library/tags/";

export const ContentStore = new Store({
    content: [],
    data: [],
    busy: false
});

export function useContent({ counter }) {
    const [tags, tagsLoading] = useTags({ counter });
    const { content, data, busy } = ContentStore.useState();
    const updateTagContent = useCallback(async (tagId) => {
        const path = tagsBasePath + tagId + ".json";
        let results = [];
        if (await storage.exists(path)) {
            const content = await storage.readFile(path);
            results = JSON.parse(content);
        }
        ContentStore.update(s => {
            const content = [...s.content];
            content[tagId] = results;
            s.content = content;
        });
        return results;
    }, []);
    const uniqueTags = useMemo(() => {
        return Array.from(new Set((tags || []).map(tag => tag.id.split(".").pop())));
    }, [tags]);
    const refresh = useCallback(async () => {
        ContentStore.update(s => {
            s.content = [];
            s.data = [];
            s.busy = true;
        });
        const data = [...tags.map(tag => {
            const name = tag.id.split(".").pop();
            return { ...tag, name, type: "tag" };
        })];
        for (const uniqueTag of uniqueTags) {
            const content = await updateTagContent(uniqueTag);
            tags.filter(tag => tag.name === uniqueTag).map(tag => {
                content.map(item => {
                    data.push({ ...item, type: "content", id: tag.id + "." + content.id, contentId: content.id });
                });
            });
        }
        ContentStore.update(s => {
            s.busy = false;
            s.data = data;
        });
    }, [tags]);
    const write = useCallback(async (tagId, data) => {
        const path = tagsBasePath + tagId + ".json";
        await storage.writeFile(path, JSON.stringify(data, null, 4));
        await refresh();
    }, []);
    useEffect(() => {
        if (tags) {
            refresh();
        }
    }, [counter, tags]);
    return { content, data, busy: busy || tagsLoading, write, tags, uniqueTags };
}
