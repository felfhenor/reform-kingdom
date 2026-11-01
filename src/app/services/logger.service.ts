/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ErrorHandler } from '@angular/core';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { environment } from '@environments/environment';
import { isInElectron } from '@helpers/engine/electron';
import { debug, error, info, log, warn } from '@helpers/engine/logging';
import { localVersion, versionInfoToSemver } from '@helpers/engine/version';
import Rollbar from 'rollbar';

@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private rollbar!: Rollbar;

  private readonly ignoredMessageSubstrings: string[] = [
    'Failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'NG0750',
    'Http failure during parsing',
    'is not valid JSON',
    'Script error',
    'jQuery',
    'The object is in an invalid state.',
    '$0',
    'NG0950',
    'hotToastComponentList',
  ];

  private lastId = signal<string>('');
  private destroyRef = inject(DestroyRef);

  init() {
    if (isInElectron()) {
      this.captureGlobalErrors();
      void this.logSessionInfo();
    }

    if (environment.rollbar.accessToken) {
      const rollbarConfig = structuredClone(environment.rollbar);

      const realVersion = localVersion();
      if (realVersion) {
        rollbarConfig.payload.client.javascript.code_version =
          versionInfoToSemver(realVersion) ?? 'UNKNOWN';
      }

      this.rollbar = new Rollbar({
        ...rollbarConfig,
        checkIgnore: (uncaught, args) => {
          const argMessage = args[0]?.toString() ?? '';
          return this.ignoredMessageSubstrings.some((msg) =>
            argMessage.includes(msg),
          );
        },
      });
    }
  }

  // Angular's ErrorHandler misses errors thrown outside it (timers, rxjs, failed asset loads), so these get them into game.log.
  private captureGlobalErrors() {
    const onError = (event: ErrorEvent | Event) => {
      if (event instanceof ErrorEvent) {
        this.error(
          'Window:Error',
          event.error ?? event.message,
          `(${event.filename}:${event.lineno}:${event.colno})`,
        );
        return;
      }

      const target = event.target as { src?: string; href?: string } | null;
      this.error('Window:ResourceError', target?.src ?? target?.href ?? event);
    };
    const onRejection = (event: PromiseRejectionEvent) =>
      this.error('Window:UnhandledRejection', event.reason);

    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onRejection);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onRejection);
    });
  }

  private async logSessionInfo() {
    this.info('Session', navigator.userAgent);
    this.info(
      'Session',
      `viewport ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x, screen ${screen.width}x${screen.height}, language ${navigator.language}, cores ${navigator.hardwareConcurrency}`,
    );

    // A nearly full quota is the usual reason saves start failing.
    try {
      const { usage, quota } = await navigator.storage.estimate();
      this.info('Session', `storage ${usage} / ${quota} bytes used`);
    } catch (e) {
      this.warn('Session', 'Could not estimate storage', e);
    }
  }

  public log(category: string, ...data: any) {
    log(category, ...data);
  }

  public info(category: string, ...data: any) {
    info(category, ...data);
  }

  public warn(category: string, ...data: any) {
    warn(category, ...data);
  }

  public debug(category: string, ...data: any) {
    debug(category, ...data);
  }

  public error(category: string, ...data: any) {
    error(category, ...data);
  }

  public rollbarError(error: any) {
    this.rollbar?.error(error.originalError || error);
  }

  public setUserInformation(id: string, username: string): void {
    if (id === this.lastId()) return;

    this.rollbar?.configure({
      payload: {
        person: {
          id,
          username,
        },
      },
    });

    this.lastId.set(id);
  }
}

@Injectable()
export class RollbarErrorHandler implements ErrorHandler {
  private logger = inject(LoggerService);

  handleError(error: any) {
    this.logger.error('Error', error);
    this.logger.rollbarError(error);
  }
}
