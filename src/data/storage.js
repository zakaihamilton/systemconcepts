import Cookies from "js-cookie";
import local from "@storage/local";
import remote from "@storage/remote";
import aws from "@storage/aws";
import wasabi from "@storage/wasabi";

export default [
    {
        id: "local",
        name: "Local",
        enabled: true,
        ...local
    },
    {
        id: "personal",
        name: "Personal",
        enabled: () => {
            return Cookies.get("id") && Cookies.get("hash");
        },
        ...remote({ fsEndPoint: "/api/personal", deviceId: "personal" })
    },
    {
        "id": "aws",
        name: "DigitalOcean",
        enabled: () => {
            return Cookies.get("id") && Cookies.get("hash");
        },
        ...aws
    },
    {
        "id": "wasabi",
        name: "Wasabi",
        enabled: () => {
            return Cookies.get("id") && Cookies.get("hash");
        },
        ...wasabi
    }
];
