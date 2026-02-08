"use server";
import { handle } from "@util/logger";

export async function logError(data) {
    handle({ ...data, throwError: false });
    return {};
}
