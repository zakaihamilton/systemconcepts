import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { Store } from "pullstate";
import { useGroups } from "@/util/groups";
import ColorPicker from "./Groups/ColorPicker";

export const GroupsStore = new Store({
    counter: 0
});

export default function Groups() {
    const translations = useTranslations();
    const { counter } = GroupsStore.useState();
    const [groups, loading, setGroups] = useGroups([counter]);

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        },
        {
            id: "colorWidget",
            title: translations.COLOR,
            sortable: "color"
        },
        {
            id: "userWidget",
            title: translations.USER,
            sortable: "user"
        }
    ];

    const mapper = item => {

        const changeColor = color => {
            setGroups(groups => {
                groups = [...groups];
                const index = groups.findIndex(group => group.name === item.name);
                groups[index] = { ...groups[index], color: color.hex };
                return groups;
            });
        };

        return {
            ...item,
            nameWidget: item.name[0].toUpperCase() + item.name.slice(1),
            colorWidget: <ColorPicker key={item.name} color={item.color} onChangeComplete={changeColor} />
        };
    };

    return <>
        <Table
            name="groups"
            store={GroupsStore}
            columns={columns}
            data={groups}
            refresh={() => {
                GroupsStore.update(s => {
                    s.counter++;
                });
            }}
            mapper={mapper}
            loading={loading}
            depends={[translations]}
            rowHeight="6em"
        />
    </>;
}
