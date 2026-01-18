import Table from "@widgets/Table";
import { useStoreState } from "@util/store";
import { MainStore } from "../components/Main";
import LanguageIcon from "@mui/icons-material/Language";
import InvertColorsIcon from "@mui/icons-material/InvertColors";
import FormatSizeIcon from "@mui/icons-material/FormatSize";
import SettingsBackupRestoreIcon from "@mui/icons-material/SettingsBackupRestore";
import SlowMotionVideoIcon from "@mui/icons-material/SlowMotionVideo";
import languages from "@data/languages";
import fontSizes from "@data/fontSizes";
import { useTranslations } from "@util/translations";
import { useCallback } from "react";
import Dynamic from "@widgets/Dynamic";
import { useDeviceType } from "@util/styles";
import Button from "@mui/material/Button";
import { addPath, toPath } from "@util/pages";
import { Store } from "pullstate";
import BuildIcon from "@mui/icons-material/Build";
import useDarkMode from "use-dark-mode";
import Row from "@widgets/Row";
import StorageIcon from "@mui/icons-material/Storage";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import Cookies from "js-cookie";
import { SyncActiveStore } from "@sync/syncState";
import ImportExportIcon from "@mui/icons-material/ImportExport";

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

    const speedToolbarItems = [
        {
            id: "top",
            name: translations.TOP
        },
        {
            id: "bottom",
            name: translations.BOTTOM
        }
    ];

    const fontSizeItems = fontSizes.filter(item => item.devices.includes(deviceType)).map(item => ({
        id: item.id,
        name: translations[item.name]
    }));

    const role = Cookies.get("role");
    const isAdmin = role === "admin";
    const { locked } = SyncActiveStore.useState();

    const setUpload = useCallback(value => {
        SyncActiveStore.update(s => {
            s.locked = value === "off";
        });
    }, []);

    const uploadState = [locked ? "off" : "on", setUpload];

    const showUpload = isAdmin;

    const uploadItems = [
        {
            id: "on",
            name: translations.ON
        },
        {
            id: "off",
            name: translations.OFF
        }
    ];

    const data = [
        {
            id: "language",
            icon: <LanguageIcon />,
            name: translations.LANGUAGE,
            description: translations.LANGUAGE_DESCRIPTION,
            value: states.language[0],
            widget: <Dynamic items={languageItems} state={states.language} />,
            target: "languages"
        },
        {
            id: "darkMode",
            icon: <InvertColorsIcon />,
            name: translations.DARK_MODE,
            description: translations.DARK_MODE_DESCRIPTION,
            value: darkModeSelected,
            widget: <Dynamic items={darkModeItems} state={darkModeState} />
        },
        showUpload && {
            id: "upload",
            icon: <ImportExportIcon />,
            name: translations.UPLOAD || "Upload",
            description: translations.UPLOAD_DESCRIPTION,
            value: uploadState[0],
            widget: <Dynamic items={uploadItems} state={uploadState} />
        },
        {
            id: "speedToolbar",
            icon: <SlowMotionVideoIcon />,
            name: translations.SPEED_TOOLBAR,
            description: translations.SPEED_TOOLBAR_DESCRIPTION,
            value: states.speedToolbar[0],
            widget: <Dynamic items={speedToolbarItems} state={states.speedToolbar} />
        },
        {
            id: "fontSize",
            icon: <FormatSizeIcon />,
            name: translations.FONT_SIZE,
            description: translations.FONT_SIZE_DESCRIPTION,
            value: states.fontSize[0],
            widget: <Dynamic items={fontSizeItems} state={states.fontSize} />,
            target: "fontSizes"
        },
        {
            id: "fullSync",
            icon: <StorageIcon />,
            name: translations.FULL_SYNC,
            description: translations.FULL_SYNC_DESCRIPTION,
            widget: <Button variant="contained" onClick={() => addPath("fullSync")}>
                {translations.FULL_SYNC}
            </Button>
        },
        {
            id: "clearStorage",
            icon: <DeleteForeverIcon />,
            name: translations.CLEAR_STORAGE,
            description: translations.CLEAR_STORAGE_DESCRIPTION,
            widget: <Button variant="contained" color="error" onClick={() => addPath("clearStorage")}>
                {translations.CLEAR_STORAGE}
            </Button>
        },
        {
            id: "reset",
            icon: <SettingsBackupRestoreIcon />,
            name: translations.RESET_SETTINGS,
            description: translations.RESET_SETTINGS_DESCRIPTION,
            widget: <Button variant="contained" onClick={() => addPath("reset")}>
                {translations.RESET}
            </Button>
        },
        {
            id: "version",
            icon: <BuildIcon />,
            name: translations.VERSION,
            description: translations.VERSION_DESCRIPTION,
            widget: process.env.NEXT_PUBLIC_VERSION
        }
    ].filter(Boolean);

    const mapper = item => {
        const { icon, name, description, ...props } = item;
        const href = item.target && target(item);
        const onClick = () => navigate(item.target);
        props.title = <Row onClick={item.target ? onClick : undefined} href={href} key={item.id} icons={icon}>
            <div style={{ display: "flex", flexDirection: "column" }}>
                <div>{name}</div>
                <div style={{ fontSize: "0.85em", opacity: 0.7 }}>{description}</div>
            </div>
        </Row>;
        return props;
    };

    return <>
        <Table
            hideColumns={true}
            store={SettingsStore}
            columns={columns}
            data={data}
            mapper={mapper}
            rowHeight="5em"
        />
    </>;
}
