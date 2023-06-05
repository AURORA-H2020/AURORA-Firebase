/**
 * Run an operation which discards any thrown error and logs it to the console.
 * @param operation The operation to execute
 */
export async function discardError<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    console.error(error);
    return null;
  }
}
