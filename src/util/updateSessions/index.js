import { useMemo, useCallback } from "react";
import storage from "@util/storage";
import { makePath } from "@util/path";
import pLimit from "../p-limit";
import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
import { updateGroupProcess } from "./updateGroup";
import { getListing, updateBundleFile } from "./utils";

export function useUpdateSessions(groups) {
    const { busy, status, start } = UpdateSessionsStore.useState();
    const prefix = makePath("aws/sessions") + "/";

    // We pass getListing logic here or reuse the one in utils if it fits,
    // but the original code had getListing instance. 
    // Actually the logic in original was just storage.getListing with a check.
    // Our utils.getListing is exactly that.

    const updateSessions = useCallback(async (includeDisabled) => {
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime();
        });
        try {
            let items = [];
            try {
                items = await getListing(prefix);
            }
            catch (err) {
                console.error(err);
            }
            if (!items) {
                return;
            }
            const limit = pLimit(4);
            const promises = items.map(item => {
                const groupInfo = groups.find(group => group.name === item.name);
                if (!groupInfo) {
                    return null;
                }
                const isDisabled = groupInfo.disabled;
                const isMerged = groupInfo.merged ?? groupInfo.disabled;
                const isBundled = groupInfo.bundled;
                if (!includeDisabled && isDisabled) {
                    return null;
                }
                return limit(() => updateGroupProcess(item.name, false, false, isMerged, isBundled));
            }).filter(Boolean);
            const results = await Promise.all(promises);
            const bundledSessions = results.filter(r => r && Array.isArray(r)).flat();
            if (bundledSessions.length > 0) {
                await updateBundleFile(bundledSessions);
            }
            return results;
        } finally {
            UpdateSessionsStore.update(s => {
                s.busy = false;
            });
        }
    }, [groups, prefix]);

    const updateAllSessions = useCallback(async (includeDisabled) => {
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime();
        });
        try {
            let items = [];
            try {
                items = await getListing(prefix);
            }
            catch (err) {
                console.error(err);
            }
            if (!items) {
                return;
            }
            const limit = pLimit(4);
            const promises = items.map(item => {
                const groupInfo = groups.find(group => group.name === item.name);
                if (!groupInfo) {
                    return null;
                }
                const isDisabled = groupInfo.disabled;
                const isMerged = groupInfo.merged ?? groupInfo?.disabled;
                const isBundled = groupInfo.bundled;
                if (!includeDisabled && isDisabled) {
                    return null;
                }
                return limit(() => updateGroupProcess(item.name, true, false, isMerged, isBundled));
            }).filter(Boolean);
            const results = await Promise.all(promises);
            const bundledSessions = results.filter(r => r && Array.isArray(r)).flat();
            if (bundledSessions.length > 0) {
                await updateBundleFile(bundledSessions);
            }
            return results;
        } finally {
            UpdateSessionsStore.update(s => {
                s.busy = false;
            });
        }
    }, [groups, prefix]);

    const updateSpecificGroup = useCallback(async (name, updateAll, forceUpdate) => {
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime();
        });
        try {
            const groupInfo = groups.find(g => g.name === name);
            const isMerged = groupInfo?.merged ?? groupInfo?.disabled;
            const isBundled = groupInfo?.bundled;
            const result = await updateGroupProcess(name, updateAll, forceUpdate, isMerged, isBundled);
            if (isBundled && Array.isArray(result) && result.length > 0) {
                await updateBundleFile(result);
            }
            return result;
        } finally {
            UpdateSessionsStore.update(s => {
                s.busy = false;
            });
        }
    }, [groups]);

    return useMemo(() => ({
        status,
        busy,
        start,
        updateSessions: !busy && updateSessions,
        updateAllSessions: !busy && updateAllSessions,
        updateGroup: !busy && updateSpecificGroup
    }), [status, busy, start, updateSessions, updateAllSessions, updateSpecificGroup]);
}
