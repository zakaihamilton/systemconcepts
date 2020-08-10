import { useEffect } from "react";
import { useTranslations } from "@/util/translations";
import { Store } from "pullstate";
import SpeedDial from "@/widgets/SpeedDial";
import Input from "@/widgets/Input";
import AddIcon from '@material-ui/icons/Add';
import FolderIcon from '@material-ui/icons/Folder';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import { useStoreState } from "@/util/store";
import storage from "@/util/storage";
import StatusBar from "./StatusBar";

const ActionStoreDefaults = {
    type: "",
    name: "",
    placeholder: "",
    icon: null,
    editing: false,
    select: null,
    counter: 1,
    onDone: null,
    onValidate: null,
    enableItemClick: true
};

export const ActionStore = new Store(ActionStoreDefaults);

export function useActions(items) {
    const { editing, icon, type, onDone, onValidate, placeholder } = ActionStore.useState();
    const { name } = useStoreState(ActionStore, s => ({ name: s.name }));
    if (editing) {
        const complete = async () => {
            let result = undefined;
            if (onDone) {
                result = await onDone(name[0]);
            }
            ActionStore.update(s => {
                s.editing = false;
                s.counter++;
            });
            return result;
        };
        const onBlur = () => {
            complete();
        }
        const keyDown = async event => {
            if (event.keyCode == 13) {
                const valid = true;
                if (onValidate) {
                    valid = onValidate();
                }
                if (valid) {
                    ActionStore.update(s => {
                        s.editing = false;
                    });
                    await complete();
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

export default function Actions({ path }) {
    const { editing } = ActionStore.useState();
    const translations = useTranslations();

    const addItems = [
        {
            id: "file",
            name: "NEW_FILE",
            icon: <InsertDriveFileIcon />,
            placeholder: "FILE_NAME_PLACEHOLDER",
            onDone: async name => {
                await storage.createFile(path + "/" + name);
            }
        },
        {
            id: "folder",
            name: "NEW_FOLDER",
            icon: <FolderIcon />,
            placeholder: "FOLDER_NAME_PLACEHOLDER",
            onDone: async name => {
                await storage.createFolder(path + "/" + name);
            }
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
                    s.onDone = item.onDone;
                    s.onValidate = item.onValidate;
                });
            },
            ...item,
            name: translations[item.name]
        }
    });

    return (
        <>
            <StatusBar />
            <SpeedDial visible={!editing && path} items={addItems} icon={<AddIcon />} />
        </>
    );
}
