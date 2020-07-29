import Table from "@/widgets/Table";
import Fab from "@/widgets/Fab";
import Switch from "@/widgets/Switch";
import { useStoreState } from "@/util/store";
import { MainStore } from "../components/Main";

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
            title: "Value",
            sortable: "value"
        }
    ];

    const items = [
        {
            id: "direction",
            name: "Direction",
            value: false,
            widget: <Switch state={states.direction} off="ltr" on="rtl" />
        }
    ];

    return <div style={{ height: "1000px" }}>
        <Table columns={columns} items={items} />
        <Fab />
    </div>;
}
