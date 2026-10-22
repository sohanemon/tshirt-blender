export function createLimiter(concurrency = 20) {
	let active = 0;
	const queue: Array<() => void> = [];

	const run = () => {
		if (active >= concurrency || queue.length === 0) return;
		active++;
		queue.shift()?.();
	};

	return async function limit<T>(fn: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			queue.push(() => {
				fn()
					.then(resolve, reject)
					.finally(() => {
						active--;
						run();
					});
			});
			run();
		});
	};
}

export class AsyncQueue<T> {
	private items: T[] = [];
	private waiters: Array<(v: T | undefined) => void> = [];
	private closed = false;

	push(item: T) {
		const waiter = this.waiters.shift();
		if (waiter) waiter(item);
		else this.items.push(item);
	}

	close() {
		this.closed = true;
		while (this.waiters.length) this.waiters.shift()?.(undefined);
	}

	next(): Promise<T | undefined> {
		if (this.items.length) return Promise.resolve(this.items.shift());
		if (this.closed) return Promise.resolve(undefined);
		return new Promise((resolve) => this.waiters.push(resolve));
	}
}
