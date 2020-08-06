import { useEffect } from "react";
import { useTranslations } from "@/util/translations";
import { Store } from "pullstate";
import SpeedDial from "@/widgets/SpeedDial";
import Input from "@/widgets/Input";
import AddIcon from '@material-ui/icons/Add';
import FolderIcon from '@material-ui/icons/Folder';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import { useStoreState } from "@/util/store";

const EditStoreDefaults = {
    type: "",
    name: "",
    icon: null,
    visible: false
};

export const EditStore = new Store(EditStoreDefaults);

export function useActions(items) {
    const { visible, icon, type, onDone } = EditStore.useState();
    const { name } = useStoreState(EditStore, s => ({ name: s.name }));
    if (visible) {
        const onBlur = () => {
            if (onDone) {
                onDone();
            }
            EditStore.update(s => {
                s.visible = false;
            });
        }
        const keyDown = event => {
            if (event.keyCode == 13) {
                let result = true;
                if (onDone) {
                    result = onDone();
                }
                if (result) {
                    EditStore.update(s => {
                        s.visible = false;
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
                autoFocus
                key={type}
                icon={icon}
                fullWidth={true}
                state={name} />
        });
    }

    useEffect(() => {
        return () => {
            EditStore.update(s => {
                Object.assign(s, EditStoreDefaults);
            });
        }
    }, []);
}

export default function Actions() {
    const translations = useTranslations();

    const addItems = [
        {
            id: "file",
            name: "New File",
            icon: <InsertDriveFileIcon />
        },
        {
            id: "folder",
            name: "New Folder",
            icon: <FolderIcon />
        }
    ].map(item => {
        return {
            onClick: () => {
                EditStore.update(s => {
                    s.type = item.id;
                    s.name = translations[item.name];
                    s.icon = item.icon;
                    s.visible = true;
                });
            },
            ...item
        }
    });

    return (
        <SpeedDial items={addItems} icon={<AddIcon />} />
    );
}
