import styles from "./Session.module.scss";
import Tooltip from '@material-ui/core/Tooltip';
import { addPath } from "@/util/pages";
import { useDeviceType } from "@/util/styles";
import clsx from "clsx";

export default function Session({ group, year, date, name }) {
    const isPhone = useDeviceType() === "phone";
    const groupName = group[0].toUpperCase() + group.slice(1);

    const onClick = () => {
        addPath(`session?prefix=sessions&group=${group}&year=${year}&date=${date}&name=${name}`);
    };

    return <button className={clsx(styles.root, isPhone && styles.mobile)} onClick={onClick}>
        <div className={styles.group} dir="auto">
            {groupName}
        </div>
        <div className={styles.container}>
            <Tooltip arrow title={name}>
                <div className={styles.name} dir="auto">
                    {name}
                </div>
            </Tooltip>
        </div>
    </button>;
}