import { useDeviceType } from "@util/browser/styles";
import Footer from "../Footer";
import Tabs from "../Tabs";
import Content from "./Content";

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
