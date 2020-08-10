import { useStoreState } from "@/util/store";
import Input from "@/widgets/Input";
import { StorageStore } from "../Storage";

export default function EditWidget() {
    const { icon, type, onDone, onValidate, placeholder } = StorageStore.useState();
    const { name } = useStoreState(StorageStore, s => ({ name: s.name }));
    const complete = async () => {
        let result = undefined;
        if (onDone) {
            result = await onDone(name[0]);
        }
        StorageStore.update(s => {
            s.mode = "";
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
                StorageStore.update(s => {
                    s.editing = false;
                });
                await complete();
            }
        }
    };

    return <Input
        onBlur={onBlur}
        onKeyDown={keyDown}
        placeholder={placeholder}
        autoFocus
        key={type}
        icon={icon}
        fullWidth={true}
        state={name} />
}
