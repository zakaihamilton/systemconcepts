import { useStoreState } from "@/util/store";
import Input from "@/widgets/Input";
import { ActionStore } from "./Actions";

export default function EditWidget() {
    const { mode, icon, type, onDone, onValidate, placeholder } = ActionStore.useState();
    const { name } = useStoreState(ActionStore, s => ({ name: s.name }));
    const complete = async () => {
        let result = undefined;
        if (onDone) {
            result = await onDone(name[0]);
        }
        ActionStore.update(s => {
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
                ActionStore.update(s => {
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
