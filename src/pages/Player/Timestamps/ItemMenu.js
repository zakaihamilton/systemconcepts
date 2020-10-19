import { useTranslations } from "@/util/translations";
import DeleteIcon from '@material-ui/icons/Delete';
import { TimestampsStore } from "../Timestamps";
import ItemMenu from "@/components/ItemMenu";

export default function ItemMenuWidget({ viewMode, setMetadata, item }) {
    const translations = useTranslations();

    const items = [
        {
            id: "rename",
            name: translations.RENAME,
            onClick: () => {
                TimestampsStore.update(s => {
                    s.mode = "rename";
                    s.type = item.type;
                    s.name = item.name;
                    s.item = item;
                    s.icon = item.icon;
                    s.tooltip = item.tooltip;
                    s.placeholder = "";
                    s.editing = true;
                    s.onValidate = async name => {
                        return !!name;
                    };
                    s.onDone = async name => {
                        setMetadata(metadata => {
                            const timestamps = [...metadata.timestamps].map(timestamp => {
                                timestamp = { ...timestamp };
                                if (timestamp.id === item.id) {
                                    timestamp.name = name;
                                }
                                return timestamp;
                            });
                            return { ...metadata, timestamps };
                        });
                    }
                });
            }
        },
        {
            id: "delete",
            name: translations.DELETE,
            icon: <DeleteIcon />,
            onClick: () => {
                TimestampsStore.update(s => {
                    s.select = [item];
                    s.mode = "delete";
                    s.severity = "info";
                    s.onDone = async select => {
                        setMetadata(metadata => {
                            metadata.timestamps = metadata.timestamps.filter(timestamp => {
                                return !select.find(item => item.id === timestamp.id);
                            });
                            return { ...metadata };
                        });
                    }
                });
            }
        }
    ];

    return <ItemMenu viewMode={viewMode} items={items} store={TimestampsStore} />;
}
