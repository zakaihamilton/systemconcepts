import MoreVertIcon from "@mui/icons-material/MoreVert";
import IconButton from "@mui/material/IconButton";
import Menu from "@widgets/Menu";
import { useTranslations } from "@util/translations";
import Tooltip from "@mui/material/Tooltip";
import Select from "@components/Widgets/Select";

export default function ItemMenuWidget({ item, menuItems, store }) {
    const translations = useTranslations();
    const select = store.useState(s => s.select);

    return (<>
        {!!select && <Select select={select} item={item} store={store} />}
        {!select && <Menu items={menuItems}>
            <Tooltip title={translations.MENU}>
                <IconButton size="large">
                    <MoreVertIcon />
                </IconButton>
            </Tooltip>
        </Menu>}
    </>);
}
