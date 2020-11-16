import Table from "@widgets/Table";
import data from "@data/diagrams";
import { useTranslations } from "@util/translations";
import { addPath } from "@util/pages";
import { useLanguage } from "@util/language";
import { Store } from "pullstate";

export const DiagramsStore = new Store({
    order: "desc",
    offset: 0,
    orderBy: ""
});

export default function Diagrams() {
    const translations = useTranslations();
    const language = useLanguage();

    const columns = [
        {
            id: "name",
            title: translations.NAME,
            sortable: true
        }
    ];

    const mapper = item => {
        let { name } = item;
        if (typeof name === "object") {
            name = name[language];
        }
        else if (typeof name === "string") {
            name = translations[name];
        }
        return {
            ...item,
            name
        };
    };

    const rowClick = (_, item) => {
        addPath(item.id);
    };

    const rowTarget = item => {
        return "#" + item.id;
    };

    return <>
        <Table
            name="diagrams"
            store={DiagramsStore}
            rowClick={rowClick}
            rowTarget={rowTarget}
            columns={columns}
            mapper={mapper}
            data={data}
        />
    </>;
}
