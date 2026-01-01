import { SyncActiveStore } from "./syncState";

// Step weights represent relative effort/time for each sync step
const STEP_WEIGHTS = {
    getLocalFiles: 5,
    updateLocalManifest: 15,
    syncManifest: 5,
    downloadUpdates: 30,
    removeDeletedFiles: 5,
    uploadUpdates: 30,
    uploadNewFiles: 5,
    uploadManifest: 5
};

const TOTAL_WEIGHT = Object.values(STEP_WEIGHTS).reduce((sum, w) => sum + w, 0);

export class SyncProgressTracker {
    constructor() {
        this.completedWeight = 0;
    }

    updateProgress(stepName, stepProgress = { processed: 1, total: 1 }) {
        const stepWeight = STEP_WEIGHTS[stepName] || 0;
        const stepCompletion = stepProgress.total > 0 ? (stepProgress.processed / stepProgress.total) : 0;
        const currentStepWeight = stepWeight * stepCompletion;

        SyncActiveStore.update(s => {
            s.progress = {
                total: TOTAL_WEIGHT,
                processed: this.completedWeight + currentStepWeight
            };
        });
    }

    completeStep(stepName) {
        this.completedWeight += STEP_WEIGHTS[stepName] || 0;
        this.updateProgress(stepName, { processed: 1, total: 1 });
    }

    setComplete() {
        SyncActiveStore.update(s => {
            s.progress = {
                total: TOTAL_WEIGHT,
                processed: TOTAL_WEIGHT
            };
        });
    }
}
