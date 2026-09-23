import { useDeviceType } from "@util/browser/styles";
import type { ComponentType } from "react";
import Input from "../Input";
import ToggleButtonGroup from "../ToggleButtonGroup";

export default function DynamicWidget({ state, items, ...props }: any) {
	const deviceType = useDeviceType();
	let Component: ComponentType<any> = ToggleButtonGroup;
	if (
		items.length > 8 ||
		(deviceType === "phone" && items.length > 3) ||
		(deviceType === "tablet" && items.length > 4)
	) {
		Component = Input;
		props.select = true;
		if (!props.helperText) {
			props.helperText = "";
		}
	}
	return <Component state={state} items={items} {...props} />;
}
