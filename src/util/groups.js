import { useEffect, useCallback } from "react";
import { Store } from "pullstate";
import storage from "@util/storage";

export const GroupsStore = new Store({
    groups: [],
    busy: false,
    counter: 0
});

export function useGroups(depends) {
    const { busy, groups } = GroupsStore.useState();

    const localMetadataPath = "local/shared/sessions/groups.json";
    const remoteMetadataPath = "shared/sessions/groups.json";
    const loadGroups = useCallback(async () => {
        let busy = false;
        GroupsStore.update(s => {
            busy = s.busy;
            if (s.busy) {
                return;
            }
            s.busy = true;
        });
        if (busy) {
            return;
        }
        try {
            const listingFile = await storage.readFile("local/shared/sessions/listing.json");
            const listing = JSON.parse(listingFile) || [];
            const hasMetadata = await storage.exists(localMetadataPath);
            const metadataFile = hasMetadata ? await storage.readFile(localMetadataPath) : "[]";
            const metadata = JSON.parse(metadataFile);
            listing.map(item => {
                const metadataItem = metadata.find(el => el.name === item.name);
                if (!metadataItem) {
                    metadata.push({
                        name: item.name,
                        color: "",
                        translations: [],
                        user: ""
                    });
                }
            });
            GroupsStore.update(s => {
                s.groups = metadata;
                s.busy = false;
            });
        }
        catch (err) {
            console.error(err);
            GroupsStore.update(s => {
                s.groups = [];
                s.busy = false;
            });
        }
    }, []);

    useEffect(() => {
        loadGroups();
    }, [...depends]);

    const updateGroups = useCallback(data => {
        GroupsStore.update(s => {
            if (typeof data === "function") {
                data = data(s.groups);
            }
            storage.writeFile(remoteMetadataPath, JSON.stringify(data, null, 4));
            storage.writeFile(localMetadataPath, JSON.stringify(data, null, 4));
            s.groups = data;
        });
    }, []);

    return [groups, busy, updateGroups];
}