import Table from "@/widgets/Table";
import data from "@/data/languages";
import { useTranslations } from "@/util/translations";
import FormatTextdirectionLToRIcon from '@material-ui/icons/FormatTextdirectionLToR';
import FormatTextdirectionRToLIcon from '@material-ui/icons/FormatTextdirectionRToL';
import Label from "@/widgets/Label";
import { addPath } from "@/util/pages";

export default function Languages() {
    const translations = useTranslations();

    const columns = [
        {
            id: "name",
            title: translations.NAME,
            sortable: true
        },
        {
            id: "directionWidget",
            title: translations.DIRECTION,
            sortable: "direction"
        }
    ];

    const directions = [
        {
            id: "ltr",
            name: translations.LEFT_TO_RIGHT,
            icon: <FormatTextdirectionLToRIcon />
        },
        {
            id: "rtl",
            name: translations.RIGHT_TO_LEFT,
            icon: <FormatTextdirectionRToLIcon />
        }
    ];

    const mapper = item => {
        let { direction } = item;
        direction = directions.find(item => item.id === direction);
        return {
            ...item,
            direction: direction.name,
            directionWidget: <Label icon={direction.icon} name={direction.name} />
        };
    };

    const rowClick = (_, item) => {
        addPath("translations?language=" + item.id);
    };

    return <>
        <Table name="languages" rowClick={rowClick} columns={columns} mapper={mapper} data={data} />
    </>;
}
