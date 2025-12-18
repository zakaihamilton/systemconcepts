import devices from "@data/storage";
import StorageIcon from "@mui/icons-material/Storage";
import FolderIcon from "@mui/icons-material/Folder";

export function getStorageSection({ sectionIndex, id, translations }) {
    let icon = <FolderIcon />;
    let tooltip = translations.FOLDER;
    if (sectionIndex <= 1) {
        tooltip = translations.STORAGE;
        icon = <StorageIcon />;
    }
    let name = id;
    if (sectionIndex) {
        const item = devices.find(item => item.id === id);
        if (item) {
            name = translations[item.name] || item.name;
            id = name;
        }
    }
    else {
        name = translations.STORAGE;
    }
    return { icon, name, id, tooltip };
}