import Table from "@/widgets/Table";
import data from "@/data/terms";
import { useTranslations } from "@/util/translations";
import { useLanguage } from "@/util/language";
import Term from "@/widgets/Term";
import { useState } from "react";

export default function Terms() {
    const translations = useTranslations();
    const language = useLanguage();
    const [typeFilter, setTypeFilter] = useState("");

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        },
        {
            id: "typeWidget",
            title: translations.TYPE,
            sortable: "type",
            tags: [typeFilter && {
                id: typeFilter,
                name: <Term id={typeFilter} />,
                onDelete: () => setTypeFilter("")
            }]
        }
    ];

    const mapper = item => {
        let { id, name, type, phase } = item;
        let sortId = [type, phase, id].filter(item => typeof item !== "undefined").join(".");
        if (typeof name === "object") {
            name = name[language];
        }
        else if (typeof name === "string") {
            name = translations[name];
        }
        if (type) {
            id = type + "." + id;
        }
        const typeClick = () => {
            setTypeFilter(filter => {
                if (filter !== type) {
                    return type;
                }
                return "";
            });
        };
        return {
            ...item,
            sortId,
            name,
            nameWidget: <Term id={id} />,
            typeWidget: <Term id={type} onClick={!typeFilter && typeClick} />
        };
    };

    const filter = item => {
        let { type } = item;
        return !typeFilter || typeFilter === type;
    };

    return <>
        <Table
            name="terms"
            columns={columns}
            mapper={mapper}
            filter={filter}
            data={data}
            rowHeight="5em"
            sortColumn="sortId"
            reset={[typeFilter]}
            depends={[typeFilter]} />
    </>;
}
