import styles from "./Navigator.module.scss";
import FirstPageIcon from '@material-ui/icons/FirstPage';
import LastPageIcon from '@material-ui/icons/LastPage';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { useTranslations } from "@/util/translations";
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';
import { useDeviceType } from "@/util/styles";
import clsx from "clsx";

export default function Navigator({ pageIndex, pageCount, setPageIndex }) {
    const deviceType = useDeviceType();
    const isVertical = deviceType === "phone" || deviceType === "tablet";
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

    if (pageCount <= 1) {
        return null;
    }

    const iconClass = isVertical && styles.verticalIcon;
    const tooltipPlacement = isVertical ? "left" : "bottom";

    return <div className={clsx(styles.root, isVertical ? styles.vertical : styles.horizontal)}>
        <IconButton disabled={!hasPreviousPage} onClick={gotoFirstPage}>
            <Tooltip title={translations.FIRST_PAGE} placement={tooltipPlacement} arrow>
                <FirstPageIcon className={iconClass} />
            </Tooltip>
        </IconButton>
        <IconButton disabled={!hasPreviousPage} onClick={gotoPreviousPage}>
            <Tooltip title={translations.PREVIOUS_PAGE} placement={tooltipPlacement} arrow>
                <ChevronLeftIcon className={iconClass} />
            </Tooltip>
        </IconButton>
        <Tooltip title={translations.PAGE_INDEX} placement={tooltipPlacement} arrow>
            <Typography className={styles.pageIndex}>
                {pageIndex + 1}
            </Typography>
        </Tooltip>
        <Typography className={clsx(styles.pageSeparator, isVertical && styles.vertical)}>
            {isVertical ? "|" : "/"}
        </Typography>
        <Tooltip title={translations.PAGE_COUNT} placement={tooltipPlacement} arrow>
            <Typography className={styles.pageCount}>
                {pageCount}
            </Typography>
        </Tooltip>
        <IconButton disabled={!hasNextPage} onClick={gotoNextPage}>
            <Tooltip title={translations.NEXT_PAGE} placement={tooltipPlacement} arrow>
                <ChevronRightIcon className={iconClass} />
            </Tooltip>
        </IconButton>
        <IconButton disabled={!hasNextPage} onClick={gotoLastPage}>
            <Tooltip title={translations.LAST_PAGE} placement={tooltipPlacement} arrow>
                <LastPageIcon className={iconClass} />
            </Tooltip>
        </IconButton>
    </div >
}