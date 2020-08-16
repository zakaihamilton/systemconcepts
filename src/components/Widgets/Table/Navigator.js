import styles from "./Navigator.module.scss";
import FirstPageIcon from '@material-ui/icons/FirstPage';
import LastPageIcon from '@material-ui/icons/LastPage';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { useTranslations } from "@/util/translations";
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';

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

    if (pageCount <= 1) {
        return null;
    }

    return <div className={styles.root}>
        <IconButton disabled={!hasPreviousPage} onClick={gotoFirstPage}>
            <Tooltip title={translations.FIRST_PAGE} arrow>
                <FirstPageIcon />
            </Tooltip>
        </IconButton>
        <IconButton disabled={!hasPreviousPage} onClick={gotoPreviousPage}>
            <Tooltip title={translations.PREVIOUS_PAGE} arrow>
                <ChevronLeftIcon />
            </Tooltip>
        </IconButton>
        <Tooltip title={translations.PAGE_INDEX} arrow>
            <Typography className={styles.pageIndex}>
                {pageIndex + 1}
            </Typography>
        </Tooltip>
        <Typography className={styles.pageSeparator}>
            /
        </Typography>
        <Tooltip title={translations.PAGE_COUNT} arrow>
            <Typography className={styles.pageCount}>
                {pageCount}
            </Typography>
        </Tooltip>
        <IconButton disabled={!hasNextPage} onClick={gotoNextPage}>
            <Tooltip title={translations.NEXT_PAGE} arrow>
                <ChevronRightIcon />
            </Tooltip>
        </IconButton>
        <IconButton disabled={!hasNextPage} onClick={gotoLastPage}>
            <Tooltip title={translations.LAST_PAGE} arrow>
                <LastPageIcon />
            </Tooltip>
        </IconButton>
    </div>
}