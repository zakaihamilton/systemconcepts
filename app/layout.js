import "@fontsource/roboto";
import "../src/scss/app.scss";
import Script from "next/script";
import EmotionRegistry from "./EmotionRegistry";

export const metadata = {
    title: "System Concepts",
    description: "System Concepts Application",
    manifest: "/manifest.json",
};

export const viewport = {
    themeColor: "#013459",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="manifest" href="/manifest.json" />
                <link rel="icon" type="image/png" href="/icon.png" />
            </head>
            <body suppressHydrationWarning>
                <Script src="/noflash.js" strategy="beforeInteractive" />
                <EmotionRegistry>
                    {children}
                </EmotionRegistry>
            </body>
        </html>
    );
}
