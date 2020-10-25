import { useEffect, useRef } from "react";
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from '@material-ui/core/IconButton';
import { useHover } from "@util/hooks";
import Menu from "@widgets/Menu";
import { useTranslations } from "@util/translations";
import Tooltip from '@material-ui/core/Tooltip';
import Select from '@components/Widgets/Select';

export default function ItemMenuWidget({ viewMode = "table", item, menuItems, store }) {
    const [ref, isHover] = useHover();
    const isVisible = useRef();
    const translations = useTranslations();
    const select = store.useState(s => s.select);

    const updateHover = () => {
        if (viewMode === "table") {
            if (!isVisible.current) {
                store.update(s => {
                    s.enableItemClick = !isHover;
                });
            }
        }
    };

    const onMenuVisible = visible => {
        isVisible.current = visible;
        updateHover();
    };

    useEffect(() => {
        updateHover();
    }, [isHover]);

    return (<>
        {select && <Select select={select} item={item} store={store} />}
        {!select && <Menu items={menuItems} onVisible={onMenuVisible}>
            <IconButton ref={ref}>
                <Tooltip title={translations.MENU}>
                    <MoreVertIcon />
                </Tooltip>
            </IconButton>
        </Menu>}
    </>);
}
