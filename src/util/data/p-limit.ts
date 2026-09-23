export default function pLimit(concurrency: any) {
	const queue: any = [];
	let activeCount = 0;

	function next() {
		activeCount--;
		if (queue.length > 0) {
			queue.shift()();
		}
	}

	function run(fn: any, resolve: any, ...args: any[]) {
		activeCount++;
		const result = (async () => fn(...args))();
		resolve(result);
		result.then(next, next);
	}

	function enqueue(fn: any, resolve: any, ...args: any[]) {
		queue.push(run.bind(null, fn, resolve, ...args));
		if (activeCount < concurrency && queue.length > 0) {
			queue.shift()();
		}
	}

	function generator(fn: any, ...args: any[]) {
		return new Promise((resolve) => {
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
