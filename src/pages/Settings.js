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
import useMediaQuery from '@material-ui/core/useMediaQuery';
import Button from "@/widgets/Button";
import ActionBar from "@/widgets/ActionBar";

export default function Settings() {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
    const prefferedLanguage = languages.find(item => navigator.language.includes(item.code)) || languages[0];
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

    const languageItems = [
        {
            id: "auto",
            name: translations.AUTO,
            tooltip: prefferedLanguage.name
        },
        ...languages
    ]

    const darkModeItems = [
        {
            id: "auto",
            name: translations.AUTO,
            tooltip: prefersDarkMode ? "Dark Mode Preferred" : "Light Mode Preferred"
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
        name: translations[item.name]
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
            widget: <Dynamic items={languageItems} state={states.language} />,
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
        <ActionBar>
            <Button onClick={() => window.location.hash += encodeURI("/reset")}>
                {translations.RESET}
            </Button>
        </ActionBar>
    </>;
}
