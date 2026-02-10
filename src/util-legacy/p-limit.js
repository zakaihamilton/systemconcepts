export default function pLimit(concurrency) {
    const queue = [];
    let activeCount = 0;

    function next() {
        activeCount--;
        if (queue.length > 0) {
            queue.shift()();
        }
    }

    function run(fn, resolve, ...args) {
        activeCount++;
        const result = (async () => fn(...args))();
        resolve(result);
        result.then(next, next);
    }

    function enqueue(fn, resolve, ...args) {
        queue.push(run.bind(null, fn, resolve, ...args));
        if (activeCount < concurrency && queue.length > 0) {
            queue.shift()();
        }
    }

    function generator(fn, ...args) {
        return new Promise(resolve => {
            enqueue(fn, resolve, ...args);
        });
    }

    Object.defineProperties(generator, {
        activeCount: {
            get: () => activeCount,
        },
        pendingCount: {
            get: () => queue.length,
        },
        clearQueue: {
            value: () => {
                queue.length = 0;
            },
        },
    });

    return generator;
}
