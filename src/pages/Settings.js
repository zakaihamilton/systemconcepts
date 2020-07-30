import Table from "@/widgets/Table";
import Input, { arrayToMenuItems } from "@/widgets/Input";
import Switch from "@/widgets/Switch";
import { useStoreState } from "@/util/store";
import { MainStore } from "../components/Main";
import LanguageIcon from '@material-ui/icons/Language';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import FormatSizeIcon from '@material-ui/icons/FormatSize';
import languages from "@/data/languages";
import { useTranslations } from "@/util/translations";
import Label from "@/widgets/Label";
import { useState, useEffect } from "react";

export default function Settings() {
    const translations = useTranslations();
    const states = useStoreState(MainStore);
    let darkModeSelected = "off";
    if (states.autoDetectDarkMode[0]) {
        darkModeSelected = "auto";
    }
    else if (states.darkMode[0]) {
        darkModeSelected = "on";
    }
    const darkModeState = useState(darkModeSelected);
    useEffect(() => {
        const darkMode = darkModeState[0];
        MainStore.update(s => {
            s.autoDetectDarkMode = darkMode === "auto";
            s.darkMode = darkMode === "on";
        });
    }, [darkModeState[0]]);

    const columns = [
        {
            id: "title",
            title: translations.COLUMN_NAME,
            sortable: "name"
        },
        {
            id: "widget",
            title: translations.COLUMN_SETTING,
            sortable: "value"
        }
    ];

    const darkModeItems = arrayToMenuItems([
        {
            id: "auto",
            name: translations.AUTO
        },
        {
            id: "off",
            name: translations.OFF
        },
        {
            id: "on",
            name: translations.ON
        }
    ]);

    const fontSizeItems = arrayToMenuItems(["10", "12", "14", "16", "18", "22", "24", "26"].map(fontSize => ({
        id: fontSize,
        name: fontSize
    })));

    const languageItems = arrayToMenuItems(languages);

    const items = [
        {
            id: "language",
            icon: LanguageIcon,
            name: translations.LANGUAGE,
            value: states.language[0],
            widget: <Input variant="outlined" state={states.language} select={true}>
                {languageItems}
            </Input>
        },
        {
            id: "darkMode",
            icon: Brightness4Icon,
            name: translations.DARK_MODE,
            value: darkModeState[0],
            widget: <Input variant="outlined" state={darkModeState} select={true}>
                {darkModeItems}
            </Input>
        },
        {
            id: "fontSize",
            icon: FormatSizeIcon,
            name: translations.FONT_SIZE,
            value: states.fontSize[0],
            widget: <Input variant="outlined" state={states.fontSize} select={true}>
                {fontSizeItems}
            </Input>
        }
    ].map(item => {
        const { icon, ...props } = item;
        props.title = <Label key={item.id} icon={icon} name={item.name} />;
        return props;
    });

    return <>
        <Table columns={columns} items={items} />
    </>;
}
