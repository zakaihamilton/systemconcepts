import React from 'react';
import LinearProgress from '@material-ui/core/LinearProgress';
import styles from "./Loading.module.scss";
import Typography from '@material-ui/core/Typography';

export default function Loading({ error }) {
    if (error) {
        console.error(error);
    }
    return (
        <div className={styles.root}>
            <div className={styles.progress}>
                <LinearProgress />
            </div>
        </div>
    );
}
