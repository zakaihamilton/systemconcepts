import React, { useState } from 'react'
import { SwatchesPicker } from 'react-color'
import styles from "./ColorPicker.module.scss";

export default function ColorPicker({ color, onChangeComplete }) {
    const [isVisible, show] = useState(false);

    const handleClick = () => {
        show(true);
    };

    const handleClose = () => {
        show(false);
    };

    return (<>
        <div className={styles.swatch} onClick={handleClick}>
            <div className={styles.color} style={{ backgroundColor: color }} />
        </div>
        { isVisible && <div className={styles.popover}>
            <div className={styles.cover} onClick={handleClose} />
            <SwatchesPicker className={styles.picker} color={color} onChangeComplete={onChangeComplete} />
        </div>}
    </>);
}
