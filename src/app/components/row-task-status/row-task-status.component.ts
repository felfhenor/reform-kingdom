import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  untracked,
} from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { TextNumberTweenComponent } from '@components/text-number-tween/text-number-tween.component';
import type { TaskRowViewModel } from '@interfaces';
import { AnimationService } from '@services/animation.service';
import type { JSAnimation } from 'animejs';

@Component({
  selector: 'app-row-task-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IconComponent, TextNumberTweenComponent],
  templateUrl: './row-task-status.component.html',
  styleUrl: './row-task-status.component.scss',
})
export class RowTaskStatusComponent {
  private anim = inject(AnimationService);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private completeAnimations: JSAnimation[] = [];

  public row = input.required<TaskRowViewModel>();

  constructor() {
    inject(DestroyRef).onDestroy(() =>
      this.completeAnimations.forEach((a) => a.pause()),
    );

    let wasComplete: boolean | undefined;
    effect(() => {
      const isComplete = this.row().isComplete;
      untracked(() => {
        if (wasComplete === false && isComplete) this.playCompleted();
        wasComplete = isComplete;
      });
    });
  }

  private playCompleted(): void {
    const host = this.el.nativeElement;
    this.completeAnimations = [this.anim.pulse(host), this.anim.goldGlow(host)];
  }
}
