import { useTimeout } from "@util/browser/timers";
import React, { useEffect, useState } from "react";

export default React.forwardRef<any, any>(function DelayInput(
	{ children, onChange, value, delay = 250 }: any,
	ref,
) {
	const [currentValue, setCurrentValue] = useState(value || "");
	useEffect(() => {
		setCurrentValue(value || "");
	}, [value]);
	useTimeout(
		() => {
			onChange && onChange({ target: { value: currentValue } });
		},
		delay,
		[currentValue, delay, onChange],
	);
	const onCurrentChange = (event: any) => {
		const value = event.target.value;
		setCurrentValue(value);
	};

	return React.Children.map(children, (child) => {
		return React.cloneElement(child, {
			ref,
			onChange: onCurrentChange,
			value: currentValue,
		});
	});
});
