import { useEffect, useState, forwardRef, useCallback } from "react";
import TextField from "@mui/material/TextField";
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import styles from "./Input.module.scss";
import clsx from "clsx";
import Tooltip from "@mui/material/Tooltip";
import { useTranslations } from "@util/translations";

export function arrayToMenuItems(list) {
    return list.map(({ id, name }) => (<MenuItem key={id} value={id}>{name}</MenuItem>));
}

export default forwardRef(function InputWidget({ background, label, render, mapping, helperText = " ", validate, onValidate, readOnly, items, fullWidth = true, icon, tooltip = "", className, select, multiple, autocomplete, state, onChange, renderValue, type, ...props }, ref) {
    let [value, setValue] = state || [];
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const translations = useTranslations();

    const onChangeText = useCallback(event => {
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
    }, [setValue, validate, onValidate, onChange]);

    useEffect(() => {
        if (validate && onValidate) {
            setError(onValidate(value));
        }
        else {
            setError("");
        }
    }, [validate, onValidate, value]);

    if (select && multiple && !Array.isArray(value)) {
        value = [value];
    }
    if (multiple) {
        renderValue = renderValue || (selected => selected.filter(Boolean).join(", "));
    }

    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleMouseDownPassword = (event) => {
        event.preventDefault();
    };

    const inputType = type === 'password' && showPassword ? 'text' : type;

    const textField = (params = {}) => {
        const { slotProps: paramsSlotProps = {}, ...otherParams } = params;
        return (
            <TextField
                ref={ref}
                label={label}
                className={clsx(styles.root, !background && styles.transparent, className)}
                value={value || ""}
                onChange={onChangeText}
                select={select}
                error={!!error}
                helperText={error || helperText}
                variant="filled"
                fullWidth={fullWidth}
                type={inputType}
                {...props}
                {...otherParams}
                slotProps={{
                    ...props.slotProps,
                    ...paramsSlotProps,
                    input: {
                        ...(props.slotProps?.input || {}),
                        ...(paramsSlotProps?.input || {}),
                        className: clsx(styles.input, props.slotProps?.input?.className, paramsSlotProps?.input?.className),
                        ...(icon && {
                            startAdornment: (
                                <InputAdornment position="start" className={styles.icon}>
                                    <Tooltip title={tooltip} arrow>
                                        <span>{icon}</span>
                                    </Tooltip>
                                </InputAdornment>
                            )
                        }),
                        ...(type === 'password' && {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label={showPassword ? translations.HIDE_PASSWORD : translations.SHOW_PASSWORD}
                                        onClick={handleClickShowPassword}
                                        onMouseDown={handleMouseDownPassword}
                                        edge="end"
                                    >
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            )
                        }),
                        readOnly: Boolean(readOnly)
                    },
                    select: {
                        ...(props.slotProps?.select || {}),
                        className: clsx(styles.select, props.slotProps?.select?.className),
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
                            PaperProps: {
                                className: styles.menuPaper
                            }
                        }
                    }
                }}
            />
        );
    };

    if (!autocomplete) {
        if (mapping) {
            items = (items || []).map(mapping);
        }
        const children = items && ((render && render(items)) || arrayToMenuItems(items));
        return textField({ children });
    }

    const options = (items || []).map(item => item.name);

    return (
        <Autocomplete
            options={options}
            value={value || ""}
            isOptionEqualToValue={(option, value) => option === value}
            onChange={(event, newValue) => {
                const customEvent = {
                    target: {
                        ...event.target,
                        value: newValue
                    }
                };
                onChangeText(customEvent);
            }}
            renderInput={params => textField(params)}
            className={clsx(styles.autocomplete, className)}
            {...props}
        />
    );
});
