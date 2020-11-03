import { useStoreState } from "@util/store";
import Input from "@widgets/Input";
import { ContentStore } from "../Content";
import { useCallback } from "react";
import ClickAwayListener from '@material-ui/core/ClickAwayListener';

export default function EditWidget() {
    const { icon, type, tooltip, onDone, onValidate, placeholder } = ContentStore.useState();
    const { value } = useStoreState(ContentStore, s => ({ value: s.value }));
    const complete = useCallback(async () => {
        let result = undefined;
        if (onDone) {
            result = await onDone(value[0]);
        }
        ContentStore.update(s => {
            s.mode = "";
            s.item = null;
            s.editing = false;
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
                ContentStore.update(s => {
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
            ContentStore.update(s => {
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
