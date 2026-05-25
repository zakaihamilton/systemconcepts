import AddIcon from "@mui/icons-material/Add";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { importData } from "@util/storage/importExport";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import { useTranslations } from "@util/domain/translations";
import SpeedDial from "@widgets/SpeedDial";
import { StorageStore } from "../Storage";

export function useActions(data) {
	const { mode, type } = StorageStore.useState();
	if (mode === "create") {
		data = [
			{
				id: type,
				name: "",
				create: true,
			},
			...data,
		];
	}
	return data;
}

export default function Actions({ data, path, readOnly }) {
	const { mode } = StorageStore.useState();
	const translations = useTranslations();

	const addItems = [
		{
			id: "file",
			name: translations.NEW_FILE,
			icon: <InsertDriveFileIcon />,
			tooltip: translations.FILE,
			placeholder: translations.FILE_NAME_PLACEHOLDER,
			onDone: async (name) => {
				if (!name) {
					return;
				}
				const target = makePath(path, name);
				try {
					if (await storage.exists(target)) {
						throw translations.ALREADY_EXISTS.replace("${name}", name);
					}
					await storage.writeFile(target, "");
				} catch (err) {
					StorageStore.update((s) => {
						s.message = err;
						s.severity = "error";
					});
				}
			},
		},
		{
			id: "folder",
			name: translations.NEW_FOLDER,
			icon: <CreateNewFolderIcon />,
			tooltip: translations.FOLDER,
			placeholder: translations.FOLDER_NAME_PLACEHOLDER,
			onDone: async (name) => {
				if (!name) {
					return;
				}
				const target = makePath(path, name);
				try {
					if (await storage.exists(target)) {
						throw translations.ALREADY_EXISTS.replace("${name}", name);
					}
					await storage.createFolder(target);
				} catch (err) {
					StorageStore.update((s) => {
						s.message = err;
						s.severity = "error";
					});
				}
			},
		},
	]
		.filter(Boolean)
		.map((item) => {
			return {
				onClick: () => {
					StorageStore.update((s) => {
						s.type = item.id;
						s.name = "";
						s.icon = item.icon;
						s.tooltip = item.tooltip;
						s.placeholder = item.placeholder;
						s.mode = "create";
						s.onDone = item.onDone;
						s.onValidate = item.onValidate;
					});
				},
				...item,
			};
		});

	addItems.push(
		...[
			{
				id: "importFile",
				name: translations.IMPORT_FILE,
				icon: <InsertDriveFileIcon />,
				tooltip: translations.FILE,
				onClick: async () => {
					let body = "";
					let name = "";
					try {
						({ name, body } = await importData());
					} catch (err) {
						if (err) {
							StorageStore.update((s) => {
								s.message = err;
								s.severity = "error";
							});
						}
					}
					try {
						await storage.writeFile(path + "/" + name, body);
						StorageStore.update((s) => {
							s.counter++;
						});
					} catch (err) {
						StorageStore.update((s) => {
							s.message = err;
							s.severity = "error";
						});
					}
				},
			},
			{
				id: "importFolder",
				name: translations.IMPORT_FOLDER,
				icon: <FolderIcon />,
				tooltip: translations.FOLDER,
				onClick: async () => {
					let body = "";
					try {
						({ body } = await importData());
					} catch (err) {
						if (err) {
							StorageStore.update((s) => {
								s.message = err;
								s.severity = "error";
							});
						}
					}
					try {
						await storage.importFolder(path, JSON.parse(body));
						StorageStore.update((s) => {
							s.counter++;
						});
					} catch (err) {
						StorageStore.update((s) => {
							s.message = err;
							s.severity = "error";
						});
					}
				},
			},
		],
	);

	return (
		<SpeedDial
			visible={!mode && path && data && !readOnly}
			items={addItems}
			icon={<AddIcon />}
		/>
	);
}
