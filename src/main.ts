import { AppComponent } from '@/app/app.component';
import { appConfig } from '@/app/app.config';
import { enableProfiling, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { error } from '@helpers/engine/logging';
import { gamestateSetAutoFreeze } from '@helpers/state-game';

// Dev-only: a frozen state makes a stray in-place write throw instead of silently skipping slice consumers.
gamestateSetAutoFreeze(isDevMode());

enableProfiling();
bootstrapApplication(AppComponent, appConfig).catch((err) =>
  error('Bootstrap', err),
);
