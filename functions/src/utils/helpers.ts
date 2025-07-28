export const getDaysAgo = (days: number): Date => {
	const millisecondsPerDay = 24 * 60 * 60 * 1000;
	return new Date(Date.now() - days * millisecondsPerDay);
};
