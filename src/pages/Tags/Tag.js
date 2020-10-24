import styles from "./Tag.module.scss";
import ItemMenu from "./ItemMenu";
import { TagsStore } from "../Tags";
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { useTranslations } from "@/util/translations";

export default function Tag({ data: { isLeaf, ...item }, isOpen, style, toggle }) {
    const translations = useTranslations();
    const { name } = item;
    return <div className={styles.root} style={style}>
        {!isLeaf && (
            <IconButton onClick={toggle}>
                <Tooltip arrow title={translations.EXPAND}>
                    {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Tooltip>
            </IconButton>
        )}
        <ItemMenu item={item} store={TagsStore} />
        <div>{name}</div>
    </div>;
}