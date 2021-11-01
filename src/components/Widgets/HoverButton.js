import React, { useEffect, useState, useRef, useCallback } from "react";
import clsx from "clsx";
import CircularProgress from "@material-ui/core/CircularProgress";
import Fab from "@material-ui/core/Fab";
import styles from "./HoverButton.module.scss";

export default function HoverButton({ className, onClick, onHoverComplete, hoverDelay = 500, hoverDuration = 750, children }) {
    const [loading, setLoading] = useState(false);
    const activeTimer = useRef();
    const delayTimer = useRef();

    useEffect(() => {
        return () => {
            clearTimeout(activeTimer.current);
            clearTimeout(delayTimer.current);
        };
    }, []);

    const handleButtonClick = useCallback(event => {
        setLoading(false);
        if (onClick) {
            onClick(event);
        }
        if (activeTimer.current) {
            clearTimeout(activeTimer.current);
            activeTimer.current = null;
        }
        if (delayTimer.current) {
            clearTimeout(delayTimer.current);
            delayTimer.current = null;
        }
    }, []);

    const handleButtonOver = useCallback(event => {
        setLoading(false);
        if (activeTimer.current) {
            clearTimeout(activeTimer.current);
            activeTimer.current = null;
        }
        if (delayTimer.current) {
            clearTimeout(delayTimer.current);
            delayTimer.current = null;
        }
        const { currentTarget } = event;
        delayTimer.current = setTimeout(() => {
            setLoading(true);
            activeTimer.current = setTimeout(() => {
                setLoading(false);
                if (onHoverComplete) {
                    onHoverComplete({ currentTarget });
                }
            }, hoverDuration);
        }, hoverDelay);
    }, []);

    const handleButtonLeave = useCallback(event => {
        setLoading(false);
        if (activeTimer.current) {
            clearTimeout(activeTimer.current);
            activeTimer.current = null;
        }
        if (delayTimer.current) {
            clearTimeout(delayTimer.current);
            delayTimer.current = null;
        }
    }, []);

    return (
        <div className={styles.root}>
            <div className={styles.wrapper}>
                <Fab
                    color="inherit"
                    size="small"
                    className={clsx(styles.button, className)}
                    onClick={handleButtonClick}
                    onMouseEnter={handleButtonOver}
                    onMouseLeave={handleButtonLeave}
                >
                    {children}
                </Fab>
                <div className={styles.progressContainer}>
                    <CircularProgress
                        size={52}
                        color="inherit"
                        className={styles.fabProgress}
                        variant={loading ? "indeterminate" : "determinate"}
                    />
                </div>
            </div>
        </div>
    );
}
