import React from "react";
import TextField from "@material-ui/core/TextField";
import Autocomplete from "@material-ui/lab/Autocomplete";
import InputAdornment from '@material-ui/core/InputAdornment';
import MenuItem from '@material-ui/core/MenuItem';
import styles from "./Input.module.scss";
import clsx from "clsx";
import Tooltip from '@material-ui/core/Tooltip';

export function arrayToMenuItems(list) {
    return list.map(({ id, name }) => (<MenuItem key={id} value={id}>{name}</MenuItem>));
}

export default React.forwardRef(function InputWidget({ items, icon, tooltip, className, select, multiple, autocomplete, state, onChange, renderValue, ...props }, ref) {
    let [value, setValue] = state;
    const onChangeText = event => {
        const { value } = event.target;
        setValue(value);
        if (onChange) {
            onChange(event);
        }
    };
    if (select && multiple && !Array.isArray(value)) {
        value = [value];
    }
    if (multiple) {
        renderValue = renderValue || (selected => selected.filter(Boolean).join(", "));
    }
    if (!autocomplete) {
        const children = items && arrayToMenuItems(items);
        return <TextField
            ref={ref}
            InputProps={{
                className: clsx(className, styles.root, styles.input),
                ...icon && {
                    startAdornment: (
                        <InputAdornment position="start">
                            <Tooltip title={tooltip} arrow>
                                {icon}
                            </Tooltip>
                        </InputAdornment>
                    )
                }
            }}
            SelectProps={{
                className: clsx(className, styles.root, styles.select),
                multiple,
                renderValue,
                MenuProps: {
                    anchorOrigin: {
                        vertical: "bottom",
                        horizontal: "left"
                    },
                    transformOrigin: {
                        vertical: "top",
                        horizontal: "left"
                    },
                    getContentAnchorEl: null
                }
            }}
            value={value || ""}
            onChange={onChangeText}
            select={select}
            variant="outlined"
            {...props}
        >
            {children}
        </TextField>;
    }

    const options = (items || []).map(item => item.name);

    return <Autocomplete
        ref={ref}
        options={options}
        value={value || ""}
        getOptionSelected={(option, value) => option === value}
        onChange={(event, newValue) => {
            event.target = { ...event.target };
            if (typeof event.target.value === "undefined") {
                event.target.value = newValue;
            }
            else {
                event.target.value = options[event.target.value];
            }
            onChangeText(event);
        }}
        renderInput={params => textField(params)}
        {...props}
    />;

});
