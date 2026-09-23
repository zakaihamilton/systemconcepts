export const metadata = {
	title: "Offline | System Concepts",
};

export default function OfflinePage() {
	return (
		<main
			style={{
				alignItems: "center",
				background: "#013459",
				color: "#fff",
				display: "flex",
				fontFamily: "Roboto, Arial, sans-serif",
				minHeight: "100vh",
				padding: "24px",
			}}
		>
			<section style={{ maxWidth: "480px" }}>
				<h1 style={{ fontSize: "2rem", fontWeight: 500, margin: "0 0 16px" }}>
					You are offline
				</h1>
				<p style={{ fontSize: "1rem", lineHeight: 1.6, margin: 0 }}>
					System Concepts will keep working with pages and assets that are
					already cached. Reconnect to sync fresh data.
				</p>
			</section>
		</main>
	);
}
