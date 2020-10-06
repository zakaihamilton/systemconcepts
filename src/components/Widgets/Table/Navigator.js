import styles from "./Navigator.module.scss";
import FirstPageIcon from '@material-ui/icons/FirstPage';
import LastPageIcon from '@material-ui/icons/LastPage';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { useTranslations } from "@/util/translations";
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';
import { useDeviceType } from "@/util/styles";
import clsx from "clsx";
import TextField from '@material-ui/core/TextField';
import { registerToolbar, useToolbar } from "@/components/Toolbar";

registerToolbar("Navigator");

export default function Navigator({ pageIndex, pageCount, setPageIndex }) {
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

    const menuItems = [
        {
            id: "firstPage",
            name: translations.FIRST_PAGE,
            icon: <FirstPageIcon />,
            onClick: gotoFirstPage,
            location: "footer",
            disabled: !hasPreviousPage
        },
        {
            id: "previousPage",
            name: translations.PREVIOUS_PAGE,
            icon: <ChevronLeftIcon />,
            onClick: gotoPreviousPage,
            location: "footer",
            disabled: !hasPreviousPage,
            divider: true
        },
        {
            id: "page",
            location: "footer",
            divider: true,
            element: (<>
                <Tooltip title={translations.PAGE_INDEX} arrow>
                    <TextField className={styles.pageIndex} onChange={handlePageChange} value={pageIndex + 1} />
                </Tooltip>
                <Typography className={clsx(styles.pageSeparator)}>
                    /
                </Typography>
                <Tooltip title={translations.PAGE_COUNT} arrow>
                    <Typography className={styles.pageCount}>
                        {pageCount}
                    </Typography>
                </Tooltip>
            </>)
        },
        {
            id: "nextPage",
            name: translations.NEXT_PAGE,
            icon: <ChevronRightIcon />,
            onClick: gotoNextPage,
            location: "footer",
            disabled: !hasNextPage
        },
        {
            id: "lastPage",
            name: translations.LAST_PAGE,
            icon: <LastPageIcon />,
            onClick: gotoLastPage,
            location: "footer",
            disabled: !hasNextPage
        }
    ].filter(Boolean);

    useToolbar({ id: "Navigator", items: menuItems, visible: pageCount > 1, depends: [translations, pageIndex, pageCount] });

    return null;
}