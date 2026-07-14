import CloseIcon from "@icons/svg/Close.svg";
import AppBar from "@ui/AppBar";
import Button from "@ui/Button";
import Dialog from "@ui/Dialog";
import DialogContent from "@ui/DialogContent";
import IconButton from "@ui/IconButton";
import InputBase from "@ui/InputBase";
import Toolbar from "@ui/Toolbar";
import Typography from "@ui/Typography";
import { logger as structuredLogger } from "@util/api/logger";
import { useTranslations } from "@util/domain/translations";
import storage from "@util/storage/storage";
import Tooltip from "@widgets/Tooltip";
import { StorageStore } from "../Storage";
import StorageList from "../StorageList";
import styles from "./Destination.module.css";
export default function Destination({ path }) {
	const translations = useTranslations();

	const { destination, mode, select } = StorageStore.useState();
	const destinationState = [
		destination,
		(destination) => {
			StorageStore.update((s) => {
				s.destination = destination;
			});
		},
	];

	const handleClose = (counter) => {
		StorageStore.update((s) => {
			s.destination = "";
			s.mode = "";
			s.select = null;
			if (counter) {
				s.counter++;
			}
		});
	};

	const clickAction = async () => {
		for (const item of select) {
			if (mode === "move") {
				const target = [destination, item.name].filter(Boolean).join("/");
				try {
					if (await storage.exists(target)) {
						throw translations.ALREADY_EXISTS.replace("${name}", item.name);
					}
					if (item.type === "dir") {
						await storage.moveFolder(item.path, target);
					} else {
						await storage.moveFile(item.path, target);
					}
				} catch (err) {
					StorageStore.update((s) => {
						s.message = err;
						s.severity = "error";
					});
					structuredLogger.error(err);
				}
			} else if (mode === "copy") {
				const target = [destination, item.name].filter(Boolean).join("/");
				try {
					if (await storage.exists(target)) {
						throw translations.ALREADY_EXISTS.replace("${name}", item.name);
					}
					if (item.type === "dir") {
						await storage.copyFolder(item.path, target);
					} else {
						await storage.copyFile(item.path, target);
					}
				} catch (err) {
					StorageStore.update((s) => {
						s.message = err;
						s.severity = "error";
					});
					structuredLogger.error(err);
				}
			}
		}
		handleClose(true);
	};

	const modes = [
		{
			id: "move",
			name: translations.MOVE,
		},
		{
			id: "copy",
			name: translations.COPY,
		},
	];

	const modeName = (modes.find((item) => item.id === mode) || {}).name;
	const disableAction = destination === path;

	return (
		<Dialog fullScreen open={destination !== ""} onClose={handleClose}>
			<AppBar className={styles.appBar}>
				<Toolbar>
					<Tooltip arrow title={translations.CLOSE}>
						<IconButton
							edge="start"
							color="inherit"
							onClick={handleClose}
							size="large"
						>
							<CloseIcon />
						</IconButton>
					</Tooltip>
					<Typography variant="h6" className={styles.title}>
						{translations.SELECT_DESTINATION}
					</Typography>
					<div className={styles.path}>
						<InputBase
							readOnly={true}
							value={destination}
							classes={{
								root: styles.inputRoot,
								input: styles.inputInput,
							}}
						/>
					</div>
					<div style={{ flex: 1 }} />
					<Button
						autoFocus
						color="inherit"
						disabled={disableAction}
						onClick={clickAction}
					>
						{modeName}
					</Button>
				</Toolbar>
			</AppBar>
			<DialogContent dividers={true}>
				{destination && <StorageList state={destinationState} />}
			</DialogContent>
		</Dialog>
	);
}
