import { DestroyRef, effect, inject, Injectable } from '@angular/core';
import { cssColorCacheClear } from '@helpers/engine/css-color';
import {
  FONT_FAMILY_CLEAN,
  FONT_FAMILY_DEFAULT,
  uiTextFontFamily,
} from '@helpers/engine/font.ui';
import {
  isMotionReduced,
  motionSystemPreferenceSet,
} from '@helpers/engine/motion';
import { windowFocused, windowHeight, windowWidth } from '@helpers/engine/ui';
import { uiScaleCurrent } from '@helpers/engine/ui-scale.ui';
import { getOption } from '@helpers/state-options';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  constructor() {
    effect(() => {
      // Options from before this key existed are undefined until the migration merges defaults in.
      const useCleanFont = !!getOption('cleanFont');
      document.body.classList.toggle('clean-font', useCleanFont);
      void this.applyTextFontFamily(useCleanFont);
    });

    effect(() => {
      document.documentElement.classList.toggle(
        'colorblind',
        !!getOption('colorblindMode'),
      );
      cssColorCacheClear();
    });

    const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    const onReducedMotionChange = () =>
      motionSystemPreferenceSet(reducedMotionQuery.matches);
    onReducedMotionChange();
    reducedMotionQuery.addEventListener('change', onReducedMotionChange);
    inject(DestroyRef).onDestroy(() =>
      reducedMotionQuery.removeEventListener('change', onReducedMotionChange),
    );

    const onFocus = () => windowFocused.set(true);
    const onBlur = () => windowFocused.set(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    });

    effect(() => {
      document.documentElement.classList.toggle(
        'reduce-motion',
        isMotionReduced(),
      );
    });

    effect(() => {
      document.documentElement.style.setProperty(
        '--ui-scale',
        String(uiScaleCurrent()),
      );
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
