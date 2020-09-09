import Cookies from 'js-cookie';
import local from "@/storage/local";
import remote from "@/storage/remote";
import personal from "@/storage/personal";

export default [
    {
        id: "local",
        name: "LOCAL",
        enabled: true,
        ...local
    },
    {
        id: "remote",
        name: "REMOTE",
        enabled: true,
        ...remote
    },
    {
        id: "personal",
        name: "PERSONAL",
        enabled: () => {
            return Cookies.get("id") && Cookies.get("hash");
        },
        ...personal
    }
];
