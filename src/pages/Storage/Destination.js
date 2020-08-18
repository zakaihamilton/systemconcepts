import { useEffect } from "react";
import Popover from '@material-ui/core/Popover';
import Button from '@material-ui/core/Button';
import { useTranslations } from "@/util/translations";
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Collapse from '@material-ui/core/Collapse';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import StorageIcon from '@material-ui/icons/Storage';
import FolderIcon from '@material-ui/icons/Folder';
import { useListing } from "@/util/storage";
import Tooltip from '@material-ui/core/Tooltip';

const useStyles = makeStyles((theme) => ({
    root: {
        width: '100%',
        minWidth: "20vw",
        height: "50vh"
    },
    list: {
        width: '100%',
        backgroundColor: theme.palette.background.paper,
    }
}));

export default function Destination({ state }) {
    const classes = useStyles();
    const [destination, setDestination] = state;
    const translations = useTranslations();
    const [anchorEl, setAnchorEl] = React.useState(null);
    const showMenu = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const destinationText = destination || translations.DESTINATION;

    return <>
        <Typography>
            {translations.TO}:
        </Typography>
        <Button variant="outlined" color="primary" onClick={showMenu}>
            {destinationText}
        </Button>
        <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'left',
            }}
            transformOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}
        >
            <div className={classes.root}>
                <StorageList path="" state={state} />
            </div>
        </Popover>
    </>
}

export const StorageList = React.forwardRef(({ path, state }, ref) => {
    const classes = useStyles();
    const translations = useTranslations();
    const [data] = useListing(path, []);
    const paddingLeft = (path.split("/").length * 2) + "em";
    const [open, setOpen] = React.useState(null);
    const [destination, setDestination] = state;

    useEffect(() => {
        const first = data && data[0];
        if (first) {
            const id = first.id || first.path;
            setOpen(id);
        }
    }, [data]);

    const items = (data || []).map(item => {
        const id = item.id || item.name;
        let name = item.name;
        let tooltip = translations.STORAGE;
        let icon = <StorageIcon />;
        const isFolder = item.type === "dir";
        let expandIcon = null;
        let onClick = undefined;
        const selected = destination == id;
        if (path) {
            if (isFolder) {
                icon = <FolderIcon />;
                tooltip = translations.FOLDER;
                expandIcon = open === id ? <ExpandLess /> : <ExpandMore />;
                onClick = () => setOpen(open === id ? null : id);
            }
            else {
                return;
            }
        }
        else {
            name = translations[item.name];
            expandIcon = open === id ? <ExpandLess /> : <ExpandMore />;
            onClick = () => setOpen(open === id ? null : id);
        }

        return <React.Fragment key={id}>
            <ListItem button selected={selected} style={{ paddingLeft }} onClick={onClick}>
                <ListItemIcon>
                    <Tooltip title={tooltip} arrow>
                        {icon}
                    </Tooltip>
                </ListItemIcon>
                <ListItemText primary={name} />
                {expandIcon}
            </ListItem>
            {expandIcon && <Collapse in={open === id} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                    {open === id && <StorageList path={path + "/" + id} state={state} />}
                </List>
            </Collapse>}
        </React.Fragment>
    }).filter(Boolean);

    return (
        <List
            component="nav"
            className={classes.list}
        >
            {items}
        </List>
    );
});
