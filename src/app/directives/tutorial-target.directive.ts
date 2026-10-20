import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import {
  tutorialTargetClicked,
  tutorialTargetRegister,
  tutorialTargetUnregister,
} from '@helpers/tutorial/tutorial-engine.ui';

@Directive({
  selector: '[appTutorialTarget]',
  host: { '(click)': 'onClick()' },
})
export class TutorialTargetDirective {
  public appTutorialTarget = input.required<string>();

  private elementRef = inject(ElementRef);

  constructor() {
    effect((onCleanup) => {
      const key = this.appTutorialTarget();
      tutorialTargetRegister(key, this.elementRef);
      onCleanup(() => tutorialTargetUnregister(key));
    });
  }

  public onClick(): void {
    void tutorialTargetClicked(this.appTutorialTarget());
  }
}
