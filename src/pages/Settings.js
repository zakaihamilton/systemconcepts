import Table from "@/widgets/Table";

export default function Settings() {

    const columns = [
        {
            id: "name",
            title: "Name"
        }
    ];

    return <div style={{ height: "1000px" }}>
        <Table columns={columns} />
    </div>;
}
