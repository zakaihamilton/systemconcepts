import devices from "@data/storage";
import StorageIcon from "@mui/icons-material/Storage";
import FolderIcon from "@mui/icons-material/Folder";

export function getStorageSection({ id, translations, path }) {
    let icon = <FolderIcon />;
    let tooltip = translations.FOLDER;
    let name = id;
    if (!path) {
        name = translations.STORAGE;
        tooltip = translations.STORAGE;
        icon = <StorageIcon />;
    }
    else if (!path.includes("/")) {
        const item = devices.find(item => item.id === id);
        if (item) {
            name = translations[item.name] || item.name;
            id = name;
        }
        tooltip = translations.STORAGE;
        icon = <StorageIcon />;
    }
    return { icon, name, id, tooltip };
}