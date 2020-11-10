import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from '@material-ui/core/IconButton';
import Menu from "@widgets/Menu";
import { useTranslations } from "@util/translations";
import Tooltip from '@material-ui/core/Tooltip';
import Select from '@components/Widgets/Select';

export default function ItemMenuWidget({ item, menuItems, store }) {
    const translations = useTranslations();
    const select = store.useState(s => s.select);

    return (<>
        {!!select && <Select select={select} item={item} store={store} />}
        {!select && <Menu items={menuItems}>
            <IconButton>
                <Tooltip title={translations.MENU}>
                    <MoreVertIcon />
                </Tooltip>
            </IconButton>
        </Menu>}
    </>);
}
