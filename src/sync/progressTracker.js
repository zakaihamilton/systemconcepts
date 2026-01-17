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

const PERSONAL_STEP_WEIGHTS = {
    ...STEP_WEIGHTS,
    migrateFromMongoDB: 10
};

// Calculate total weights for each phase
export const MAIN_SYNC_WEIGHT = Object.values(STEP_WEIGHTS).reduce((sum, w) => sum + w, 0);
export const LIBRARY_SYNC_WEIGHT = Object.values(STEP_WEIGHTS).reduce((sum, w) => sum + w, 0);
export const PERSONAL_SYNC_WEIGHT = Object.values(PERSONAL_STEP_WEIGHTS).reduce((sum, w) => sum + w, 0);
export const TOTAL_COMBINED_WEIGHT = MAIN_SYNC_WEIGHT + LIBRARY_SYNC_WEIGHT + PERSONAL_SYNC_WEIGHT;

export class SyncProgressTracker {
    constructor(phaseOffset = 0, combinedTotalWeight = null) {
        this.phaseOffset = phaseOffset;
        this.completedWeight = 0;
        this.weights = STEP_WEIGHTS;
        this.localTotalWeight = Object.values(this.weights).reduce((sum, w) => sum + w, 0);
        this.combinedTotalWeight = combinedTotalWeight || this.localTotalWeight;
    }

    // Set weights for personal sync (which includes migrateFromMongoDB)
    usePersonalWeights() {
        this.weights = PERSONAL_STEP_WEIGHTS;
        this.localTotalWeight = Object.values(this.weights).reduce((sum, w) => sum + w, 0);
    }

    updateProgress(stepName, stepProgress = { processed: 1, total: 1 }) {
        const stepWeight = this.weights[stepName] || 0;
        const stepCompletion = stepProgress.total > 0 ? (stepProgress.processed / stepProgress.total) : 0;
        const currentStepWeight = stepWeight * stepCompletion;

        const progressUpdate = {
            total: this.combinedTotalWeight,
            processed: this.phaseOffset + this.completedWeight + currentStepWeight
        };

        SyncActiveStore.update(s => {
            s.progress = progressUpdate;
        });
    }

    completeStep(stepName) {
        this.completedWeight += this.weights[stepName] || 0;
        this.updateProgress(stepName, { processed: 1, total: 1 });
    }

    setComplete() {
        const progressUpdate = {
            total: this.combinedTotalWeight,
            processed: this.phaseOffset + this.localTotalWeight
        };

        SyncActiveStore.update(s => {
            s.progress = progressUpdate;
        });
    }

    // Get the current completed weight including phase offset
    getCurrentOffset() {
        return this.phaseOffset + this.completedWeight;
    }
}
