import clsx from "clsx";
import { forwardRef, useCallback, useId, useRef, useState } from "react";
import styles from "./TextField.module.css";

const TextField = forwardRef(function TextField(
	{
		label,
		value = "",
		onChange,
		className,
		error = false,
		helperText,
		variant = "outlined",
		fullWidth = false,
		type = "text",
		select = false,
		children,
		inputClassName,
		selectClassName,
		startAdornment,
		endAdornment,
		inputProps = {},
		selectProps = {},
		multiple = false,
		renderValue,
		disabled = false,
		InputProps,
		...props
	},
	ref,
) {
	const [focused, setFocused] = useState(false);
	const id = useId();
	const inputRef = useRef(null);
	const setRefs = useCallback(
		(node) => {
			inputRef.current = node;
			if (typeof ref === "function") ref(node);
			else if (ref) ref.current = node;
		},
		[ref],
	);

	const hasValue = multiple
		? Array.isArray(value) && value.length > 0
		: value !== "" && value != null;

	const handleFocus = (e) => {
		setFocused(true);
		inputProps.onFocus?.(e);
		InputProps?.onFocus?.(e);
	};

	const handleBlur = (e) => {
		setFocused(false);
		inputProps.onBlur?.(e);
		InputProps?.onBlur?.(e);
	};

	const fieldInputClassName = clsx(
		styles.input,
		select && styles.select,
		inputClassName,
	);
	const resolvedStartAdornment = InputProps?.startAdornment || startAdornment;

	const displayValue =
		select && renderValue && multiple
			? renderValue(value)
			: select && renderValue
				? renderValue(value)
				: value;

	return (
		<div
			className={clsx(styles.root, fullWidth && styles.fullWidth, className)}
		>
			<div
				className={clsx(
					variant === "filled" && styles.filled,
					variant === "outlined" && styles.outlined,
					focused && styles.focused,
					error && styles.error,
				)}
			>
				{label && (
					<label
						htmlFor={id}
						className={clsx(
							styles.label,
							(focused || hasValue) && styles.labelFloating,
							error && styles.labelError,
						)}
					>
						{label}
					</label>
				)}
				<div className={styles.inputWrapper}>
					{resolvedStartAdornment && (
						<span className={styles.adornmentStart}>
							{resolvedStartAdornment}
						</span>
					)}
					{select ? (
						<select
							ref={setRefs}
							id={id}
							name={id}
							aria-label={!label ? props["aria-label"] : undefined}
							onChange={onChange}
							onFocus={handleFocus}
							onBlur={handleBlur}
							disabled={disabled}
							multiple={multiple}
							className={clsx(fieldInputClassName, selectClassName)}
							{...selectProps}
							{...props}
						>
							{children}
						</select>
					) : (
						<input
							ref={setRefs}
							id={id}
							type={type}
							value={displayValue ?? ""}
							aria-label={label}
							onChange={onChange}
							onFocus={handleFocus}
							onBlur={handleBlur}
							disabled={disabled}
							readOnly={inputProps.readOnly}
							className={fieldInputClassName}
							{...inputProps}
							{...props}
						/>
					)}
					{endAdornment && (
						<span className={styles.adornmentEnd}>{endAdornment}</span>
					)}
				</div>
			</div>
			{helperText && helperText.trim() && (
				<div className={clsx(styles.helperText, error && styles.helperError)}>
					{helperText}
				</div>
			)}
		</div>
	);
});

export default TextField;
