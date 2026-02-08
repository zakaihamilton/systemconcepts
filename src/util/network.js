import { headers } from "next/headers";

export async function getIP() {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
return forwarded ? forwarded.split(',').pop().trim() : "127.0.0.1";
}
