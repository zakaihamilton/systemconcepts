import { useCallback } from "react";
import styles from "./Item.module.scss";
import ItemMenu from "./ItemMenu";
import { LibrarianStore } from "../Librarian";
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { useTranslations } from "@util/translations";
import { addPath } from "@util/pages";
import clsx from "clsx";
import Row from "@widgets/Row";
import LocalOfferIcon from '@material-ui/icons/LocalOffer';
import DescriptionIcon from '@material-ui/icons/Description';
import FolderIcon from '@material-ui/icons/Folder';

export default function Item({ data: { isLeaf, nestingLevel, item, remove }, isOpen, style, toggle }) {
    const { enableItemClick, select } = LibrarianStore.useState();

    const tagClick = useCallback(() => {
        const { id } = item;
        if (select) {
            const exists = select.find(item => item.id === id);
            LibrarianStore.update(s => {
                if (exists) {
                    s.select = select.filter(item => item.id !== id);
                }
                else {
                    s.select = [...select, item];
                }
            });
            return;
        }
        if (item.type === "tag") {
            addPath("tag?tag=" + item.id);
        }
        else if (item.type === "content") {
            addPath("content/" + item.name + "?name=" + item.label);
        }
    }, [select]);

    const onTagClick = enableItemClick ? tagClick : undefined;

    const translations = useTranslations();
    const basePadding = (nestingLevel * 32) + 8;
    const { label = "" } = item;
    const icons = <>
        <IconButton className={clsx(isLeaf && styles.hidden)} onClick={toggle}>
            <Tooltip arrow title={isOpen ? translations.COLLAPSE : translations.EXPAND}>
                {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Tooltip>
        </IconButton>
        {item.type === "set" && <FolderIcon />}
        {item.type === "tag" && <LocalOfferIcon />}
        {item.type === "content" && <DescriptionIcon />}
        {item.type === "content" && <ItemMenu remove={remove} item={item} store={LibrarianStore} />}
    </>;
    return <Row
        className={styles.root}
        iconPadding={item.type === "content" ? 140 : 90}
        basePadding={basePadding}
        icons={icons}
        style={style}
        onClick={onTagClick}>
        {label}
    </Row>;
}