import { useDeviceType } from "@util/browser/styles";
import Footer from "../Footer";
import Content from "./Content";
import Tabs from "../Tabs";

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
