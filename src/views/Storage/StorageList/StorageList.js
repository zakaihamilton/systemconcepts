import ExpandLessIcon from "@icons/ExpandLess";
import ExpandMoreIcon from "@icons/ExpandMore";
import FolderIcon from "@icons/Folder";
import StorageIcon from "@icons/Storage";
import Collapse from "@ui/Collapse";
import List from "@ui/List";
import ListItem from "@ui/ListItem";
import ListItemButton from "@ui/ListItemButton";
import ListItemIcon from "@ui/ListItemIcon";
import ListItemText from "@ui/ListItemText";
import { useTranslations } from "@util/domain/translations";
import { useListing } from "@util/storage/storage";
import Progress from "@widgets/Progress";
import Tooltip from "@widgets/Tooltip";
import { Fragment } from "react";
import styles from "./StorageList.module.css";
export default function StorageList({ path = "", state }) {
	const translations = useTranslations();
	const [data, loading] = useListing(path, [], { useCount: true });
	const depth = path ? path.split("/").length : 0;
	const paddingLeft = depth * 2 + "em";
	const [destination, setDestination] = state;

	const items = (data || [])
		.map((item) => {
			const id = item.id || item.name;
			let name = item.name;
			let tooltip = translations.STORAGE;
			let icon = <StorageIcon />;
			const isFolder = item.type === "dir";
			let expandIcon = null;
			let onClick = undefined;
			const selected = destination == id;
			const open = destination.startsWith(id);
			if (path) {
				if (isFolder) {
					icon = <FolderIcon />;
					tooltip = translations.FOLDER;
					if (item.count) {
						expandIcon = open ? <ExpandLessIcon /> : <ExpandMoreIcon />;
					}
					onClick = () => setDestination(id);
				} else {
					return;
				}
			} else {
				name = translations[item.name];
				if (item.count) {
					expandIcon = open ? <ExpandLessIcon /> : <ExpandMoreIcon />;
				}
				onClick = () => setDestination(id);
			}

			return (
				<Fragment key={id}>
					<ListItem disablePadding>
						<ListItemButton
							selected={selected}
							style={{ paddingLeft }}
							onClick={onClick}
						>
							<ListItemIcon>
								<Tooltip title={tooltip} arrow>
									<span>{icon}</span>
								</Tooltip>
							</ListItemIcon>
							<ListItemText primary={name} />
							{expandIcon}
						</ListItemButton>
					</ListItem>
					{expandIcon && (
						<Collapse in={open}>
							<List className={styles.list}>
								{open && <StorageList path={id} state={state} />}
							</List>
						</Collapse>
					)}
				</Fragment>
			);
		})
		.filter(Boolean);

	return (
		<List className={styles.list}>
			{!!loading && <Progress />}
			{!loading && items}
		</List>
	);
}
