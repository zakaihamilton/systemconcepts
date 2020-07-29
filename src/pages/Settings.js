import Table from "@/widgets/Table";
import Input from "@/widgets/Input";
import Switch from "@/widgets/Switch";
import { useStoreState } from "@/util/store";
import { MainStore } from "../components/Main";
import MenuItem from '@material-ui/core/MenuItem';

export default function Settings() {
    const states = useStoreState(MainStore);

    const columns = [
        {
            id: "name",
            title: "Name",
            sortable: true
        },
        {
            id: "widget",
            title: "Setting",
            sortable: "value"
        }
    ];

    const items = [
        {
            id: "language",
            name: "Language",
            value: states.language[0],
            widget: <Input variant="outlined" state={states.language} select={true}>
                <MenuItem value="eng">English</MenuItem>
                <MenuItem value="heb">עברית</MenuItem>
            </Input>
        },
        {
            id: "darkMode",
            name: "Dark Mode",
            value: states.darkMode[0],
            widget: <Switch state={states.darkMode} />
        }
    ];

    return <>
        <Table columns={columns} items={items} />
    </>;
}
