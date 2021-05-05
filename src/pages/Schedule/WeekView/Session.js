import styles from "./Session.module.scss";
import { addPath, toPath } from "@util/pages";
import { useDeviceType } from "@util/styles";
import clsx from "clsx";
import Link from '@material-ui/core/Link';

export default function Session({ group, year, date, name, color }) {
    const isPhone = useDeviceType() === "phone";
    const groupName = group[0].toUpperCase() + group.slice(1);
    const path = `session?group=${group}&year=${year}&date=${date}&name=${encodeURIComponent(name)}`;

    const onClick = () => {
        addPath(path);
    };

    const href = "#schedule/" + toPath(path);

    const style = {
        backgroundColor: color
    };

    return <Link underline="none" color="initial" href={href} className={clsx(styles.root, isPhone && styles.mobile)} onClick={onClick}>
        <div className={styles.background} style={style} />
        <div className={styles.group} dir="auto">
            {groupName}
        </div>
        <div className={styles.container}>
            <div className={styles.name} dir="auto">
                {name}
            </div>
        </div>
        <div className={styles.backgroundBorder} style={style} />
    </Link>;
}