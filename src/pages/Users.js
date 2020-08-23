import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { useFetchJSON } from "@/util/fetch";
import Progress from "@/widgets/Progress";

export default function Users() {
    const translations = useTranslations();
    const [data, , loading] = useFetchJSON("/api/users");

    const columns = [
        {
            id: "name",
            title: translations.NAME,
            sortable: true
        },
        {
            id: "email",
            title: translations.EMAIL,
            sortable: true
        }
    ];

    const mapper = item => {
        let { firstName, lastName } = item;

        return {
            ...item,
            name: firstName + " " + lastName
        };
    };

    return <>
        <Table columns={columns} data={data} mapper={mapper} />
        {loading && <Progress />}
    </>;
}
