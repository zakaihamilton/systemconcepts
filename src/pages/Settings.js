import Table from "@widgets/Table";
import { useStoreState } from "@util/store";
import { MainStore } from "../components/Main";
import LanguageIcon from "@material-ui/icons/Language";
import InvertColorsIcon from "@material-ui/icons/InvertColors";
import FormatSizeIcon from "@material-ui/icons/FormatSize";
import SettingsBackupRestoreIcon from "@material-ui/icons/SettingsBackupRestore";
import languages from "@data/languages";
import fontSizes from "@data/fontSizes";
import { useTranslations } from "@util/translations";
import Label from "@widgets/Label";
import { useCallback } from "react";
import Dynamic from "@widgets/Dynamic";
import { useDeviceType } from "@util/styles";
import Button from "@material-ui/core/Button";
import { addPath, toPath } from "@util/pages";
import { Store } from "pullstate";
import BuildIcon from "@material-ui/icons/Build";
import useDarkMode from "use-dark-mode";
import Row from "@widgets/Row";

export const SettingsStore = new Store({
    order: "desc",
    offset: 0,
    orderBy: "index"
});

export default function Settings() {
    const prefferedLanguage = typeof navigator !== "undefined" && languages.find(item => navigator.language.includes(item.code)) || languages[0];
    const darkMode = useDarkMode(false);
    const translations = useTranslations();
    const states = useStoreState(MainStore);
    const deviceType = useDeviceType();
    const darkModeSelected = darkMode.value ? "on" : "off";
    const setDarkMode = useCallback(value => {
        if (value === "on") {
            darkMode.enable();
        }
        else {
            darkMode.disable();
        }
    });
    const darkModeState = [darkModeSelected, setDarkMode];

    const navigate = id => {
        addPath(id);
    };

    const target = item => {
        return "#" + toPath("settings", item.target);
    };

    const columns = [
        {
            id: "title",
            title: translations.NAME,
            sortable: "name",
            padding: false
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
    ];

    const darkModeItems = [
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

    const data = [
        {
            id: "language",
            icon: <LanguageIcon />,
            name: translations.LANGUAGE,
            value: states.language[0],
            widget: <Dynamic items={languageItems} state={states.language} />,
            target: "languages"
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
            target: "fontSizes"
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
        const { icon, name, ...props } = item;
        const href = item.target && target(item);
        const onClick = () => navigate(item.target);
        props.title = <Row onClick={item.target ? onClick : undefined} href={href} key={item.id} icons={icon}>
            {name}
        </Row>;
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
