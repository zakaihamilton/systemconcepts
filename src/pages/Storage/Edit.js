import { useStoreState } from "@/util/store";
import Input from "@/widgets/Input";
import { StorageStore } from "../Storage";
import { useOnBlur } from "@/util/hooks";
import { useCallback, useRef } from "react";

export default function EditWidget() {
    const { icon, type, tooltip, onDone, onValidate, placeholder } = StorageStore.useState();
    const { name } = useStoreState(StorageStore, s => ({ name: s.name }));
    const ref = useRef();
    const complete = useCallback(async () => {
        let result = undefined;
        if (onDone) {
            result = await onDone(name[0]);
        }
        StorageStore.update(s => {
            s.mode = "";
            s.item = null;
            s.counter++;
        });
        return result;
    }, [name[0]]);
    useOnBlur(ref, complete);
    const keyDown = async event => {
        if (event.keyCode == 13) {
            const valid = true;
            if (onValidate) {
                valid = onValidate();
            }
            if (valid) {
                StorageStore.update(s => {
                    s.editing = false;
                });
                await complete();
            }
        }
    };

    return <Input
        ref={ref}
        onKeyDown={keyDown}
        placeholder={placeholder}
        autoFocus
        key={type}
        icon={icon}
        tooltip={tooltip}
        fullWidth={true}
        state={name} />
}
