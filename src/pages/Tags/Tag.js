import { useCallback } from "react";
import styles from "./Tag.module.scss";
import ItemMenu from "./ItemMenu";
import { TagsStore } from "../Tags";
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { useTranslations } from "@util/translations";
import { addPath } from "@util/pages";
import clsx from "clsx";
import Row from "@widgets/Row";

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
    const basePadding = (nestingLevel + 1) * 8;
    const { name = item.id } = item;
    const icons = <>
        <IconButton className={clsx(isLeaf && styles.hidden)} onClick={toggle}>
            <Tooltip arrow title={translations.EXPAND}>
                {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Tooltip>
        </IconButton>
        <ItemMenu item={item} store={TagsStore} />
    </>;
    return <Row
        className={styles.root}
        iconPadding={106}
        basePadding={basePadding}
        icons={icons}
        style={style}
        onClick={onTagClick}>
        {name}
    </Row>;
}