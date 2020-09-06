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
    const [phaseFilter, setPhaseFilter] = useState("");

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        },
        {
            id: "phaseWidget",
            title: translations.PHASE,
            sortable: "phase",
            onSelectable: item => typeof item.phase !== "undefined" && !phaseFilter,
            tags: [phaseFilter && {
                id: phaseFilter,
                name: <Term id={phaseFilter} />,
                onDelete: () => setPhaseFilter("")
            }],
            onClick: !phaseFilter && (item => setPhaseFilter(typeof item.phase !== "undefined" && "phase." + item.phase))
        },
        {
            id: "typeWidget",
            title: translations.TYPE,
            sortable: "type",
            onSelectable: item => item.type && !typeFilter,
            tags: [typeFilter && {
                id: typeFilter,
                name: <Term id={typeFilter} />,
                onDelete: () => setTypeFilter("")
            }],
            onClick: !typeFilter && (item => setTypeFilter(item.type))
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
        return {
            ...item,
            sortId,
            name,
            nameWidget: <Term id={id} />,
            phaseWidget: <Term id={"phase." + phase} />,
            typeWidget: <Term id={type} />
        };
    };

    const filter = item => {
        let { type, phase } = item;
        let show = !typeFilter || typeFilter === type;
        show = show && (!phaseFilter || phaseFilter === "phase." + phase);
        return show;
    };

    return <>
        <Table
            name="terms"
            columns={columns}
            mapper={mapper}
            filter={filter}
            data={data}
            rowHeight="5.5em"
            sortColumn="sortId"
            reset={[typeFilter, phaseFilter]}
            depends={[typeFilter, phaseFilter]} />
    </>;
}
