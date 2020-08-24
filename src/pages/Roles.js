import { useEffect } from "react";
import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { useFetchJSON, fetchJSON } from "@/util/fetch";
import Progress from "@/widgets/Progress";
import Label from "@/widgets/Label";
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from '@material-ui/core/IconButton';
import Menu from "@/widgets/Menu";
import Tooltip from '@material-ui/core/Tooltip';
import DeleteIcon from '@material-ui/icons/Delete';
import StatusBar from "@/widgets/StatusBar";
import { Store } from "pullstate";
import Checkbox from '@/components/Widgets/Checkbox';
import Fab from "@/widgets/Fab";
import AddIcon from '@material-ui/icons/Add';

export const RolesStoreDefaults = {
    mode: "",
    name: "",
    select: null,
    counter: 1,
    onDone: null
};

export const RolesStore = new Store(RolesStoreDefaults);

export default function Roles() {
    const apiPath = "/api/roles";
    const translations = useTranslations();
    const { mode, select, counter } = RolesStore.useState();
    const [data, , loading] = useFetchJSON(apiPath, {}, [counter]);

    useEffect(() => {
        RolesStore.update(s => {
            Object.assign(s, RolesStoreDefaults);
        });
    }, []);

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        },
        {
            id: "type",
            title: translations.TYPE,
            sortable: true
        },
    ];

    const mapper = item => {
        let { firstName, lastName } = item;
        const id = item.email;
        const name = [firstName, lastName].filter(Boolean).join(" ");

        const items = [
            {
                id: "delete",
                name: translations.DELETE,
                icon: <DeleteIcon />,
                onClick: () => {
                    RolesStore.update(s => {
                        s.select = [{ ...item, id }];
                        s.mode = "delete";
                        s.severity = "info";
                        s.onDone = async select => {
                            const ids = select.map(item => item.id);
                            await fetchJSON(apiPath, { headers: { ids }, method: "DELETE" });
                        }
                    });
                }
            }
        ];

        const menuIcon = !select && <Menu items={items}>
            <IconButton>
                <Tooltip title={translations.MENU}>
                    <MoreVertIcon />
                </Tooltip>
            </IconButton>
        </Menu>;
        const selectIcon = select && <Checkbox select={select} item={item} store={RolesStore} />;

        return {
            ...item,
            id,
            name,
            nameWidget: <Label name={<>
                <b>{firstName}</b>
                {lastName}
            </>} icon={select ? selectIcon : menuIcon} />
        };
    };

    const statusBar = <StatusBar data={data} mapper={mapper} store={RolesStore} />;

    const createRole = () => {

    };

    return <>
        <Table
            columns={columns}
            data={data}
            mapper={mapper}
            statusBar={statusBar}
            depends={[mode, select]}
            rowHeight="6em"
        />
        {loading && <Progress />}
        <Fab onClick={!mode && createRole} icon={<AddIcon />} title={translations.ADD_ROLE} />
    </>;
}
