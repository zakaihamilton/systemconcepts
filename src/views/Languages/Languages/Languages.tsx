import data from "@data/languages";
import FormatTextdirectionLToRIcon from "@icons/svg/FormatTextdirectionLToR.svg";
import FormatTextdirectionRToLIcon from "@icons/svg/FormatTextdirectionRToL.svg";
import { createStore } from "@util/browser/store";
import { useTranslations } from "@util/domain/translations";
import { addPath, toPath } from "@util/domain/views";
import Label from "@widgets/Label";
import Row from "@widgets/Row";
import Table from "@widgets/Table";
export const LanguagesStore = createStore({
	order: "desc",
	offset: 0,
	orderBy: "",
});

export default function Languages() {
	const translations = useTranslations();

	const columns = [
		{
			id: "nameWidget",
			title: translations.NAME,
			sortable: "name",
			padding: false,
		},
		{
			id: "directionWidget",
			title: translations.DIRECTION,
			sortable: "direction",
		},
	];

	const directions = [
		{
			id: "ltr",
			name: translations.LEFT_TO_RIGHT,
			icon: <FormatTextdirectionLToRIcon />,
		},
		{
			id: "rtl",
			name: translations.RIGHT_TO_LEFT,
			icon: <FormatTextdirectionRToLIcon />,
		},
	];

	const rowClick = (item: any) => {
		addPath("translations?language=" + item.id);
	};

	const rowTarget = (item: any) => {
		return (
			"#" + toPath("settings", "languages", "translations?language=" + item.id)
		);
	};

	const mapper = (item: any) => {
		let { direction } = item;
		direction = directions.find((item) => item.id === direction);
		return {
			...item,
			nameWidget: (
				<Row
					onClick={rowClick.bind(null, item)}
					href={rowTarget(item)}
					key={item.id}
				>
					{item.name}
				</Row>
			),
			direction: direction.name,
			directionWidget: <Label icon={direction.icon} name={direction.name} />,
		};
	};

	return (
		<>
			<Table
				name="languages"
				columns={columns}
				mapper={mapper}
				store={LanguagesStore}
				data={data}
			/>
		</>
	);
}
