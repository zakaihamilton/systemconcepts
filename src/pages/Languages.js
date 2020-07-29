import Table from "@/widgets/Table";
import languages from "@/data/languages";
import { useTranslations } from "@/util/translations";
import FormatTextdirectionLToRIcon from '@material-ui/icons/FormatTextdirectionLToR';
import FormatTextdirectionRToLIcon from '@material-ui/icons/FormatTextdirectionRToL';
import Label from "@/widgets/Label";

export default function Languages() {
    const translations = useTranslations();

    const columns = [
        {
            id: "name",
            title: translations.COLUMN_NAME,
            sortable: true
        },
        {
            id: "directionWidget",
            title: translations.COLUMN_DIRECTION,
            sortable: "direction"
        }
    ];

    const directions = [
        {
            id: "ltr",
            name: translations.LEFT_TO_RIGHT,
            icon: FormatTextdirectionLToRIcon
        },
        {
            id: "rtl",
            name: translations.RIGHT_TO_LEFT,
            icon: FormatTextdirectionRToLIcon
        }
    ];

    const items = languages.map(item => {
        let { direction } = item;
        direction = directions.find(item => item.id === direction);
        return {
            ...item, direction: direction.name, directionWidget: <Label icon={direction.icon} name={direction.name} />
        };
    });

    return <>
        <Table columns={columns} items={items} />
    </>;
}
