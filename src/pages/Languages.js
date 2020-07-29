import Table from "@/widgets/Table";
import languages from "@/data/languages";

export default function Languages() {

    const columns = [
        {
            id: "name",
            title: "Name",
            sortable: true
        },
        {
            id: "direction",
            title: "Direction",
            sortable: true
        }
    ];

    const directions = [
        {
            id: "ltr",
            name: "Left to Right"
        },
        {
            id: "rtl",
            name: "Right to Left"
        }
    ];

    const items = languages.map(item => {
        let { direction } = item;
        direction = directions.find(item => item.id === direction).name;
        return {
            ...item, direction
        };
    });

    return <>
        <Table columns={columns} items={items} />
    </>;
}
