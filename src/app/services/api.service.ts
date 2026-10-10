import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class APIService {
  async init() {
    // Lazy so the full helper barrel (pixi included) stays out of the main bundle.
    const helpers = await import('@helpers');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).api = { ...helpers };
  }
}
