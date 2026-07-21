import { getMutex, isMutexLocked, lockMutex } from "./mutex";

describe("mutex", () => {
	it("serializes access to the same id: the second lock waits for the first unlock", async () => {
		const events = [];
		const id = "serial-test";

		const unlockA = await lockMutex({ id });
		events.push("locked-a");

		const secondLockPromise = lockMutex({ id }).then((unlockB) => {
			events.push("locked-b");
			unlockB();
		});

		// Give any pending microtasks a chance to run; the second lock must not
		// resolve until the first is released.
		await Promise.resolve();
		await Promise.resolve();
		expect(events).toEqual(["locked-a"]);

		unlockA();
		await secondLockPromise;

		expect(events).toEqual(["locked-a", "locked-b"]);
	});

	it("does not block locks that use a different id", async () => {
		const unlockA = await lockMutex({ id: "id-a" });
		// A completely independent id should acquire immediately.
		const unlockB = await lockMutex({ id: "id-b" });

		expect(isMutexLocked({ id: "id-a" })).toBe(true);
		expect(isMutexLocked({ id: "id-b" })).toBe(true);

		unlockA();
		unlockB();

		expect(isMutexLocked({ id: "id-a" })).toBe(false);
		expect(isMutexLocked({ id: "id-b" })).toBe(false);
	});

	it("reuses the same mutex object for repeated calls with the same id", () => {
		const first = getMutex({ id: "shared" });
		const second = getMutex({ id: "shared" });
		expect(first).toBe(second);
	});

	it("settles back to unlocked shortly after a mutex is first created", async () => {
		// getMutex() eagerly acquires and releases an initial lock to bootstrap
		// its internal queue, so the id is briefly "locked" until that
		// microtask resolves.
		isMutexLocked({ id: "never-locked" });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(isMutexLocked({ id: "never-locked" })).toBe(false);
	});

	it("supports multiple sequential lock/unlock cycles on the same id", async () => {
		const id = "cycles";
		for (let i = 0; i < 3; i++) {
			const unlock = await lockMutex({ id });
			expect(isMutexLocked({ id })).toBe(true);
			unlock();
		}
		expect(isMutexLocked({ id })).toBe(false);
	});

	it("reports locked state while an explicit lock is held", async () => {
		const id = "explicit-lock";
		await new Promise((resolve) => setTimeout(resolve, 0));

		const unlock = await lockMutex({ id });
		expect(isMutexLocked({ id })).toBe(true);
		unlock();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(isMutexLocked({ id })).toBe(false);
	});
});
