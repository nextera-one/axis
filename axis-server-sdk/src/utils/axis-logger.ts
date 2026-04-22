export interface AxisLogger {
  debug(message: string): void;
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

function write(
  method: "debug" | "log" | "warn" | "error",
  scope: string,
  message: string,
): void {
  const consoleMethod = console[method] ?? console.log;
  consoleMethod.call(console, `[${scope}] ${message}`);
}

export function createAxisLogger(scope: string): AxisLogger {
  return {
    debug: (message) => write("debug", scope, message),
    log: (message) => write("log", scope, message),
    warn: (message) => write("warn", scope, message),
    error: (message) => write("error", scope, message),
  };
}
