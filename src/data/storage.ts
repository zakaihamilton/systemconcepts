import aws from "@storage/aws";
import local from "@storage/local";
import remote from "@storage/remote";
import wasabi from "@storage/wasabi";
import Cookies from "js-cookie";

type StorageDevice = {
	id: string;
	name: string;
	enabled: boolean | string | undefined | (() => boolean | string | undefined);
	[key: string]: any;
};

const devices: StorageDevice[] = [
	{
		id: "local",
		name: "Local",
		enabled: true,
		...local,
	},
	{
		id: "personal",
		name: "Personal",
		enabled: () => {
			return Cookies.get("id") && Cookies.get("hash");
		},
		...remote({ fsEndPoint: "/api/personal", deviceId: "personal" }),
	},
	{
		id: "aws",
		name: "DigitalOcean",
		enabled: () => {
			return Cookies.get("id") && Cookies.get("hash");
		},
		...aws,
	},
	{
		id: "wasabi",
		name: "Wasabi",
		enabled: () => {
			return Cookies.get("id") && Cookies.get("hash");
		},
		...wasabi,
	},
];

export default devices;
