import Cookies from 'js-cookie';
import local from "@/storage/local";
import remote from "@/storage/remote";
import aws from "@/storage/aws";

export default [
    {
        id: "local",
        name: "LOCAL",
        enabled: true,
        ...local
    },
    {
        id: "shared",
        name: "SHARED",
        enabled: true,
        ...remote({ fsEndPoint: "/api/shared", deviceId: "shared" })
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
        enabled: true,
        ...aws
    }
];
