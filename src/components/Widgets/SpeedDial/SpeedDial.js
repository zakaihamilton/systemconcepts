import { MainStore } from "@components/Main";
import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialAction from "@mui/material/SpeedDialAction";
import SpeedDialIcon from "@mui/material/SpeedDialIcon";
import { useTranslations } from "@util/translations";
import { useState } from "react";
import styles from "./SpeedDial.module.css";

export default function SpeedDialWidget({ visible = true, items }) {
	const { direction } = MainStore.useState();
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
				slotProps={{
					tooltip: {
						title: item.name,
						open: true,
						placement: direction === "rtl" ? "right" : "left",
						classes: {
							tooltip: styles.tooltip,
						},
					},
				}}
				onClick={itemHandler}
				classes={{
					fab: styles.icon,
				}}
			/>
		);
	});

	return (
		<SpeedDial
			ariaLabel={translations.MENU}
			classes={{
				root: direction === "rtl" ? styles.speedDialRtl : styles.speedDial,
				fab: styles.fab,
			}}
			hidden={!visible}
			icon={<SpeedDialIcon classes={{ root: styles.fab }} />}
			onClose={handleClose}
			onOpen={handleOpen}
			open={open}
		>
			{speedDialItems}
		</SpeedDial>
	);
}
