import clsx from "clsx";
import { useRef, useState } from "react";

export default function Autocomplete({
	options = [],
	value,
	onChange,
	renderInput,
	isOptionEqualToValue,
	className,
	...props
}) {
	const [open, setOpen] = useState(false);
	const [inputValue, setInputValue] = useState(value || "");
	const containerRef = useRef(null);

	const filtered = options.filter((opt) =>
		String(opt).toLowerCase().includes(String(inputValue).toLowerCase()),
	);

	const handleSelect = (option) => {
		setInputValue(option);
		setOpen(false);
		onChange?.(null, option);
	};

	const params = {
		InputProps: {
			onFocus: () => setOpen(true),
			onBlur: () => setTimeout(() => setOpen(false), 150),
		},
	};

	return (
		<div
			ref={containerRef}
			className={clsx(className)}
			style={{ position: "relative" }}
		>
			{renderInput({
				...params,
				value: inputValue,
				onChange: (e) => {
					setInputValue(e.target.value);
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
					{filtered.map((option) => (
						<li
							key={option}
							role="option"
							onMouseDown={() => handleSelect(option)}
							style={{
								padding: "8px 12px",
								cursor: "pointer",
								borderRadius: 6,
							}}
						>
							{option}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
