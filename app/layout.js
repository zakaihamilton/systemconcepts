import "@fontsource/roboto";
import "../src/scss/app.scss";
import Script from "next/script";

export const metadata = {
  title: "System Concepts",
  description: "System Concepts Application",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
  },
};

export const viewport = {
  themeColor: "#013459",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Script src="/noflash.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
