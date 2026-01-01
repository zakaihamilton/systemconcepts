import Table from "@widgets/Table";
import { useUpdateSessions } from "@util/updateSessions";
import { useTranslations } from "@util/translations";
import { GroupsStore } from "@util/groups";
import { requestSync } from "@sync/sync";
import ColorPicker from "./Groups/ColorPicker";
import styles from "./Groups.module.scss";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import Cookies from "js-cookie";
import { useOnline } from "@util/online";
import { formatDuration } from "@util/string";
import UpdateIcon from "@mui/icons-material/Update";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useStyles } from "@util/styles";
import Progress from "@widgets/Progress";
import ItemMenu from "./Groups/ItemMenu";
import Label from "@widgets/Label";
import { useSessions } from "@util/sessions";
import { useEffect, useRef, useState } from "react";
import ProgressDialog from "./Groups/ProgressDialog";
import UploadIcon from "@mui/icons-material/Upload";

registerToolbar("Groups");

export default function Groups() {
    const online = useOnline();
    const translations = useTranslations();
    const { counter, showDisabled } = GroupsStore.useState();
    const [sessions, loading, groups, setGroups] = useSessions([counter], { filterSessions: false });
    const { status, busy, start, updateSessions, updateAllSessions, updateGroup } = useUpdateSessions(groups);
    const sync = requestSync;
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const syncEnabled = online && isSignedIn;
    const syncTimerRef = useRef(null);
    const fileInputRef = useRef(null);

    const animatedClassName = useStyles(styles, {
        animated: busy
    });

    // Auto-sync after group updates (debounced)
    useEffect(() => {
        if (!syncEnabled || counter === 0) {
            return;
        }

        // Clear any existing timer
        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
        }

        // Debounce sync by 2 seconds to avoid excessive syncing
        syncTimerRef.current = setTimeout(() => {
            sync && sync();
        }, 2000);

        return () => {
            if (syncTimerRef.current) {
                clearTimeout(syncTimerRef.current);
            }
        };
    }, [counter, syncEnabled, sync]);

    // Wrap update functions to trigger sync after completion
    const updateSessionsWithSync = async () => {
        await updateSessions(showDisabled);
        sync && sync();
    };

    const updateAllSessionsWithSync = async () => {
        await updateAllSessions(showDisabled);
        sync && sync();
    };

    const updateGroupWithSync = async (name, updateAll, updateTags) => {
        await updateGroup(name, updateAll, updateTags);

        // Trigger sync - it will upload local changes
        if (sync) {
            sync();
        }
    };

    const [currentTime, setCurrentTime] = useState(new Date().getTime());

    useEffect(() => {
        if (busy) {
            const interval = setInterval(() => {
                setCurrentTime(new Date().getTime());
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [busy]);

    const duration = start && currentTime - start;
    const formattedDuration = formatDuration(duration);

    const handleImportGroups = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importedData = JSON.parse(text);

            // Handle multiple formats: array, or object { groups: [...] }, or object { "groupName": { ... } }
            let importedGroups = [];
            if (Array.isArray(importedData)) {
                importedGroups = importedData;
            } else if (importedData.groups && Array.isArray(importedData.groups)) {
                importedGroups = importedData.groups;
            } else {
                // Convert object map { "name": { ... } } to array
                importedGroups = Object.entries(importedData).map(([name, info]) => ({
                    name,
                    ...info
                }));
            }

            if (!importedGroups.length) {
                throw new Error("Invalid format: no groups found in the imported file");
            }

            // Replace existing groups with imported data
            setGroups(currentGroups => {
                // Map imported groups to the standard format
                const updated = importedGroups.map(imported => {
                    const existing = currentGroups.find(g => g.name === imported.name) || {};
                    return {
                        ...existing, // Preserve existing internal fields if any
                        name: imported.name,
                        color: imported.color !== undefined ? imported.color : (existing.color || ""),
                        disabled: imported.disabled !== undefined ? !!imported.disabled : (existing.disabled || false)
                    };
                });
                return updated;
            });
        } catch (err) {
            console.error("Error importing groups:", err);
            alert("Failed to import groups.json: " + err.message);
        }

        // Reset file input
        event.target.value = '';
    };

    const toolbarItems = [
        !!busy && {
            id: "busy",
            name: <span>
                {translations.SYNCING}
                <br />
                {!!duration && formattedDuration}
            </span>,
            icon: <UpdateIcon className={animatedClassName} />,
            location: "header",
            menu: true
        },
        !busy && syncEnabled && {
            id: "sync_sessions",
            name: translations.SYNC_SESSIONS,
            icon: <UpdateIcon className={animatedClassName} />,
            onClick: updateSessionsWithSync,
            location: "header",
            menu: true
        },
        !busy && syncEnabled && {
            id: "sync_all_sessions",
            name: translations.SYNC_ALL_SESSIONS,
            icon: <UpdateIcon className={animatedClassName} />,
            onClick: updateAllSessionsWithSync,
            location: "header",
            menu: true
        },
        {
            id: "showDisabled",
            name: showDisabled ? translations.HIDE_DISABLED_GROUPS : translations.SHOW_DISABLED_GROUPS,
            icon: showDisabled ? <VisibilityOffIcon /> : <VisibilityIcon />,
            onClick: () => GroupsStore.update(s => { s.showDisabled = !s.showDisabled; }),
            location: "header",
            menu: true
        },
        !busy && {
            id: "import_groups",
            name: translations.IMPORT_GROUPS || "Import Groups",
            icon: <UploadIcon />,
            onClick: handleImportGroups,
            location: "header",
            menu: true
        }
    ];

    useToolbar({ id: "Groups", items: toolbarItems, depends: [syncEnabled, busy, translations, parseInt(duration / 1000), groups, showDisabled, currentTime] });

    const withProgress = status && !!status.length;

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        },
        withProgress && {
            id: "progress",
            title: translations.PROGRESS,
            columnProps: {
                style: {
                    width: "6em"
                }
            }
        },
        {
            id: "storageMode",
            title: translations.STORAGE,
            sortable: "storageMode",
            columnProps: {
                style: {
                    width: "6em"
                }
            }
        },
        !busy && {
            id: "colorWidget",
            title: translations.COLOR,
            sortable: "color",
            columnProps: {
                style: {
                    width: "6em"
                }
            }
        }
    ];

    const mapper = item => {

        const changeColor = color => {
            setGroups(groups => {
                groups = [...groups];
                const index = groups.findIndex(group => group.name === item.name);
                groups[index] = { ...groups[index], color: color.hex };
                return groups;
            });
        };

        const statusItem = (status || []).find(group => group.name === item.name) || {};
        const hasStatusItem = statusItem.progress !== "undefined";

        const variant = statusItem.progress !== -1 ? "determinate" : undefined;
        const tooltip = statusItem.index + " / " + statusItem.count;

        const percentage = statusItem.count > 0 ? (statusItem.progress / statusItem.count) * 100 : 0;

        const iconWidget = <ItemMenu updateGroup={updateGroupWithSync} item={item} store={GroupsStore} setGroups={setGroups} sessions={sessions} />;

        return {
            ...item,
            iconWidget,
            nameWidget: <Label name={item.name[0].toUpperCase() + item.name.slice(1)} icon={iconWidget} className={item.disabled && styles.disabled} />,
            progress: !!hasStatusItem && <Progress variant={variant} tooltip={tooltip} size={48} style={{ flex: 0, justifyContent: "initial" }} value={variant === "determinate" ? percentage : undefined} />,
            colorWidget: <ColorPicker name={item.name} pickerClassName={styles.picker} key={item.name} color={item.color} onChangeComplete={changeColor} />,
            storageMode: (item.merged ?? item.disabled) ? translations.MERGED : translations.SPLIT
        };
    };

    return <>
        <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
        />
        <Table
            name="groups"
            store={GroupsStore}
            columns={columns}
            data={groups.filter(item => !item.disabled || showDisabled)}
            refresh={() => {
                GroupsStore.update(s => {
                    s.counter++;
                });
            }}
            viewModes={{
                list: {
                    className: withProgress && !busy ? styles.listItemWithProgress : styles.listItem
                },
                table: null
            }}
            mapper={mapper}
            loading={loading}
            depends={[translations, status, updateGroupWithSync, sessions, showDisabled]}
        />
        <ProgressDialog />
    </>;
}
