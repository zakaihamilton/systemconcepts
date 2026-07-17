import "../src/css/app.css";
import Script from "next/script";
import ServiceWorker from "../src/components/ServiceWorker";

export const metadata = {
	title: "System Concepts",
	description: "System Concepts Application",
	manifest: "/manifest.json",
};

export const viewport = {
	themeColor: "#013459",
};

const splashStyles = `
.app-splash { display: none; }
@media (max-width: 767px) {
  .app-splash {
    position: fixed; z-index: 2147483647; inset: 0; display: flex;
    flex-direction: column; align-items: center; justify-content: center;
    gap: .65rem; padding: max(2rem, env(safe-area-inset-top)) 2rem max(2rem, env(safe-area-inset-bottom));
    color: #f8fafc; background: radial-gradient(circle at 18% 18%, rgba(129,140,248,.35), transparent 35%), radial-gradient(circle at 82% 82%, rgba(56,189,248,.18), transparent 38%), #111827; text-align: center;
  }
  .app-splash__mark { width: 5rem; height: 5rem; margin-bottom: .75rem; }
  .app-splash__mark img { width: 100%; height: 100%; filter: drop-shadow(0 0 12px rgba(196,181,253,.7)) drop-shadow(0 0 28px rgba(129,140,248,.4)); }
  .app-splash__title { font-size: 1.35rem; font-weight: 700; letter-spacing: -.025em; }
  .app-splash__subtitle { color: rgba(224,231,255,.72); font-size: .9rem; font-weight: 500; }
  .app-splash__loader { width: 2rem; height: 2rem; margin-top: 1.4rem; border: 3px solid rgba(224,231,255,.2); border-top-color: #c7d2fe; border-radius: 50%; animation: app-splash-spin .8s linear infinite; }
}
@keyframes app-splash-spin { to { transform: rotate(360deg); } }
`;

export default function RootLayout({ children }) {
	return (
		<html lang="en" suppressHydrationWarning data-theme="light">
			<head>
				<link rel="manifest" href="/manifest.json" />
				<link rel="icon" type="image/png" href="/icon.png" />
				<style>{splashStyles}</style>
			</head>
			<body suppressHydrationWarning>
				<Script src="/noflash.js" strategy="beforeInteractive" />
				<div id="app-splash" className="app-splash" role="status">
					<div className="app-splash__mark" aria-hidden="true">
						<img src="/icon.png" alt="" />
					</div>
					<div className="app-splash__title">System Concepts</div>
					<div className="app-splash__subtitle">One concept at a time</div>
					<div className="app-splash__loader" aria-label="Loading" />
				</div>
				<ServiceWorker />
				{children}
			</body>
		</html>
	);
}
