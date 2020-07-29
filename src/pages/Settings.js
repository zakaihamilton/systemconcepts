import Table from "@/widgets/Table";
import Input from "@/widgets/Input";
import Switch from "@/widgets/Switch";
import { useStoreState } from "@/util/store";
import { MainStore } from "../components/Main";
import MenuItem from '@material-ui/core/MenuItem';
import LanguageIcon from '@material-ui/icons/Language';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import languages from "@/data/languages";
import { useTranslations } from "@/util/translations";
import Label from "@/widgets/Label";

export default function Settings() {
    const translations = useTranslations();
    const states = useStoreState(MainStore);

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

    const languageItems = languages.map(({ id, name }) => (<MenuItem value={id}>{name}</MenuItem>));

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
            value: states.darkMode[0],
            widget: <Switch state={states.darkMode} />
        }
    ].map(item => {
        const { icon, ...props } = item;
        props.title = <Label icon={icon} name={item.name} />;
        return props;
    });

    return <>
        <Table columns={columns} items={items} />
    </>;
}
