import styles from "./Navigator.module.scss";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import LastPageIcon from "@mui/icons-material/LastPage";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useTranslations } from "@util/translations";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import clsx from "clsx";
import TextField from "@mui/material/TextField";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import { useDirection } from "@util/direction";
import DelayInput from "@widgets/DelayInput";

registerToolbar("Navigator");

export default function Navigator({ numItems, pageIndex, pageCount, setPageIndex }) {
    const direction = useDirection();
    const translations = useTranslations();
    const hasPreviousPage = pageIndex >= 1;
    const hasNextPage = pageIndex < pageCount - 1;

    const gotoFirstPage = () => {
        setPageIndex && setPageIndex(0);
    };

    const gotoPreviousPage = () => {
        setPageIndex && setPageIndex(pageIndex - 1);
    };

    const gotoNextPage = () => {
        setPageIndex && setPageIndex(pageIndex + 1);
    };

    const gotoLastPage = () => {
        setPageIndex && setPageIndex(pageCount - 1);
    };

    const handlePageChange = event => {
        let pageIndex = event.target.value - 1;
        if (pageIndex < 0) {
            pageIndex = 0;
        }
        else if (pageIndex > pageCount - 1) {
            pageIndex = pageCount - 1;
        }
        setPageIndex && setPageIndex(pageIndex);
    };

    const toolbarItems = [
        {
            id: "firstPage",
            name: translations.FIRST_PAGE,
            icon: direction === "rtl" ? <LastPageIcon /> : <FirstPageIcon />,
            onClick: gotoFirstPage,
            location: "footer",
            disabled: !hasPreviousPage
        },
        {
            id: "previousPage",
            name: translations.PREVIOUS_PAGE,
            icon: direction === "rtl" ? <ChevronRightIcon /> : <ChevronLeftIcon />,
            onClick: gotoPreviousPage,
            location: "footer",
            disabled: !hasPreviousPage
        },
        {
            id: "page",
            location: "footer",
            element: (<>
                <Tooltip title={translations.PAGE_INDEX} arrow>
                    <DelayInput onChange={handlePageChange} value={pageIndex + 1}>
                        <TextField className={styles.pageIndex} />
                    </DelayInput>
                </Tooltip>
                <Typography className={clsx(styles.pageSeparator)}>
                    /
                </Typography>
                <Tooltip title={<>
                    <div style={{ whiteSpace: "nowrap" }}>
                        <span>{translations.NUM_ITEMS}: </span>
                        <span>{numItems}</span>
                        <hr />
                    </div>
                    <div>{translations.PAGE_COUNT}</div>
                </>} arrow>
                    <Typography className={styles.pageCount}>
                        {pageCount}
                    </Typography>
                </Tooltip>
            </>)
        },
        {
            id: "nextPage",
            name: translations.NEXT_PAGE,
            icon: direction === "rtl" ? <ChevronLeftIcon /> : <ChevronRightIcon />,
            onClick: gotoNextPage,
            location: "footer",
            disabled: !hasNextPage
        },
        {
            id: "lastPage",
            name: translations.LAST_PAGE,
            icon: direction === "rtl" ? <FirstPageIcon /> : <LastPageIcon />,
            onClick: gotoLastPage,
            location: "footer",
            disabled: !hasNextPage
        }
    ].filter(Boolean);

    useToolbar({ id: "Navigator", items: toolbarItems, visible: pageCount > 1, depends: [translations, pageIndex, pageCount] });

    return null;
}