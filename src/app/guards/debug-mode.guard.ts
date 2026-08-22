import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { getOption } from '@helpers/state-options';
import { LoggerService } from '@services/logger.service';

export const debugModeGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (getOption('showDebug')) {
    return true;
  }

  const logger = inject(LoggerService);
  logger.info(
    'Guard:DebugMode',
    'User tried to access',
    location.pathname,
    'without debug mode enabled',
  );

  router.navigate(['/']);
  return false;
};
