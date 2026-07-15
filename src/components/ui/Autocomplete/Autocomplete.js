import clsx from "clsx";
import { Fragment, useRef, useState } from "react";

export default function Autocomplete({
	options = [],
	value,
	onChange,
	renderInput,
	multiple = false,
	inputValue,
	onInputChange,
	filterOptions,
	isOptionEqualToValue = (option, selected) => option === selected,
	getOptionLabel = (option) => String(option ?? ""),
	renderOption,
	renderValue,
	className,
	...props
}) {
	const [open, setOpen] = useState(false);
	const [uncontrolledInputValue, setUncontrolledInputValue] = useState("");
	const containerRef = useRef(null);
	const selectedValues = multiple ? (Array.isArray(value) ? value : []) : value;
	const currentInputValue = inputValue ?? uncontrolledInputValue;

	const filtered = filterOptions
		? filterOptions(options, { inputValue: currentInputValue })
		: options.filter((option) =>
				getOptionLabel(option)
					.toLowerCase()
					.includes(String(currentInputValue).toLowerCase()),
			);

	const setCurrentInputValue = (event, nextValue) => {
		setUncontrolledInputValue(nextValue);
		onInputChange?.(event, nextValue);
	};

	const handleSelect = (option) => {
		const nextValue = multiple
			? [
					...selectedValues.filter(
						(selected) => !isOptionEqualToValue(option, selected),
					),
					option,
				]
			: option;
		setCurrentInputValue(null, "");
		setOpen(multiple);
		onChange?.(null, nextValue);
	};

	const params = {
		InputProps: {
			onFocus: () => setOpen(true),
			onBlur: () => setTimeout(() => setOpen(false), 150),
			startAdornment:
				renderValue && multiple
					? renderValue(selectedValues, ({ index }) => ({
							key: `${getOptionLabel(selectedValues[index])}-${index}`,
							onDelete: () =>
								onChange?.(
									null,
									selectedValues.filter(
										(_, selectedIndex) => selectedIndex !== index,
									),
								),
						}))
					: undefined,
		},
	};

	return (
		<div
			ref={containerRef}
			className={clsx(className)}
			style={{ position: "relative" }}
		>
			{renderInput?.({
				...params,
				value: currentInputValue,
				onChange: (e) => {
					setCurrentInputValue(e, e.target.value);
					setOpen(true);
				},
			})}
			{open && filtered.length > 0 && (
				<ul
					role="listbox"
					style={{
						position: "absolute",
						top: "100%",
						left: 0,
						right: 0,
						zIndex: 1300,
						background: "var(--main-background-alternative)",
						border: "1px solid var(--border-color)",
						borderRadius: 8,
						margin: "4px 0 0",
						padding: 4,
						listStyle: "none",
						maxHeight: 200,
						overflow: "auto",
					}}
				>
					{filtered.map((option, index) => {
						const optionProps = {
							key: `${getOptionLabel(option)}-${index}`,
							role: "option",
							onMouseDown: () => handleSelect(option),
							style: {
								padding: "8px 12px",
								cursor: "pointer",
								borderRadius: 6,
							},
						};

						if (renderOption) {
							return (
								<Fragment key={optionProps.key}>
									{renderOption(optionProps, option)}
								</Fragment>
							);
						}

						return <li {...optionProps}>{getOptionLabel(option)}</li>;
					})}
				</ul>
			)}
		</div>
	);
}
