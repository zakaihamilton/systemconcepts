import Table from "@widgets/Table";
import { useStoreState } from "@util/store";
import { MainStore } from "../components/Main";
import LanguageIcon from '@material-ui/icons/Language';
import InvertColorsIcon from '@material-ui/icons/InvertColors';
import FormatSizeIcon from '@material-ui/icons/FormatSize';
import SettingsBackupRestoreIcon from '@material-ui/icons/SettingsBackupRestore';
import languages from "@data/languages";
import fontSizes from "@data/fontSizes";
import { useTranslations } from "@util/translations";
import Label from "@widgets/Label";
import { useCallback } from "react";
import Dynamic from "@widgets/Dynamic";
import { useDeviceType } from "@util/styles";
import useMediaQuery from '@material-ui/core/useMediaQuery';
import Button from "@material-ui/core/Button";
import { addPath } from "@util/pages";
import { Store } from "pullstate";
import BuildIcon from '@material-ui/icons/Build';

export const SettingsStore = new Store({
    order: "desc",
    offset: 0,
    orderBy: "index"
});

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
    const setDarkMode = useCallback(darkMode => {
        MainStore.update(s => {
            s.autoDetectDarkMode = darkMode === "auto";
            if (darkMode !== "auto") {
                s.darkMode = darkMode === "on"
            }
        });
    });
    const darkModeState = [darkModeSelected, setDarkMode];

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
        addPath(id);
    };

    const data = [
        {
            id: "language",
            icon: <LanguageIcon />,
            name: translations.LANGUAGE,
            value: states.language[0],
            widget: <Dynamic items={languageItems} state={states.language} />,
            onClick: () => navigate("languages")
        },
        {
            id: "darkMode",
            icon: <InvertColorsIcon />,
            name: translations.DARK_MODE,
            value: darkModeSelected,
            widget: <Dynamic items={darkModeItems} state={darkModeState} />
        },
        {
            id: "fontSize",
            icon: <FormatSizeIcon />,
            name: translations.FONT_SIZE,
            value: states.fontSize[0],
            widget: <Dynamic items={fontSizeItems} state={states.fontSize} />,
            onClick: () => navigate("fontSizes")
        },
        {
            id: "reset",
            icon: <SettingsBackupRestoreIcon />,
            name: translations.RESET_SETTINGS,
            widget: <Button variant="contained" onClick={() => addPath("reset")}>
                {translations.RESET}
            </Button>
        },
        {
            id: "version",
            icon: <BuildIcon />,
            name: translations.VERSION,
            widget: VERSION
        }
    ];

    const mapper = item => {
        const { icon, onClick, ...props } = item;
        props.title = <Label key={item.id} icon={icon} name={item.name} onClick={onClick} />;
        return props;
    };

    return <>
        <Table
            store={SettingsStore}
            columns={columns}
            data={data}
            mapper={mapper}
            rowHeight="5em"
        />
    </>;
}
