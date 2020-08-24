import ToggleButtonGroup from "./ToggleButtonGroup";
import Input from "./Input";
import { useDeviceType } from "@/util/styles";

export default function DynamicWidget({ state, items, ...props }) {
    const deviceType = useDeviceType();
    let Component = ToggleButtonGroup;
    if (items.length > 8 || (deviceType === "phone" && items.length > 3) || (deviceType === "tablet" && items.length > 4)) {
        Component = Input;
        props.select = true;
    }
    return <Component margins={false} state={state} items={items} {...props} />;
}
