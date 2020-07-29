import React from "react";
import TextField from "@material-ui/core/TextField";
import { makeStyles } from "@material-ui/core/styles";
import Autocomplete from "@material-ui/lab/Autocomplete";

const useStyles = makeStyles({});

export default function InputWidget({ helperText, variant = "filled", style, select, multiple, options, state, children, onChange, renderValue, ...props }) {
    const classes = useStyles();
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
        classes={classes}
        style={style}
        helperText={helperText || " "}
        SelectProps={{
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
