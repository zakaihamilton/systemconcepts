import styles from "./Tag.module.scss";
import ItemMenu from "./ItemMenu";
import { TagsStore } from "../Tags";
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { useTranslations } from "@/util/translations";

export default function Tag({ data: { isLeaf, nestingLevel, ...item }, isOpen, style, toggle }) {
    const translations = useTranslations();
    const { name } = item;
    style = { ...style };
    style.paddingLeft = nestingLevel * 8;
    return <div className={styles.root} style={style}>
        <IconButton className={isLeaf && styles.hidden} onClick={toggle}>
            <Tooltip arrow title={translations.EXPAND}>
                {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Tooltip>
        </IconButton>
        <ItemMenu item={item} store={TagsStore} />
        <div>{name}</div>
    </div>;
}