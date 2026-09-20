import { AppComponent } from '@/app/app.component';
import { appConfig } from '@/app/app.config';
import { enableProfiling, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { setAutoFreeze } from 'immer';

// Dev-only: a frozen state makes a stray in-place write throw instead of silently skipping slice consumers.
setAutoFreeze(isDevMode());

enableProfiling();
bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err),
);
