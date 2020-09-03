import { useEffect } from 'react';
import InputBase from '@material-ui/core/InputBase';
import { fade, makeStyles } from '@material-ui/core/styles';
import SearchIcon from '@material-ui/icons/Search';
import { useTranslations } from "@/util/translations";
import { Store } from "pullstate";

export const SearchStore = new Store({
    search: "",
    show: 0
});

export function useSearch() {
    const { search } = SearchStore.useState();
    useEffect(() => {
        SearchStore.update(s => {
            s.show++;
        });
        return () => {
            SearchStore.update(s => {
                s.show--;
            });
        };
    }, []);
    return { search };
}

const useStyles = makeStyles((theme) => ({
    search: {
        display: 'flex',
        position: 'relative',
        borderRadius: theme.shape.borderRadius,
        backgroundColor: fade(theme.palette.common.white, 0.15),
        '&:hover': {
            backgroundColor: fade(theme.palette.common.white, 0.25),
        },
        marginLeft: 0,
        width: '40%',
        [theme.breakpoints.up('sm')]: {
            marginLeft: theme.spacing(1),
            width: 'auto',
        },
    },
    searchIcon: {
        padding: theme.spacing(0, 1),
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    inputRoot: {
        color: 'inherit',
    },
    inputInput: {
        padding: theme.spacing(1, 1, 1, 0),
        paddingLeft: "0.5em",
        paddingRight: "0.5em",
        transition: theme.transitions.create('width'),
        width: '100%',
        [theme.breakpoints.up('sm')]: {
            width: '12ch',
            '&:focus': {
                width: '20ch',
            },
        },
    },
}));

export default function SearchAppBar() {
    const { search, show } = SearchStore.useState();
    const { SEARCH } = useTranslations();
    const classes = useStyles();

    const onChangeText = event => {
        const { value } = event.target;
        SearchStore.update(s => {
            s.search = value;
        });
    };

    if (show <= 0) {
        return null;
    }
    return (
        <div className={classes.search}>
            <div className={classes.searchIcon}>
                <SearchIcon />
            </div>
            <InputBase
                placeholder={SEARCH + "…"}
                value={search || ""}
                onChange={onChangeText}
                type="search"
                classes={{
                    root: classes.inputRoot,
                    input: classes.inputInput,
                }}
                inputProps={{ 'aria-label': 'search' }}
            />
        </div>
    );
}
