import { fetchJSON } from "@util/fetch";

export async function fetchSessionMetadata(group, year) {
	const params = new URLSearchParams({
		group,
		year: String(year),
	});
	return await fetchJSON(`/api/session-metadata?${params.toString()}`, {
		method: "GET",
		cache: "no-store",
	});
}
