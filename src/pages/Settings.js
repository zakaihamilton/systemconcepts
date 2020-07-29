import Table from "@/widgets/Table";
import Input from "@/widgets/Input";
import Switch from "@/widgets/Switch";
import { useStoreState } from "@/util/store";
import { MainStore } from "../components/Main";
import styles from "./Settings.module.scss";
import MenuItem from '@material-ui/core/MenuItem';
import LanguageIcon from '@material-ui/icons/Language';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import languages from "@/data/languages";

export default function Settings() {
    const states = useStoreState(MainStore);

    const columns = [
        {
            id: "title",
            title: "Name",
            sortable: "name"
        },
        {
            id: "widget",
            title: "Setting",
            sortable: "value"
        }
    ];

    const languageItems = languages.map(({ id, name }) => (<MenuItem value={id}>{name}</MenuItem>));

    const items = [
        {
            id: "language",
            icon: LanguageIcon,
            name: "Language",
            value: states.language[0],
            widget: <Input variant="outlined" state={states.language} select={true}>
                {languageItems}
            </Input>
        },
        {
            id: "darkMode",
            icon: Brightness4Icon,
            name: "Dark Mode",
            value: states.darkMode[0],
            widget: <Switch state={states.darkMode} />
        }
    ].map(item => {
        const { icon: Icon, ...props } = item;
        props.title = <div className={styles.title}>{Icon && <Icon />}{item.name}</div>;
        return props;
    });

    return <>
        <Table columns={columns} items={items} />
    </>;
}
