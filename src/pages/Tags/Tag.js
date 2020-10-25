import { useCallback } from "react";
import styles from "./Tag.module.scss";
import ItemMenu from "./ItemMenu";
import { TagsStore } from "../Tags";
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { useTranslations } from "@util/translations";
import Label from "@widgets/Label";
import { addPath } from "@util/pages";
import clsx from "clsx";

export default function Tag({ data: { isLeaf, nestingLevel, ...item }, isOpen, style, toggle }) {
    const { enableItemClick, select } = TagsStore.useState();

    const tagClick = useCallback(() => {
        const { id } = item;
        if (select) {
            const exists = select.find(item => item.id === id);
            TagsStore.update(s => {
                if (exists) {
                    s.select = select.filter(item => item.id !== id);
                }
                else {
                    s.select = [...select, item];
                }
            });
            return;
        }
        addPath("tag/" + item.id);
    }, [select]);

    const onTagClick = enableItemClick ? tagClick : undefined;

    const translations = useTranslations();
    const { name = item.id } = item;
    const icon = <ItemMenu item={item} store={TagsStore} />;
    style = { ...style };
    style.paddingLeft = nestingLevel * 8;
    return <div className={styles.root} style={style} onClick={onTagClick}>
        <IconButton className={clsx(isLeaf && styles.hidden)} onClick={toggle}>
            <Tooltip arrow title={translations.EXPAND}>
                {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Tooltip>
        </IconButton>
        <Label style={{ userSelect: "none" }} icon={icon} name={name} />
    </div>;
}