import Cookies from "js-cookie";
import local from "@storage/local";
import remote from "@storage/remote";
import aws from "@storage/aws";
import wasabi from "@storage/wasabi";

export default [
    {
        id: "local",
        name: "LOCAL",
        enabled: true,
        ...local
    },
    {
        id: "personal",
        name: "PERSONAL",
        enabled: () => {
            return Cookies.get("id") && Cookies.get("hash");
        },
        ...remote({ fsEndPoint: "/api/personal", deviceId: "personal" })
    },
    {
        "id": "aws",
        name: "AWS",
        enabled: () => {
            return Cookies.get("id") && Cookies.get("hash");
        },
        ...aws
    },
    {
        "id": "wasabi",
        name: "WASABI",
        enabled: () => {
            return Cookies.get("id") && Cookies.get("hash");
        },
        ...wasabi
    }
];
