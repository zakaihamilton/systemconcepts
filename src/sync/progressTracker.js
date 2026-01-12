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

export class SyncProgressTracker {
    constructor(isPersonal = false) {
        this.isPersonal = isPersonal;
        this.completedWeight = 0;
        this.weights = isPersonal ? PERSONAL_STEP_WEIGHTS : STEP_WEIGHTS;
        this.totalWeight = Object.values(this.weights).reduce((sum, w) => sum + w, 0);
    }

    updateProgress(stepName, stepProgress = { processed: 1, total: 1 }) {
        const stepWeight = this.weights[stepName] || 0;
        const stepCompletion = stepProgress.total > 0 ? (stepProgress.processed / stepProgress.total) : 0;
        const currentStepWeight = stepWeight * stepCompletion;

        const progressUpdate = {
            total: this.totalWeight,
            processed: this.completedWeight + currentStepWeight
        };

        SyncActiveStore.update(s => {
            if (this.isPersonal) {
                s.personalSyncProgress = progressUpdate;
            } else {
                s.progress = progressUpdate;
            }
        });
    }

    completeStep(stepName) {
        this.completedWeight += this.weights[stepName] || 0;
        this.updateProgress(stepName, { processed: 1, total: 1 });
    }

    setComplete() {
        const progressUpdate = {
            total: this.totalWeight,
            processed: this.totalWeight
        };

        SyncActiveStore.update(s => {
            if (this.isPersonal) {
                s.personalSyncProgress = progressUpdate;
            } else {
                s.progress = progressUpdate;
            }
        });
    }
}
