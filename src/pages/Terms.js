import Table from "@/widgets/Table";
import data from "@/data/terms";
import { useTranslations } from "@/util/translations";
import { useLanguage } from "@/util/language";
import Term from "@/widgets/Term";
import { useState } from "react";

import { Store } from "pullstate";

export const TermsStore = new Store({
    order: "desc",
    offset: 0,
    orderBy: "sortId",
    typeFilter: "",
    phaseFilter: ""
});

export default function Terms() {
    const translations = useTranslations();
    const language = useLanguage();
    const { typeFilter, phaseFilter } = TermsStore.useState();

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
            selected: () => phaseFilter,
            onSelectable: item => typeof item.phase !== "undefined" && !phaseFilter,
            tags: [phaseFilter && {
                id: phaseFilter,
                name: <Term id={phaseFilter} />,
                onDelete: () => TermsStore.update(s => {
                    s.phaseFilter = "";
                    s.offset = 0;
                })
            }],
            onClick: !phaseFilter && (item => TermsStore.update(s => {
                s.phaseFilter = typeof item.phase !== "undefined" && "phase." + item.phase;
                s.offset = 0;
            }))
        },
        {
            id: "typeWidget",
            title: translations.TYPE,
            sortable: "type",
            selected: () => typeFilter,
            onSelectable: item => item.type && !typeFilter,
            tags: [typeFilter && {
                id: typeFilter,
                name: <Term id={typeFilter} />,
                onDelete: () => TermsStore.update(s => {
                    s.typeFilter = "";
                    s.offset = 0;
                })
            }],
            onClick: !typeFilter && (item => TermsStore.update(s => {
                s.typeFilter = item.type;
                s.offset = 0;
            }))
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
            store={TermsStore}
            depends={[typeFilter, phaseFilter, translations]} />
    </>;
}
