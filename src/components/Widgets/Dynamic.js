import ToggleButtonGroup from "./ToggleButtonGroup";
import Input from "./Input";

export default function DynamicWidget({ state, items, ...props }) {
    let Component = ToggleButtonGroup;
    if (items.length > 3) {
        Component = Input;
        props.select = true;
    }
    return <Component state={state} items={items} {...props} />;
}