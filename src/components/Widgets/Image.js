import React, { useState, useEffect } from "react";
import clsx from "clsx";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles({
    image: {
        objectFit: "contain",
        visibility: "hidden"
    },
    error: {
        visibility: "hidden"
    },
    loaded: {
        visibility: "visible"
    }
});

export default function Image({ src, className, ...props }) {
    const classes = useStyles();
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    const onError = () => {
        setImageError(true);
    };
    const onLoad = () => {
        setImageLoaded(true);
    };
    useEffect(() => {
        setImageLoaded(false);
        setImageError(false);
    }, [src]);

    const classNames = clsx(
        classes.image,
        className,
        imageError && classes.error,
        imageLoaded && classes.loaded
    );

    if (typeof src === "object") {
        return (<div className={className} {...props} >
            {src}
        </div>);
    }

    return <img
        className={classNames}
        src={src}
        onLoad={onLoad}
        onError={onError}
        {...props} />;
}