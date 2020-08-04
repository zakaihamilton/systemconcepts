import local from "@/storage/local";
import remote from "@/storage/remote";

export default [
    {
        id: "local",
        name: "LOCAL_STORAGE",
        ...local
    },
    {
        id: "remote",
        name: "REMOTE_STORAGE",
        ...remote
    }
];