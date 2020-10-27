import { useStoreState } from "@util/store";
import Input from "@widgets/Input";
import { StorageStore } from "../Storage";
import { useCallback } from "react";
import ClickAwayListener from '@material-ui/core/ClickAwayListener';

export default function EditWidget() {
    const { icon, type, tooltip, onDone, onValidate, placeholder } = StorageStore.useState();
    const { name } = useStoreState(StorageStore, s => ({ name: s.name }));
    const complete = useCallback(async () => {
        let result = undefined;
        if (onDone) {
            result = await onDone(name[0]);
        }
        StorageStore.update(s => {
            s.mode = "";
            s.item = null;
            s.editing = false;
            s.counter++;
        });
        return result;
    }, [name[0]]);
    const keyDown = async event => {
        if (event.keyCode == 13) {
            let valid = true;
            if (onValidate) {
                valid = onValidate(name[0]);
            }
            if (valid) {
                StorageStore.update(s => {
                    s.editing = false;
                });
                await complete();
            }
        }
    };
    const onClickAway = async () => {
        let valid = true;
        if (onValidate) {
            valid = await onValidate(name[0]);
        }
        if (valid) {
            await complete();
        }
        else {
            StorageStore.update(s => {
                s.mode = "";
                s.item = null;
                s.editing = false;
            });
        }
    };

    return <ClickAwayListener onClickAway={onClickAway}>
        <Input
            onKeyDown={keyDown}
            placeholder={placeholder}
            autoFocus
            key={type}
            icon={icon}
            tooltip={tooltip}
            state={name} />
    </ClickAwayListener>;
}
