export const getDaysAgo = (days: number): Date => {
	const millisecondsPerDay = 24 * 60 * 60 * 1000;
	return new Date(Date.now() - days * millisecondsPerDay);
};

export async function mapWithConcurrency<T, R>(
	items: T[],
	mapper: (item: T) => Promise<R>,
	concurrency: number,
): Promise<R[]> {
	const results: (R | Error)[] = new Array(items.length);
	let index = 0;

	const executeNext = async (): Promise<void> => {
		const currentIndex = index++;
		if (currentIndex >= items.length) return;

		try {
			results[currentIndex] = await mapper(items[currentIndex]);
		} catch (error) {
			results[currentIndex] = error as Error;
		}

		return executeNext();
	};

	// Start concurrent workers
	const workers = Array(Math.min(concurrency, items.length))
		.fill(null)
		.map(() => executeNext());

	await Promise.all(workers);

	return results as R[];
}
