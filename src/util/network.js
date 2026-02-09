import { headers } from "next/headers";

/**
 * Extracts the client IP address from the request headers.
 * Handles x-forwarded-for header for proxy support.
 * @returns {Promise<string>} The client IP address.
 */
export async function getIP() {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    return forwarded ? forwarded.split(',')[0].trim() : "127.0.0.1";
}
