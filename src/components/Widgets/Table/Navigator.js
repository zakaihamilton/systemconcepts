import styles from "./Navigator.module.scss";
import ArrowLeftIcon from '@material-ui/icons/ArrowLeft';
import ArrowRightIcon from '@material-ui/icons/ArrowRight';
import { useTranslations } from "@/util/translations";
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';

export default function Navigator({ pageIndex, pageCount, setPageIndex }) {
    const translations = useTranslations();
    const hasPreviousPage = pageIndex >= 1;
    const hasNextPage = pageIndex < pageCount - 1;

    const previousPage = () => {
        setPageIndex && setPageIndex(pageIndex - 1);
    };

    const nextPage = () => {
        setPageIndex && setPageIndex(pageIndex + 1);
    };

    if (pageCount <= 1) {
        return null;
    }

    return <div className={styles.root}>
        <IconButton disabled={!hasPreviousPage} onClick={previousPage}>
            <Tooltip title={translations.PREVIOUS_PAGE} arrow>
                <ArrowLeftIcon />
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
        <IconButton disabled={!hasNextPage} onClick={nextPage}>
            <Tooltip title={translations.NEXT_PAGE} arrow>
                <ArrowRightIcon />
            </Tooltip>
        </IconButton>
    </div>
}