import { useEffect } from "react";
import { useTranslations } from "@/util/translations";
import { Store } from "pullstate";
import SpeedDial from "@/widgets/SpeedDial";
import Input from "@/widgets/Input";
import AddIcon from '@material-ui/icons/Add';
import FolderIcon from '@material-ui/icons/Folder';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import { useStoreState } from "@/util/store";

const ActionStoreDefaults = {
    type: "",
    name: "",
    placeholder: "",
    icon: null,
    editing: false
};

export const ActionStore = new Store(ActionStoreDefaults);

export function useActions(items) {
    const { editing, icon, type, onDone, placeholder } = ActionStore.useState();
    const { name } = useStoreState(ActionStore, s => ({ name: s.name }));
    if (editing) {
        const onBlur = () => {
            if (onDone) {
                onDone();
            }
            ActionStore.update(s => {
                s.editing = false;
            });
        }
        const keyDown = event => {
            if (event.keyCode == 13) {
                let result = true;
                if (onDone) {
                    result = onDone();
                }
                if (result) {
                    ActionStore.update(s => {
                        s.editing = false;
                    });
                }
            }
        };
        items.unshift({
            id: type,
            name: name[0],
            nameWidget: <Input
                onBlur={onBlur}
                onKeyDown={keyDown}
                placeholder={placeholder}
                autoFocus
                key={type}
                icon={icon}
                fullWidth={true}
                state={name} />
        });
    }

    useEffect(() => {
        return () => {
            ActionStore.update(s => {
                Object.assign(s, ActionStoreDefaults);
            });
        }
    }, []);
}

export default function Actions() {
    const { editing } = ActionStore.useState();
    const translations = useTranslations();

    const addItems = [
        {
            id: "file",
            name: "NEW_FILE",
            icon: <InsertDriveFileIcon />,
            placeholder: "FILE_NAME_PLACEHOLDER"
        },
        {
            id: "folder",
            name: "NEW_FOLDER",
            icon: <FolderIcon />,
            placeholder: "FOLDER_NAME_PLACEHOLDER"
        }
    ].map(item => {
        return {
            onClick: () => {
                ActionStore.update(s => {
                    s.type = item.id;
                    s.name = "";
                    s.icon = item.icon;
                    s.placeholder = translations[item.placeholder];
                    s.editing = true;
                });
            },
            ...item,
            name: translations[item.name]
        }
    });

    return (
        <SpeedDial visible={!editing} items={addItems} icon={<AddIcon />} />
    );
}
