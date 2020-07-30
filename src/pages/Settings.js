import Table from "@/widgets/Table";
import { useStoreState } from "@/util/store";
import { MainStore } from "../components/Main";
import LanguageIcon from '@material-ui/icons/Language';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import FormatSizeIcon from '@material-ui/icons/FormatSize';
import languages from "@/data/languages";
import fontSizes from "@/data/fontSizes";
import { useTranslations } from "@/util/translations";
import Label from "@/widgets/Label";
import { useState, useEffect } from "react";
import Dynamic from "@/widgets/Dynamic";
import { useDeviceType } from "@/util/styles";

export default function Settings() {
    const translations = useTranslations();
    const states = useStoreState(MainStore);
    const deviceType = useDeviceType();
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
            if (darkMode !== "auto") {
                s.darkMode = darkMode === "on"
            }
        });
    }, [darkModeState[0]]);

    const columns = [
        {
            id: "title",
            title: translations.NAME,
            sortable: "name"
        },
        {
            id: "widget",
            title: translations.SETTING,
            sortable: "value"
        }
    ];

    const darkModeItems = [
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
    ];

    const fontSizeItems = fontSizes.filter(item => item.devices.includes(deviceType)).map(item => ({
        id: item.id,
        name: item.name
    }));

    const navigate = id => {
        window.location.hash += encodeURI("/" + id);
    };

    const items = [
        {
            id: "language",
            icon: LanguageIcon,
            name: translations.LANGUAGE,
            value: states.language[0],
            widget: <Dynamic items={languages} state={states.language} />,
            onClick: () => navigate("languages")
        },
        {
            id: "darkMode",
            icon: Brightness4Icon,
            name: translations.DARK_MODE,
            value: darkModeState[0],
            widget: <Dynamic items={darkModeItems} state={darkModeState} />
        },
        {
            id: "fontSize",
            icon: FormatSizeIcon,
            name: translations.FONT_SIZE,
            value: states.fontSize[0],
            widget: <Dynamic items={fontSizeItems} state={states.fontSize} />,
            onClick: () => navigate("fontSizes")
        }
    ].map(item => {
        const { icon, onClick, ...props } = item;
        props.title = <Label key={item.id} icon={icon} name={item.name} onClick={onClick} />;
        return props;
    });

    return <>
        <Table columns={columns} items={items} />
    </>;
}
