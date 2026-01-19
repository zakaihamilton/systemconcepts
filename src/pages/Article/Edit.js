import { useStoreState } from "@util/store";
import Input from "@widgets/Input";
import { useCallback } from "react";
import ClickAwayListener from "@mui/material/ClickAwayListener";

export default function EditWidget({ store }) {
    const { icon, type, tooltip, onDone, onValidate, placeholder } = store.useState();
    const { value } = useStoreState(store, s => ({ value: s.value }));
    const complete = useCallback(async () => {
        let result = undefined;
        if (onDone) {
            result = await onDone(value[0]);
        }
        store.update(s => {
            s.mode = "";
            s.item = null;
            s.editing = false;
        });
        return result;
    }, [onDone, store, value]);
    const keyDown = async event => {
        if (event.keyCode == 13) {
            let valid = true;
            if (onValidate) {
                valid = onValidate(value[0]);
            }
            if (valid) {
                store.update(s => {
                    s.editing = false;
                });
                await complete();
            }
        }
    };
    const onClickAway = async () => {
        let valid = true;
        if (onValidate) {
            valid = await onValidate(value[0]);
        }
        if (valid) {
            await complete();
        }
        else {
            store.update(s => {
                s.mode = "";
                s.item = null;
                s.editing = false;
            });
        }
    };

    return <ClickAwayListener onClickAway={onClickAway} mouseEvent="onMouseDown">
        <Input
            onKeyDown={keyDown}
            placeholder={placeholder}
            helperText=""
            autoFocus
            key={type}
            icon={icon}
            tooltip={tooltip}
            state={value} />
    </ClickAwayListener>;
}
