import React from "react";
import TextField from "@material-ui/core/TextField";
import Autocomplete from "@material-ui/lab/Autocomplete";
import MenuItem from '@material-ui/core/MenuItem';
import styles from "./Input.module.scss";

export function arrayToMenuItems(list) {
    return list.map(({ id, name }) => (<MenuItem key={id} value={id}>{name}</MenuItem>));
}

export default function InputWidget({ helperText, variant = "filled", style, select, multiple, options, state, children, onChange, renderValue, ...props }) {
    style = style || {};
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
    const textField = params => <TextField
        style={style}
        SelectProps={{
            className: styles.root,
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
        variant={variant}
        {...params}
        {...props}
    >
        {children}
    </TextField>;

    if (!options) {
        return textField();
    }

    return <Autocomplete
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
    />;

}
