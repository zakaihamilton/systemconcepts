import local from "@/storage/local";
import remote from "@/storage/remote";
import personal from "@/storage/personal";

export default [
    {
        id: "local",
        name: "LOCAL",
        ...local
    },
    {
        id: "remote",
        name: "REMOTE",
        ...remote
    },
    {
        id: "personal",
        name: "PERSONAL",
        ...personal
    }
];
