import Table from "@/widgets/Table";
import Fab from "@/widgets/Fab";

export default function Settings() {

    const columns = [
        {
            id: "name",
            title: "Name"
        }
    ];

    return <div style={{ height: "1000px" }}>
        <Table columns={columns} />
        <Fab />
    </div>;
}
