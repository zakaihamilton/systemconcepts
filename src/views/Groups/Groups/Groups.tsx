import { registerToolbar, useToolbar } from "@components/Toolbar";
import UpdateIcon from "@icons/svg/Update.svg";
import UploadIcon from "@icons/svg/Upload.svg";
import VisibilityIcon from "@icons/svg/Visibility.svg";
import VisibilityOffIcon from "@icons/svg/VisibilityOff.svg";
import { useDeviceType, useStyles } from "@util/browser/styles";
import { formatDuration } from "@util/data/string";
import { GroupsStore } from "@util/domain/groups";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import { useUpdateSessions } from "@util/domain/updateSessions";
import Table from "@widgets/Table";
import Cookies from "js-cookie";
import { useEffect, useMemo, useRef, useState } from "react";
import ProgressDialog from "../ProgressDialog";
import styles from "./Groups.module.css";
import {
	buildGroupColumns,
	createGroupRowMapper,
	hasActiveProgress,
} from "./groupTableConfig";
import { importGroupsFile } from "./importGroupsFile";
import { useGroupStorageSizes } from "./useGroupStorageSizes";

registerToolbar("Groups");

export default function Groups() {
	const translations = useTranslations();
	const isMobile = useDeviceType() !== "desktop";
	const { counter, showDisabled } = GroupsStore.useState();
	const [sessions, loading, groups, setGroups] = useSessions([counter], {
		filterSessions: false,
	});
	const {
		status,
		busy,
		start,
		updateSessions,
		updateAllSessions,
		updateAllMetadataCurrentYear,
		updateRecentSessions,
		updateGroup,
	} = useUpdateSessions(groups);
	const isSignedIn = Cookies.get("id") && Cookies.get("hash");
	// Keep the actions visible when the browser's online flag is stale. The
	// per-group menu already behaves this way, and the update functions handle
	// request failures themselves.
	const syncEnabled = !!isSignedIn;
	const fileInputRef = useRef<HTMLInputElement>(null);
	const groupSizes = useGroupStorageSizes(groups, counter, busy);

	const animatedClassName = useStyles(styles, {
		animated: busy,
	});

	const updateSessionsWithSync = async () => {
		if (typeof updateSessions === "function")
			await updateSessions(showDisabled);
	};

	const updateAllSessionsWithSync = async () => {
		if (typeof updateAllSessions === "function")
			await updateAllSessions(showDisabled);
	};

	const updateAllMetadataCurrentYearWithSync = async () => {
		if (typeof updateAllMetadataCurrentYear === "function")
			await updateAllMetadataCurrentYear(showDisabled);
	};

	const updateRecentSessionsWithSync = async () => {
		if (typeof updateRecentSessions === "function")
			await updateRecentSessions(showDisabled);
	};

	const [currentTime, setCurrentTime] = useState(new Date().getTime());
	const sessionCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		if (sessions) {
			for (const session of sessions) {
				const group = session.group;
				counts[group] = (counts[group] || 0) + 1;
			}
		}
		return counts;
	}, [sessions]);

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

	const handleFileChange = async (event: any) => {
		await importGroupsFile(event.target.files?.[0], setGroups);
		// Reset file input
		event.target.value = "";
	};

	const toolbarItems = [
		!!busy && {
			id: "busy",
			name: (
				<span>
					{translations.SYNCING}
					<br />
					{!!duration && formattedDuration}
				</span>
			),
			icon: <UpdateIcon className={animatedClassName} />,
			location: "header",
			menu: true,
		},
		!busy &&
			syncEnabled && {
				id: "sync_sessions",
				name: translations.SYNC_SESSIONS,
				icon: <UpdateIcon className={animatedClassName} />,
				onClick: updateSessionsWithSync,
				location: "header",
				menu: true,
			},
		!busy &&
			syncEnabled && {
				id: "sync_all_sessions",
				name: translations.SYNC_ALL_SESSIONS,
				icon: <UpdateIcon className={animatedClassName} />,
				onClick: updateAllSessionsWithSync,
				location: "header",
				menu: true,
			},
		!busy &&
			syncEnabled && {
				id: "update_recent_sessions",
				name: translations.UPDATE_RECENT_SESSIONS,
				icon: <UpdateIcon className={animatedClassName} />,
				onClick: updateRecentSessionsWithSync,
				location: "header",
				menu: true,
			},
		!busy &&
			syncEnabled && {
				id: "update_metadata_all_current_year",
				name: translations.UPDATE_METADATA_CURRENT_YEAR,
				icon: <UpdateIcon className={animatedClassName} />,
				onClick: updateAllMetadataCurrentYearWithSync,
				location: "header",
				menu: true,
			},
		{
			id: "showDisabled",
			name: showDisabled
				? translations.HIDE_DISABLED_GROUPS
				: translations.SHOW_DISABLED_GROUPS,
			icon: showDisabled ? <VisibilityOffIcon /> : <VisibilityIcon />,
			onClick: () =>
				GroupsStore.update((s) => {
					s.showDisabled = !s.showDisabled;
				}),
			location: "header",
			menu: true,
		},
		!busy && {
			id: "import_groups",
			name: translations.IMPORT_GROUPS || "Import Groups",
			icon: <UploadIcon />,
			onClick: handleImportGroups,
			location: "header",
			menu: true,
		},
	];

	useToolbar({
		id: "Groups",
		items: toolbarItems,
		depends: [
			syncEnabled,
			busy,
			translations,
			Math.floor(duration / 1000),
			groups,
			showDisabled,
			currentTime,
		],
	});

	const withProgress = (status || []).some(hasActiveProgress);

	const columns = buildGroupColumns({
		translations,
		withProgress,
		isMobile,
		busy,
	});

	const mapper = createGroupRowMapper({
		translations,
		status,
		updateGroup,
		sessions,
		setGroups,
		groupSizes,
		sessionCounts,
		styles,
	});

	return (
		<>
			<input
				ref={fileInputRef}
				type="file"
				accept=".json"
				style={{ display: "none" }}
				onChange={handleFileChange}
			/>
			<Table
				name="groups"
				store={GroupsStore}
				columns={columns}
				data={groups.filter((item: any) => !item.disabled || showDisabled)}
				refresh={() => {
					GroupsStore.update((s) => {
						s.counter++;
					});
				}}
				viewModes={{
					list: {
						className: busy
							? withProgress
								? styles.listItemWithProgress
								: styles.listItem
							: withProgress
								? styles.listItemWithProgressAndColor
								: styles.listItemWithColor,
					},
					table: null,
				}}
				mapper={mapper}
				loading={loading}
				depends={[
					translations,
					status,
					updateGroup,
					sessions,
					showDisabled,
					groupSizes,
					sessionCounts,
				]}
			/>
			<ProgressDialog />
		</>
	);
}
