import React, { useEffect, useState } from "react";
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

export default React.forwardRef(function InputWidget({ mapping, validate, onValidate, readOnly, items, fullWidth = true, icon, tooltip = "", className, select, multiple, autocomplete, state, onChange, renderValue, ...props }, ref) {
    let [value, setValue] = state;
    const [error, setError] = useState("");
    const onChangeText = event => {
        const { value } = event.target;
        setValue(value);
        if (validate && onValidate) {
            setError(onValidate(value));
        }
        else {
            setError("");
        }
        if (onChange) {
            onChange(event);
        }
    };
    useEffect(() => {
        if (validate && onValidate) {
            setError(onValidate(value));
        }
        else {
            setError("");
        }
    }, [validate]);
    if (select && multiple && !Array.isArray(value)) {
        value = [value];
    }
    if (multiple) {
        renderValue = renderValue || (selected => selected.filter(Boolean).join(", "));
    }

    if (!autocomplete) {
        if (mapping) {
            items = items.map(mapping);
        }
        const children = items && arrayToMenuItems(items);
        return <TextField
            ref={ref}
            className={styles.root}
            InputProps={{
                className: clsx(className, styles.input),
                ...icon && {
                    startAdornment: (
                        <InputAdornment position="start">
                            <Tooltip title={tooltip} arrow>
                                {icon}
                            </Tooltip>
                        </InputAdornment>
                    )
                },
                readOnly: Boolean(readOnly)
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
            error={!!error}
            helperText={error || " "}
            variant="outlined"
            fullWidth={fullWidth}
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
