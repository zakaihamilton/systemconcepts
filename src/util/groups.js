import { useEffect, useState, useCallback } from "react";
import storage from "@/util/storage";

export function useGroups(depends) {
    const [loading, setLoading] = useState(false);
    const [metadata, setMetadata] = useState(null);

    const metadataPath = "shared/sessions/groups.json";
    const loadGroups = useCallback(async () => {
        setLoading(true);
        try {
            const listingFile = await storage.readFile("shared/sessions/listing.json");
            const listing = JSON.parse(listingFile);
            const hasMetadata = await storage.exists(metadataPath);
            if (!hasMetadata) {
                const metadata = listing.map(item => {
                    return {
                        name: item.name,
                        color: "",
                        translations: [],
                        user: ""
                    };
                })
                await storage.writeFile(metadataPath, JSON.stringify(metadata, null, 4));
            }
            const metadataFile = await storage.readFile(metadataPath);
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
            setMetadata(metadata);
        }
        catch (err) {
            console.error(err);
        }
        setLoading(false);
    });

    useEffect(() => {
        loadGroups();
    }, [...depends]);

    const updateMetadata = useCallback(data => {
        if (typeof data === "function") {
            data = data(metadata);
        }
        setMetadata(data);
        storage.writeFile(metadataPath, JSON.stringify(data, null, 4));
    }, [metadata]);

    return [metadata, loading, updateMetadata];
}