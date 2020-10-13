import { useEffect, useState, useCallback } from "react";
import storage from "@/util/storage";

export function useGroups(depends) {
    const [loading, setLoading] = useState(false);
    const [metadata, setMetadata] = useState(null);

    const localMetadataPath = "local/shared/sessions/groups.json";
    const remoteMetadataPath = "shared/sessions/groups.json";
    const loadGroups = useCallback(async () => {
        setLoading(true);
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
        storage.writeFile(remoteMetadataPath, JSON.stringify(data, null, 4));
        storage.writeFile(localMetadataPath, JSON.stringify(data, null, 4));
    }, [metadata]);

    return [metadata, loading, updateMetadata];
}