import { Injectable } from '@angular/core';

import * as helpers from '@helpers';
import * as debug from '@helpers/debug/debug';

@Injectable({
  providedIn: 'root',
})
export class APIService {
  async init() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).api = {
      ...helpers,
      ...debug,
    };
  }
}
