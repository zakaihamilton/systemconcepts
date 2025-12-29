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

    const localMetadataPath = "local/shared/groups.json";
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
            let listing = [];
            if (await storage.exists("local/shared/sessions/listing.json")) {
                const listingFile = await storage.readFile("local/shared/sessions/listing.json");
                listing = JSON.parse(listingFile) || [];
            }

            if (!listing.length) {
                console.warn("listing.json empty or missing, scanning directory for groups...");
                const items = await storage.getListing("local/shared/sessions") || [];
                listing = items
                    .filter(item => item.stat && item.stat.type === "dir")
                    .map(item => ({ name: item.name }));

                if (listing.length > 0) {
                    console.log("Restored listing from directory scan:", listing);
                    await storage.writeFile("local/shared/sessions/listing.json", JSON.stringify(listing, null, 4));
                }
            }

            let metadataFile = "[]";
            if (await storage.exists(localMetadataPath)) {
                metadataFile = await storage.readFile(localMetadataPath);
            } else if (await storage.exists("local/shared/sessions/groups.json")) {
                console.log("Migrating groups.json to new location...");
                metadataFile = await storage.readFile("local/shared/sessions/groups.json");
                // Save to new location immediately
                await storage.createFolderPath(localMetadataPath);
                await storage.writeFile(localMetadataPath, metadataFile);
            }
            const metadata = JSON.parse(metadataFile);
            listing.map(item => {
                const metadataItem = metadata.find(el => el.name === item.name);
                if (!metadataItem) {
                    metadata.push({
                        name: item.name,
                        color: "",
                        translations: [],
                        user: "",
                        disabled: false
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

            storage.writeFile(localMetadataPath, JSON.stringify(data, null, 4));
            s.groups = data;
            s.counter++; // Increment counter to trigger sync
        });
    }, []);

    return [groups, busy, updateGroups];
}