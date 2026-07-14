import "../src/css/app.css";
import Script from "next/script";

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
		<html lang="en" suppressHydrationWarning data-theme="light">
			<head>
				<link rel="manifest" href="/manifest.json" />
				<link rel="icon" type="image/png" href="/icon.png" />
			</head>
			<body suppressHydrationWarning>
				<Script src="/noflash.js" strategy="beforeInteractive" />
				{children}
			</body>
		</html>
	);
}
