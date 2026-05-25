import { useTimeout } from "@util/browser/timers";
import React, { useEffect, useState } from "react";

export default React.forwardRef(function DelayInput(
	{ children, onChange, value, delay = 250 },
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
	const onCurrentChange = (event) => {
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
