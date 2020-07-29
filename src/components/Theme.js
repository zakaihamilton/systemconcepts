import React from "react";
import { StylesProvider, ThemeProvider, jssPreset } from "@material-ui/styles";
import { create } from "jss";
import rtl from "jss-rtl";

const jss = create({ plugins: [...jssPreset().plugins, rtl()] });

export default function Theme({ theme, children }) {

    return <StylesProvider jss={jss}>
        <ThemeProvider theme={theme}>
            {children}
        </ThemeProvider>
    </StylesProvider>;
}
