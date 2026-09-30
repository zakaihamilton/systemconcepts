import { UpdateSessionsStore } from "@sync/syncState";
import type { Session } from "../../../types/domain";

export function toSessionProgress(session: Session) {
	return {
		name: session.id,
		files: session.files || [],
		metadata: {
			hasTags: Array.isArray(session.tags) && session.tags.length > 0,
			hasDuration:
				typeof session.duration === "number" && session.duration > 0.5,
			hasSummary: !!session.summaryText || !!session.summary,
			hasTranscription: !!session.transcription,
			hasThumbnail: !!session.thumbnail || !!session.image,
		},
	};
}

export function recordGroupError(itemIndex: number, error: unknown) {
	const message =
		error && typeof error === "object" && "message" in error && error.message
			? String(error.message)
			: String(error);
	UpdateSessionsStore.update((state) => {
		state.status[itemIndex].errors.push(message);
		state.status = [...state.status];
	});
}
