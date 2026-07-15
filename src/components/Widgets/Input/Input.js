import Visibility from "@icons/svg/Visibility.svg";
import VisibilityOff from "@icons/svg/VisibilityOff.svg";
import Autocomplete from "@ui/Autocomplete";
import IconButton from "@ui/IconButton";
import InputAdornment from "@ui/InputAdornment";
import MenuItem from "@ui/MenuItem";
import TextField from "@ui/TextField";
import { useTranslations } from "@util/domain/translations";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import { forwardRef, useCallback, useEffect, useState } from "react";
import styles from "./Input.module.css";
export function arrayToMenuItems(list) {
	return list.map(({ id, name }) => (
		<MenuItem key={id} value={id}>
			{name}
		</MenuItem>
	));
}

export default forwardRef(function InputWidget(
	{
		background,
		label,
		render,
		mapping,
		helperText = " ",
		validate,
		onValidate,
		readOnly,
		items,
		fullWidth = true,
		icon,
		tooltip = "",
		className,
		select,
		multiple,
		autocomplete,
		state,
		onChange,
		renderValue,
		type,
		...props
	},
	ref,
) {
	let [value, setValue] = state || [];
	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const translations = useTranslations();

	const onChangeText = useCallback(
		(event) => {
			const { value } = event.target;
			setValue(value);
			if (validate && onValidate) {
				setError(onValidate(value));
			} else {
				setError("");
			}
			if (onChange) {
				onChange(event);
			}
		},
		[setValue, validate, onValidate, onChange],
	);

	useEffect(() => {
		if (validate && onValidate) {
			setError(onValidate(value));
		} else {
			setError("");
		}
	}, [validate, onValidate, value]);

	if (select && multiple && !Array.isArray(value)) {
		value = [value];
	}
	if (multiple) {
		renderValue =
			renderValue || ((selected) => selected.filter(Boolean).join(", "));
	}

	const handleClickShowPassword = () => setShowPassword((show) => !show);
	const handleMouseDownPassword = (event) => {
		event.preventDefault();
	};

	const inputType = type === "password" && showPassword ? "text" : type;

	const textField = (params = {}) => {
		const { InputProps = {}, ...otherParams } = params;

		const startAdornment = icon ? (
			<InputAdornment position="start" className={styles.icon}>
				<Tooltip title={tooltip} arrow>
					<span>{icon}</span>
				</Tooltip>
			</InputAdornment>
		) : undefined;

		const endAdornment =
			type === "password" ? (
				<InputAdornment position="end">
					<IconButton
						aria-label={
							showPassword
								? translations.HIDE_PASSWORD
								: translations.SHOW_PASSWORD
						}
						onClick={handleClickShowPassword}
						onMouseDown={handleMouseDownPassword}
						edge="end"
					>
						{showPassword ? <VisibilityOff /> : <Visibility />}
					</IconButton>
				</InputAdornment>
			) : undefined;

		return (
			<TextField
				ref={ref}
				label={label}
				className={clsx(
					styles.root,
					!background && styles.transparent,
					className,
				)}
				value={value || ""}
				onChange={onChangeText}
				select={select}
				error={!!error}
				helperText={error || helperText}
				variant="filled"
				fullWidth={fullWidth}
				type={inputType}
				multiple={multiple}
				renderValue={renderValue}
				inputClassName={styles.input}
				selectClassName={styles.select}
				startAdornment={startAdornment}
				endAdornment={endAdornment}
				inputProps={{
					readOnly: Boolean(readOnly),
					onFocus: InputProps.onFocus,
					onBlur: InputProps.onBlur,
				}}
				{...props}
				{...otherParams}
			/>
		);
	};

	if (!autocomplete) {
		if (mapping) {
			items = (items || []).map(mapping);
		}
		const children =
			items && ((render && render(items)) || arrayToMenuItems(items));
		return textField({ children });
	}

	const options = (items || []).map((item) => item.name);

	return (
		<Autocomplete
			options={options}
			value={value || ""}
			isOptionEqualToValue={(option, value) => option === value}
			onChange={(event, newValue) => {
				const customEvent = {
					target: {
						...event.target,
						value: newValue,
					},
				};
				onChangeText(customEvent);
			}}
			renderInput={(params) => textField(params)}
			className={clsx(styles.autocomplete, className)}
			{...props}
		/>
	);
});
