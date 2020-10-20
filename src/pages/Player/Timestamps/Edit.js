import { useStoreState } from "@/util/store";
import Input from "@/widgets/Input";
import { TimestampsStore } from "../Timestamps";
import { useCallback } from "react";
import ClickAwayListener from '@material-ui/core/ClickAwayListener';

export default function EditWidget() {
    const { icon, type, tooltip, onDone, onValidate, placeholder } = TimestampsStore.useState();
    const { name } = useStoreState(TimestampsStore, s => ({ name: s.name }));
    const complete = useCallback(async () => {
        let result = undefined;
        if (onDone) {
            result = await onDone(name[0]);
        }
        TimestampsStore.update(s => {
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
                TimestampsStore.update(s => {
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
            TimestampsStore.update(s => {
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
            helperText=""
            autoFocus
            key={type}
            icon={icon}
            tooltip={tooltip}
            state={name} />
    </ClickAwayListener>;
}
