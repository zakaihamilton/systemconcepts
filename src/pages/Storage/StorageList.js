import { useTranslations } from "@/util/translations";
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
import Progress from "@/widgets/Progress";

const useStyles = makeStyles((theme) => ({
    list: {
        width: '100%',
        backgroundColor: theme.palette.background.paper,
    }
}));

export default function StorageList({ path = "", state }) {
    const classes = useStyles();
    const translations = useTranslations();
    const [data, loading] = useListing(path, []);
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
            {expandIcon && <Collapse in={open} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                    {open && <StorageList path={id} state={state} />}
                </List>
            </Collapse>}
        </React.Fragment>
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
