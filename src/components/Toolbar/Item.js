import Label from "@widgets/Label";
import { useStyles } from "@util/styles";
import Link from "@mui/material/Link";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import styles from "./Item.module.scss";
import Menu from "@widgets/Menu";
import { Divider } from "@mui/material";
import clsx from "clsx";

export default function ToolbarItem({ item, idx, count }) {
    const className = useStyles(styles, {
        item: true,
        selected: item.selected === item.id,
        active: item.active
    });
    const showDivider = !!item.divider && idx !== count - 1;
    return <>
        {item.element}
        {!item.element &&
            <Menu items={item.items} selected={item.selected} onClick={item.onClick ? item.onClick : undefined}>
                {!!item.label ?
                    (<Label icon={item.icon} name={item.name} noBorder={true} />) :
                    (<IconButton
                    component={Link}
                    underline="none"
                    color="inherit"
                    href={item.target}
                    className={className}
                    disabled={item.disabled}
                    size="large">
                        <Tooltip arrow title={item.name}>
                            {item.icon}
                        </Tooltip>
                    </IconButton>)}
            </Menu>
        }
        <Divider classes={{ root: clsx(styles.divider, !showDivider && styles.hidden) }} orientation="vertical" />
    </>;
}