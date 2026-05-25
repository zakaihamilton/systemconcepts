import data from "@data/fontSizes";
import DesktopMacIcon from "@mui/icons-material/DesktopMac";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import TabletIcon from "@mui/icons-material/Tablet";
import { useTranslations } from "@util/domain/translations";
import Label from "@widgets/Label";
import Table from "@widgets/Table";
import { Store } from "pullstate";

export const FontSizesStore = new Store({
	order: "desc",
	offset: 0,
	orderBy: "id",
});

export default function FontSizes() {
	const translations = useTranslations();

	const columns = [
		{
			id: "name",
			title: translations.NAME,
			sortable: true,
		},
		{
			id: "id",
			title: translations.FONT_SIZE,
			sortable: true,
		},
		{
			id: "devicesWidget",
			title: translations.DEVICES,
			sortable: "devices",
		},
	];

	const deviceTypes = [
		{
			id: "phone",
			name: translations.MOBILE,
			icon: <SmartphoneIcon />,
		},
		{
			id: "tablet",
			name: translations.TABLET,
			icon: <TabletIcon />,
		},
		{
			id: "desktop",
			name: translations.DESKTOP,
			icon: <DesktopMacIcon />,
		},
	];

	const mapper = (item) => {
		let { devices } = item;

		const deviceItems = deviceTypes.filter((item) => devices.includes(item.id));
		return {
			...item,
			name: translations[item.name],
			devices: deviceItems.map((device) => device.name).join(", "),
			devicesWidget: deviceItems.map((device) => {
				return <Label key={device.id} icon={device.icon} name={device.name} />;
			}),
		};
	};

	return (
		<>
			<Table
				columns={columns}
				data={data}
				mapper={mapper}
				store={FontSizesStore}
			/>
		</>
	);
}
