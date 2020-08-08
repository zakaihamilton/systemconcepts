import { useEffect } from "react";
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from "@/widgets/IconButton";
import { ActionStore } from "./Actions";
import { useHover } from "@/util/hooks";
import Menu from "@/widgets/Menu";
import { useTranslations } from "@/util/translations";

export default function ItemMenuWidget({ item }) {
    const [ref, isHover] = useHover();
    const translations = useTranslations();

    const items = [
        {
            id: "rename",
            name: translations.RENAME,

        }
    ];

    useEffect(() => {
        ActionStore.update(s => {
            s.enableItemClick = !isHover;
        });
    }, [isHover]);

    return (<>
        <Menu items={items}>
            <IconButton ref={ref}>
                <MoreVertIcon />
            </IconButton>
        </Menu>
    </>);
}
