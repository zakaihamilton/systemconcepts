import { abbreviateSize } from "@util/data/string";
import { GroupsStore } from "@util/domain/groups";
import Label from "@widgets/Label";
import Progress from "@widgets/Progress";
import ColorPicker from "../ColorPicker";
import ItemMenu from "../ItemMenu";

export function hasActiveProgress(statusItem: any): boolean {
	return Boolean(
		statusItem &&
			statusItem.count > 0 &&
			(statusItem.progress === -1 || statusItem.progress < statusItem.count),
	);
}

interface BuildGroupColumnsOptions {
	translations: any;
	withProgress: boolean;
	isMobile: boolean;
	busy: boolean;
}

export function buildGroupColumns({
	translations,
	withProgress,
	isMobile,
	busy,
}: BuildGroupColumnsOptions) {
	return [
		{
			id: "nameWidget",
			title: translations.NAME,
			sortable: "name",
		},
		withProgress && {
			id: "progress",
			title: translations.PROGRESS,
			columnProps: {
				style: {
					width: "6em",
				},
			},
		},
		!isMobile && {
			id: "storageMode",
			title: translations.STORAGE,
			sortable: "storageMode",
			columnProps: {
				style: {
					width: "6em",
				},
			},
		},
		!isMobile && {
			id: "storageSize",
			title: translations.SIZE,
			sortable: "storageSizeBytes",
			columnProps: {
				style: {
					width: "6em",
				},
			},
		},
		!isMobile && {
			id: "sessionCount",
			title: translations.SESSIONS,
			sortable: "sessionCountNumber",
			columnProps: {
				style: {
					width: "6em",
				},
			},
		},
		!busy && {
			id: "colorWidget",
			title: translations.COLOR,
			sortable: "color",
			columnProps: {
				style: {
					width: "6em",
				},
			},
		},
	];
}

interface CreateGroupRowMapperOptions {
	translations: any;
	status: any[];
	updateGroup: any;
	sessions: any[];
	setGroups: any;
	groupSizes: Record<string, number>;
	sessionCounts: Record<string, number>;
	styles: Record<string, string>;
}

export function createGroupRowMapper({
	translations,
	status,
	updateGroup,
	sessions,
	setGroups,
	groupSizes,
	sessionCounts,
	styles,
}: CreateGroupRowMapperOptions) {
	return (item: any) => {
		const changeColor = (color: any) => {
			setGroups((groups: any[]) => {
				const nextGroups = [...groups];
				const index = nextGroups.findIndex(
					(group: any) => group.name === item.name,
				);
				nextGroups[index] = { ...nextGroups[index], color: color.hex };
				return nextGroups;
			});
		};

		const statusItem =
			(status || []).find((group) => group.name === item.name) || {};
		const hasStatusItem = hasActiveProgress(statusItem);

		const variant = statusItem.progress !== -1 ? "determinate" : undefined;
		const tooltip = statusItem.index + " / " + statusItem.count;

		let percentage = 0;
		if (statusItem.phase === "persisting") {
			percentage = 100;
		} else if (
			(statusItem.phase === "sessions" || statusItem.phase === "metadata") &&
			statusItem.sessionCount > 0
		) {
			percentage =
				((statusItem.sessionProgress || 0) / statusItem.sessionCount) * 100;
		} else if (statusItem.count > 0) {
			percentage = (statusItem.progress / statusItem.count) * 100;
		}

		const iconWidget = (
			<ItemMenu
				updateGroup={updateGroup}
				item={item}
				store={GroupsStore}
				setGroups={setGroups}
				sessions={sessions}
			/>
		);

		const sizeBytes = groupSizes[item.name] || 0;
		const sizeDisplay = sizeBytes > 0 ? abbreviateSize(sizeBytes) : "-";
		const sessionsCount = sessionCounts[item.name] || 0;

		return {
			...item,
			iconWidget,
			nameWidget: (
				<Label
					name={item.name[0].toUpperCase() + item.name.slice(1)}
					icon={iconWidget}
					className={item.disabled && styles.disabled}
				/>
			),
			progress: !!hasStatusItem && (
				<Progress
					variant={variant}
					tooltip={tooltip}
					size={48}
					style={{ flex: 0, justifyContent: "initial" }}
					value={variant === "determinate" ? percentage : undefined}
				/>
			),
			colorWidget: (
				<ColorPicker
					name={item.name}
					pickerClassName={styles.picker}
					key={item.name}
					color={item.color}
					onChangeComplete={changeColor}
				/>
			),
			storageMode: item.bundled
				? translations.BUNDLED
				: (item.merged ?? item.disabled)
					? translations.MERGED
					: translations.SPLIT,
			storageSize: sizeDisplay,
			storageSizeBytes: sizeBytes,
			sessionCount: sessionsCount || "-",
			sessionCountNumber: sessionsCount,
		};
	};
}
