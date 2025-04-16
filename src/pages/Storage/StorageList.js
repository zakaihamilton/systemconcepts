import { Fragment } from "react";
import { styled } from '@mui/material/styles';
import { useTranslations } from "@util/translations";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import StorageIcon from "@mui/icons-material/Storage";
import FolderIcon from "@mui/icons-material/Folder";
import { useListing } from "@util/storage";
import Tooltip from "@mui/material/Tooltip";
import Progress from "@widgets/Progress";

const PREFIX = 'StorageList';

const classes = {
    list: `${PREFIX}-list`
};

const StyledList = styled(List)((
    {
        theme
    }
) => ({
    [`& .${classes.list}`]: {
        width: "100%",
        backgroundColor: theme.palette.background.paper,
    }
}));

export default function StorageList({ path = "", state }) {

    const translations = useTranslations();
    const [data, loading] = useListing(path, [], { useCount: true });
    const depth = path ? path.split("/").length : 0;
    const paddingLeft = (depth * 2) + "em";
    const [destination, setDestination] = state;

    const items = (data || []).map(item => {
        const id = item.id || item.name;
        let name = item.name;
        let tooltip = translations.STORAGE;
        let icon = <StorageIcon />;
        const isFolder = item.type === "dir";
        let expandIcon = null;
        let onClick = undefined;
        const selected = destination == id;
        const open = destination.startsWith(id);
        if (path) {
            if (isFolder) {
                icon = <FolderIcon />;
                tooltip = translations.FOLDER;
                if (item.count) {
                    expandIcon = open ? <ExpandLess /> : <ExpandMore />;
                }
                onClick = () => setDestination(id);
            }
            else {
                return;
            }
        }
        else {
            name = translations[item.name];
            if (item.count) {
                expandIcon = open ? <ExpandLess /> : <ExpandMore />;
            }
            onClick = () => setDestination(id);
        }

        return (
            <Fragment key={id}>
                <ListItem button selected={selected} style={{ paddingLeft }} onClick={onClick}>
                    <ListItemIcon>
                        <Tooltip title={tooltip} arrow>
                            {icon}
                        </Tooltip>
                    </ListItemIcon>
                    <ListItemText primary={name} />
                    {expandIcon}
                </ListItem>
                {expandIcon && <Collapse in={open} timeout="auto" unmountOnExit>
                    <StyledList component="div" disablePadding>
                        {open && <StorageList path={id} state={state} />}
                    </StyledList>
                </Collapse>}
            </Fragment>
        );
    }).filter(Boolean);

    return (
        <List
            component="nav"
            className={classes.list}
        >
            {!!loading && <Progress />}
            {!loading && items}
        </List>
    );
}
