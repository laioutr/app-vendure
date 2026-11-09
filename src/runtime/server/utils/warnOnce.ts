const warned = new Set<string>();

/**
 * Logs a warning the first time `key` is seen in this process. For a fallback that applies to every
 * request alike, where one line says everything and a line per request buries the rest of the log.
 */
export const warnOnce = (key: string, message: string): void => {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
};
