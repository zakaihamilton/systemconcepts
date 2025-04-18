import { useCallback } from "react";
import styles from "./Item.module.scss";
import ItemMenu from "./ItemMenu";
import { LibrarianStore } from "../Librarian";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useTranslations } from "@util/translations";
import { addPath } from "@util/pages";
import clsx from "clsx";
import Row from "@widgets/Row";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";

export default function Item({ data: { isLeaf, nestingLevel, item, remove }, isOpen, style, toggle }) {
    const { select } = LibrarianStore.useState();

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
            addPath("tag/" + item.id + "?name=" + item.label);
        }
        else if (item.type === "content") {
            addPath("content/" + item.content[0] + "?name=" + item.label);
        }
    }, [select, item]);

    const translations = useTranslations();
    const basePadding = (nestingLevel * 32) + 8;
    const { label = "" } = item;
    const icons = <>
        <IconButton className={clsx(isLeaf && styles.hidden)} onClick={toggle} size="large">
            <Tooltip arrow title={isOpen ? translations.COLLAPSE : translations.EXPAND}>
                {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Tooltip>
        </IconButton>
        {item.type === "set" && <FolderIcon />}
        {item.type === "tag" && <Tooltip title={translations.TAG} arrow>
            <LocalOfferIcon />
        </Tooltip>}
        {item.type === "content" && <Tooltip title={translations.CONTENT} arrow>
            <DescriptionIcon />
        </Tooltip>}
        {item.type === "content" && <ItemMenu remove={remove} item={item} store={LibrarianStore} />}
    </>;
    return <Row
        className={styles.root}
        iconPadding={item.type === "content" ? 150 : 110}
        basePadding={basePadding}
        icons={icons}
        style={style}
        onClick={tagClick}>
        {label}
    </Row>;
}