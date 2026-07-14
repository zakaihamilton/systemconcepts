import { MainStore } from "@components/Main";
import SpeedDial, { SpeedDialAction, SpeedDialIcon } from "@ui/SpeedDial";
import { useTranslations } from "@util/domain/translations";
import { useState } from "react";
import styles from "./SpeedDial.module.css";

export default function SpeedDialWidget({ visible = true, items }) {
	const { direction: _direction } = MainStore.useState();
	const translations = useTranslations();
	const [open, setOpen] = useState(false);

	const handleOpen = () => {
		setOpen(true);
	};

	const handleClose = () => {
		setOpen(false);
	};

	const speedDialItems = items.map((item) => {
		const { onClick } = item;
		const itemHandler = (event) => {
			event.target = { ...event.target };
			event.target.value = item.id;
			onClick && onClick(event);
			handleClose();
		};
		return (
			<SpeedDialAction
				key={item.id}
				icon={item.icon}
				tooltipTitle={item.name}
				tooltipOpen
				className={styles.icon}
				onClick={itemHandler}
			/>
		);
	});

	if (!visible) return null;

	return (
		<SpeedDial
			ariaLabel={translations.MENU}
			className={styles.speedDial}
			icon={<SpeedDialIcon />}
			onClose={handleClose}
			onOpen={handleOpen}
			open={open}
		>
			{speedDialItems}
		</SpeedDial>
	);
}
