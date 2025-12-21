import React, { useState, useEffect } from "react";
import { useTimeout } from "@util/timers";

export default React.forwardRef(function DelayInput({ children, onChange, value, delay = 250 }, ref) {
    const [currentValue, setCurrentValue] = useState(value);
    useEffect(() => {
        setCurrentValue(value);
    }, [value]);
    useTimeout(() => {
        onChange && onChange({ target: { value: currentValue } });
    }, delay, [currentValue]);
    const onCurrentChange = event => {
        const value = event.target.value;
        setCurrentValue(value);
    };

    // eslint-disable-next-line react-hooks/refs
    return React.Children.map(children, child => {
        return React.cloneElement(child, { ref, onChange: onCurrentChange, value: currentValue });
    });
});
