import { LOG_FILE_MAX_ENTRY_LENGTH } from '@helpers/config';
import type { LogLevel, WindowWithElectronLogBridge } from '@interfaces';

function logValueToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return logErrorToString(value);
  if (value === undefined || typeof value === 'function') return String(value);

  try {
    return JSON.stringify(value, logJsonReplacer()) ?? String(value);
  } catch {
    return String(value);
  }
}

// Minified names and messages alone rarely say where it broke, so the stack and cause chain come along.
function logErrorToString(err: Error): string {
  const text = err.stack?.includes(err.message)
    ? err.stack
    : `${err.name}: ${err.message}\n${err.stack ?? ''}`.trim();
  return err.cause === undefined
    ? text
    : `${text}\nCaused by: ${logValueToString(err.cause)}`;
}

// Only the current path is checked, so shared (non-cyclic) references still serialize in full.
function logJsonReplacer(): (key: string, value: unknown) => unknown {
  const ancestors: unknown[] = [];
  return function (this: unknown, _key: string, value: unknown) {
    if (value instanceof Error) return logErrorToString(value);
    if (typeof value === 'bigint') return `${value}n`;
    if (typeof value === 'function') return '[Function]';
    if (typeof value !== 'object' || value === null) return value;

    while (ancestors.length > 0 && ancestors.at(-1) !== this) ancestors.pop();
    if (ancestors.includes(value)) return '[Circular]';
    ancestors.push(value);
    return value;
  };
}

// Truncated here so an oversized entry never crosses IPC in full.
export function logDataToString(data: unknown[]): string {
  const text = data.map(logValueToString).join(' ');
  return text.length <= LOG_FILE_MAX_ENTRY_LENGTH
    ? text
    : `${text.slice(0, LOG_FILE_MAX_ENTRY_LENGTH)}... [truncated ${text.length - LOG_FILE_MAX_ENTRY_LENGTH} chars]`;
}

// Called from every log; outside Electron (browser, node scripts) there's no bridge and it does nothing.
export function electronLogWrite(
  level: LogLevel,
  category: string,
  data: unknown[],
): void {
  if (typeof window === 'undefined') return;
  const logWrite = (window as WindowWithElectronLogBridge).reformElectron
    ?.logWrite;
  if (!logWrite) return;

  try {
    logWrite(level, category, logDataToString(data));
  } catch {
    // Logging this failure would recurse straight back here.
  }
}
