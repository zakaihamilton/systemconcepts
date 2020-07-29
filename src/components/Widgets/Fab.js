import React from 'react';
import Fab from '@material-ui/core/Fab';
import AddIcon from '@material-ui/icons/Add';
import styles from "./Fab.module.scss"

export default function FloatingActionButtons({ ...props }) {
    return (
        <Fab className={styles.root} color="primary" {...props}>
            <AddIcon />
        </Fab>
    );
}
