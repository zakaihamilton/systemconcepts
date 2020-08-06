import Table from "@/widgets/Table";
import StorageIcon from '@material-ui/icons/Storage';
import { useTranslations } from "@/util/translations";
import Label from "@/widgets/Label";
import { useListing } from "@/util/storage";
import Progress from "@/widgets/Progress";
import Actions, { useActions } from "./Storage/Actions";

export default function Storage({ path = "" }) {
    const translations = useTranslations();
    const [listing, loading] = useListing(path);

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        }
    ];

    let items = (listing || []).map(item => {
        const name = translations[item.name];
        return {
            ...item,
            name,
            nameWidget: <Label key={item.id} icon={StorageIcon} name={name} />
        };
    });

    useActions(items);

    const rowClick = (_, id) => {
        window.location.hash = encodeURI("storage?path=" + [path, id].filter(Boolean).join("/"));
    };

    return <>
        <Table rowClick={rowClick} columns={columns} items={items} />
        {loading && <Progress />}
        <Actions />
    </>;
}
