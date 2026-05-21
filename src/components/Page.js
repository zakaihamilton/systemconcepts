import { useDeviceType } from "@util/styles";
import Footer from "./Footer";
import Content from "./Page/Content";
import Tabs from "./Tabs";

export default function Page() {
	const isPhone = useDeviceType() === "phone";
	return (
		<>
			{!isPhone && <Tabs />}
			<Content />
			<Footer />
			{isPhone && <Tabs />}
		</>
	);
}
