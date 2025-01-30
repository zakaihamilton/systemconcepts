import { useEffect, useState, forwardRef } from "react";
import TextField from "@mui/material/TextField";
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import styles from "./Input.module.scss";
import clsx from "clsx";
import Tooltip from "@mui/material/Tooltip";

export function arrayToMenuItems(list) {
    return list.map(({ id, name }) => (<MenuItem key={id} value={id}>{name}</MenuItem>));
}

export default forwardRef(function InputWidget({ background, label, render, mapping, helperText = " ", validate, onValidate, readOnly, items, fullWidth = true, icon, tooltip = "", className, select, multiple, autocomplete, state, onChange, renderValue, ...props }, ref) {
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
            items = (items || []).map(mapping);
        }
        const children = items && ((render && render(items)) || arrayToMenuItems(items));
        return (
            (<TextField
                ref={ref}
                label={label}
                className={clsx(styles.root, !background && styles.transparent)}
                value={value || ""}
                onChange={onChangeText}
                select={select}
                error={!!error}
                helperText={error || helperText}
                variant="filled"
                fullWidth={fullWidth}
                {...props}
                slotProps={{
                    input: {
                        className: clsx(styles.input, className),
                        ...(icon && {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Tooltip title={tooltip} arrow>
                                        {icon}
                                    </Tooltip>
                                </InputAdornment>
                            )
                        }),
                        readOnly: Boolean(readOnly)
                    },

                    select: {
                        className: clsx(styles.select, className),
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
                            }
                        }
                    }
                }}>
                {children}
            </TextField >)
        );
    }

    const options = (items || []).map(item => item.name);

    return (
        <Autocomplete
            ref={ref}
            options={options}
            value={value || ""}
            isOptionEqualToValue={(option, value) => option === value}
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
        />
    );

});
