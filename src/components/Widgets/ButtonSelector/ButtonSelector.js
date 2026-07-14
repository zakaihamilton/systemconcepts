import ArrowDropDownIcon from "@icons/ArrowDropDown";
import Button from "@ui/Button";
import ButtonGroup from "@ui/ButtonGroup";
import ClickAwayListener from "@ui/ClickAwayListener";
import Menu from "@ui/Menu";
import MenuItem from "@ui/MenuItem";
import { useTranslations } from "@util/domain/translations";
import { useRef, useState } from "react";

export default function ButtonSelector({
	state,
	items,
	onClick,
	children,
	label,
	...props
}) {
	const translations = useTranslations();
	const [open, setOpen] = useState(false);
	const anchorRef = useRef(null);
	const [selected, setSelected] = state;

	const handleMenuItemClick = (_event, id) => {
		setSelected(id);
		setOpen(false);
	};

	const handleToggle = () => {
		setOpen((prevOpen) => !prevOpen);
	};

	const handleClose = () => {
		setOpen(false);
	};

	return (
		<>
			<ButtonGroup ref={anchorRef} {...props}>
				<Button disabled={!onClick} onClick={onClick}>
					{children}
				</Button>
				{items && (
					<Button
						aria-label={label || translations.OPTIONS}
						onClick={handleToggle}
					>
						<ArrowDropDownIcon />
					</Button>
				)}
			</ButtonGroup>
			<ClickAwayListener onClickAway={handleClose}>
				<Menu open={open} anchorEl={anchorRef.current} onClose={handleClose}>
					{items?.map((item) => (
						<MenuItem
							key={item.id}
							selected={item.id === selected}
							onClick={(event) => handleMenuItemClick(event, item.id)}
						>
							{item.name}
						</MenuItem>
					))}
				</Menu>
			</ClickAwayListener>
		</>
	);
}
