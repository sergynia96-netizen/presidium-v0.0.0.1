export interface Logger {
  info: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
}

// Minimal logger wrapper. Can be replaced with Winston or another logger later.
export const logger: Logger = {
  info(message, meta) {
    if (meta) {
      // eslint-disable-next-line no-console
      console.log(`[INFO] ${message}`, meta);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[INFO] ${message}`);
    }
  },
  error(message, meta) {
    if (meta) {
      // eslint-disable-next-line no-console
      console.error(`[ERROR] ${message}`, meta);
    } else {
      // eslint-disable-next-line no-console
      console.error(`[ERROR] ${message}`);
    }
  }
};


