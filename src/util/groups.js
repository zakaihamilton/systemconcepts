import { useEffect, useCallback, useState } from "react";
import { Store } from "pullstate";
import { readGroups, writeGroups } from "@sync/groups";
import { SyncActiveStore } from "@sync/syncState";

export const GroupsStore = new Store({
    groups: [],
    settings: {},
    busy: false,
    counter: 0,
    showDisabled: false
});

export function useGroups(depends = []) {
    const { busy, groups } = GroupsStore.useState();
    const [syncCounter, setSyncCounter] = useState(0);

    const loadGroups = useCallback(async () => {
        let isBusy = false;
        let hasGroups = false;
        GroupsStore.update(s => {
            isBusy = s.busy;
            hasGroups = s.groups && s.groups.length > 0;
        });

        if (isBusy && hasGroups) return;
        if (isBusy) return;

        GroupsStore.update(s => { s.busy = true; });
        console.log("[Groups] Loading groups...");

        try {
            const { groups: metadata, settings, version: _version } = await readGroups();

            console.log(`[Groups] loadGroups complete. Found ${metadata.length} groups.`);
            GroupsStore.update(s => {
                s.groups = metadata;
                s.settings = settings;
                s.version = _version;
                s.busy = false;
            });
        }
        catch (err) {
            console.error("[Groups] Error loading groups:", err);
            GroupsStore.update(s => {
                s.busy = false;
            });
        }
    }, []);

    // Subscribe to sync counter to trigger reloads
    useEffect(() => {
        const unsubscribe = SyncActiveStore.subscribe(
            s => s.counter,
            newCounter => setSyncCounter(newCounter)
        );
        return unsubscribe;
    }, []);

    const dependsHash = (depends || []).join(",");
    useEffect(() => {
        loadGroups();
    }, [syncCounter, loadGroups, dependsHash]);

    const updateGroups = useCallback(async data => {
        let updatedGroups = null;
        let updatedSettings = null;

        GroupsStore.update(s => { s.busy = true; });

        try {
            const rawState = GroupsStore.getRawState();
            if (typeof data === "function") {
                updatedGroups = data(rawState.groups);
            } else {
                updatedGroups = data;
            }
            updatedSettings = rawState.settings || {};

            updatedGroups = updatedGroups.map(group => {
                const existing = rawState.groups.find(g => g.name === group.name);
                if (!existing) {
                    return group;
                }
                const hash1 = JSON.stringify(group);
                const hash2 = JSON.stringify(existing);
                if (hash1 !== hash2) {
                    return { ...group, counter: (existing.counter || 0) + 1 };
                }
                return group;
            });

            await writeGroups({
                groups: updatedGroups,
                settings: updatedSettings
            });

            GroupsStore.update(s => {
                s.groups = updatedGroups;
                s.busy = false;
                s.counter++; // Increment counter to trigger sync
            });
        } catch (err) {
            console.error("[Groups] Error updating groups:", err);
            GroupsStore.update(s => {
                s.busy = false;
            });
        }
    }, []);

    const isLoading = busy && (!groups || groups.length === 0);
    return [groups, isLoading, updateGroups];
}