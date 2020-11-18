import Table from "@widgets/Table";
import data from "@data/languages";
import { useTranslations } from "@util/translations";
import FormatTextdirectionLToRIcon from '@material-ui/icons/FormatTextdirectionLToR';
import FormatTextdirectionRToLIcon from '@material-ui/icons/FormatTextdirectionRToL';
import Label from "@widgets/Label";
import { addPath, toPath } from "@util/pages";
import { Store } from "pullstate";
import Row from "@widgets/Row";

export const LanguagesStore = new Store({
    order: "desc",
    offset: 0,
    orderBy: ""
});

export default function Languages() {
    const translations = useTranslations();

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name",
            padding:false
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

    const rowClick = item => {
        addPath("translations?language=" + item.id);
    };

    const rowTarget = item => {
        return "#" + toPath("settings", "languages", "translations?language=" + item.id);
    };

    const mapper = item => {
        let { direction } = item;
        direction = directions.find(item => item.id === direction);
        return {
            ...item,
            nameWidget: <Row onClick={rowClick.bind(this, item)} href={rowTarget(item)} key={item.id}>
                {item.name}
            </Row>,
            direction: direction.name,
            directionWidget: <Label icon={direction.icon} name={direction.name} />
        };
    };

    return <>
        <Table
            name="languages"
            columns={columns}
            mapper={mapper}
            store={LanguagesStore}
            data={data} />
    </>;
}
