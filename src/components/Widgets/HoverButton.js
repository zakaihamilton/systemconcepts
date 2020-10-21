import React, { useEffect, useState, useRef, useCallback } from 'react';
import clsx from 'clsx';
import CircularProgress from '@material-ui/core/CircularProgress';
import Fab from '@material-ui/core/Fab';
import styles from "./HoverButton.module.scss";

export default function HoverButton({ className, onClick, onHoverComplete, hoverDuration = 1000, children, ...props }) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const timer = useRef();

    const buttonClassname = clsx({
        [styles.buttonSuccess]: success,
        className: true
    });

    useEffect(() => {
        return () => {
            clearTimeout(timer.current);
        };
    }, []);

    const handleButtonClick = useCallback(event => {
        setSuccess(false);
        setLoading(false);
        if (onClick) {
            onClick(event);
        }
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    }, []);

    const handleButtonOver = useCallback(event => {
        setSuccess(false);
        setLoading(true);
        if (timer.current) {
            clearTimeout(timer.current);
        }
        const { currentTarget } = event;
        timer.current = window.setTimeout(() => {
            setSuccess(true);
            setLoading(false);
            if (onHoverComplete) {
                onHoverComplete({ currentTarget });
            }
        }, hoverDuration);
    }, []);

    const handleButtonLeave = useCallback(event => {
        setSuccess(false);
        setLoading(false);
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    }, []);

    return (
        <div className={styles.root}>
            <div className={styles.wrapper}>
                <Fab
                    color="inherit"
                    className={buttonClassname}
                    onClick={handleButtonClick}
                    onMouseEnter={handleButtonOver}
                    onMouseLeave={handleButtonLeave}
                >
                    {children}
                </Fab>
                <CircularProgress
                    size={68}
                    className={styles.fabProgress}
                    variant={loading ? "indeterminate" : "static"}
                />
            </div>
        </div>
    );
}
