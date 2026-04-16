const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Higher-order function: envuelve cualquier operacion async con retry recursivo
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number,
  retryDelayMs: number,
  attempt: number = 1
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (attempt >= maxRetries) {
      console.error(`  Intento ${attempt}/${maxRetries} fallido. Sin reintentos restantes.`);
      throw error;
    }

    console.warn(
      `  Intento ${attempt}/${maxRetries} fallido. Reintentando en ${retryDelayMs / 1000}s...`
    );
    await delay(retryDelayMs);
    return withRetry(operation, maxRetries, retryDelayMs, attempt + 1);
  }
};
