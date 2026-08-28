import {
  _logMessage,
  debug,
  error,
  info,
  log,
  warn,
} from '@helpers/engine/logging';
import { color } from 'console-log-colors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FIXED_DATE = new Date('2025-07-22T12:00:00-00:00');
const TIMESTAMP = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
}).format(FIXED_DATE);

describe('Logging Functions', () => {
  const originalConsole = { ...console };
  const mockConsole = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
    // Replace console methods with mocks
    Object.assign(console, mockConsole);
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restore original console methods
    Object.assign(console, originalConsole);
  });

  describe('_logMessage', () => {
    it('should format message with correct color and timestamp', () => {
      _logMessage('info', 'Test', 'message');

      expect(mockConsole.info).toHaveBeenCalledWith(
        color.blue(`[${TIMESTAMP}] {Test}`),
        'message',
      );
    });

    it('should handle multiple data arguments', () => {
      _logMessage('debug', 'Test', 'message1', 'message2', { test: true });

      expect(mockConsole.debug).toHaveBeenCalledWith(
        color.gray(`[${TIMESTAMP}] {Test}`),
        'message1',
        'message2',
        { test: true },
      );
    });
  });

  describe('log', () => {
    it('should call console.log with magenta color', () => {
      log('Test', 'message');

      expect(mockConsole.log).toHaveBeenCalledWith(
        color.magenta(`[${TIMESTAMP}] {Test}`),
        'message',
      );
    });
  });

  describe('info', () => {
    it('should call console.info with blue color', () => {
      info('Test', 'message');

      expect(mockConsole.info).toHaveBeenCalledWith(
        color.blue(`[${TIMESTAMP}] {Test}`),
        'message',
      );
    });
  });

  describe('warn', () => {
    it('should call console.warn with yellow color', () => {
      warn('Test', 'message');

      expect(mockConsole.warn).toHaveBeenCalledWith(
        color.yellow(`[${TIMESTAMP}] {Test}`),
        'message',
      );
    });
  });

  describe('debug', () => {
    it('should call console.debug with gray color', () => {
      debug('Test', 'message');

      expect(mockConsole.debug).toHaveBeenCalledWith(
        color.gray(`[${TIMESTAMP}] {Test}`),
        'message',
      );
    });
  });

  describe('error', () => {
    it('should call console.error with red color', () => {
      error('Test', 'message');

      expect(mockConsole.error).toHaveBeenCalledWith(
        color.red(`[${TIMESTAMP}] {Test}`),
        'message',
      );
    });
  });
});
