/**
 * Retry a function with exponential backoff.
 *
 * @param fn        Async function to retry.
 * @param attempts  Maximum number of attempts (default 3).
 * @param baseMs    Base delay in milliseconds before the first retry (default 500).
 * @returns         The resolved value from `fn`.
 * @throws          The last error encountered after all attempts are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseMs = 500,
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        const delayMs = baseMs * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
