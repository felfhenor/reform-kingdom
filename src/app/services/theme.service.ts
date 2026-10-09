import { effect, Injectable } from '@angular/core';
import {
  FONT_FAMILY_CLEAN,
  FONT_FAMILY_DEFAULT,
  uiTextFontFamily,
} from '@helpers/engine/font.ui';
import { windowHeight, windowWidth } from '@helpers/engine/ui';
import { getOption } from '@helpers/state-options';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  constructor() {
    effect(() => {
      const theme = getOption('uiTheme');
      document.documentElement.setAttribute('data-theme', theme);
    });

    effect(() => {
      // Options from before this key existed are undefined until the migration merges defaults in.
      const useCleanFont = !!getOption('cleanFont');
      document.body.classList.toggle('clean-font', useCleanFont);
      void this.applyTextFontFamily(useCleanFont);
    });
  }

  private async applyTextFontFamily(useCleanFont: boolean): Promise<void> {
    const family = useCleanFont ? FONT_FAMILY_CLEAN : FONT_FAMILY_DEFAULT;
    // On a failed load the DOM falls back too, so still switch to keep canvas and page consistent.
    await document.fonts.load(`bold 11px ${family}`).catch(() => undefined);
    if (!!getOption('cleanFont') !== useCleanFont) return;

    uiTextFontFamily.set(family);
  }

  private handleResize() {
    windowWidth.set(window.innerWidth);
    windowHeight.set(window.innerHeight);
  }

  init() {
    this.handleResize();

    window.addEventListener('resize', () => {
      this.handleResize();
    });
  }
}
