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
        let isBusy = false;
        let hasGroups = false;
        GroupsStore.update(s => {
            isBusy = s.busy;
            hasGroups = s.groups && s.groups.length > 0;
        });

        // If already loading and we have cached groups, just return
        // This prevents waiting during sync when groups are already loaded
        if (isBusy && hasGroups) {
            return;
        }

        // If already loading and no groups yet, wait for it to complete
        if (isBusy) {
            return;
        }

        // Now we can set busy since we're actually going to load
        GroupsStore.update(s => {
            s.busy = true;
        });
        try {
            let listing = [];
            if (await storage.exists("local/shared/sessions/listing.json")) {
                const listingFile = await storage.readFile("local/shared/sessions/listing.json");
                listing = JSON.parse(listingFile) || [];
            }

            if (!listing.length) {
                console.warn("listing.json empty or missing, scanning local directory for groups...");
                if (await storage.exists("local/shared/sessions")) {
                    const items = await storage.getListing("local/shared/sessions") || [];
                    listing = items
                        .filter(item => item.type === "dir" || item.stat?.type === "dir")
                        .map(item => ({ name: item.name }));
                }

                if (!listing.length) {
                    console.log("Local directory empty, scanning S3 for groups...");
                    const remoteItems = await storage.getListing("aws/metadata/sessions") || [];
                    listing = remoteItems
                        .filter(item => item.type === "dir" || item.stat?.type === "dir")
                        .map(item => ({ name: item.name }))
                        .filter(g => g.name !== "bundle.gz" && !g.name.startsWith("bundle.gz.part"));
                }

                if (listing.length > 0) {
                    console.log("Restored listing from scan:", listing);
                    await storage.createFolderPath("local/shared/sessions/listing.json");
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

    // Only show busy if we're loading AND don't have groups yet
    // This prevents showing loading during sync when groups are already cached
    const isLoading = busy && (!groups || groups.length === 0);
    return [groups, isLoading, updateGroups];
}