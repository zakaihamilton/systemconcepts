const locks = {};

export function useMutex({ id }) {
    var lock = locks[id];
    if (!lock) {
        lock = locks[id] = {};
        lock._locking = Promise.resolve();
        lock._locks = 0;
        lock._disabled = false;
        lockMutex({ id }).then(unlock => {
            if (lock._disabled) {
                lock._disabled = unlock;
            } else {
                unlock();
            }
        });
    }
    return lock;
}

export function isMutexLocked({ id }) {
    var lock = useMutex({ id });
    if (lock) {
        return lock._locks > 0;
    }
}

export function lockMutex({ id }) {
    var lock = useMutex({ id });
    if (lock) {
        lock._locks += 1;
        let unlockNext;
        let willLock = new Promise(resolve => unlockNext = () => {
            lock._locks -= 1;
            resolve();
        });
        let willUnlock = lock._locking.then(() => unlockNext);
        lock._locking = lock._locking.then(() => willLock);
        return willUnlock;
    }
}
