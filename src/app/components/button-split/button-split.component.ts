import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { SFXDirective } from '@directives/sfx.directive';
import type { SplitButtonOption } from '@interfaces';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-button-split',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SFXDirective],
  templateUrl: './button-split.component.html',
})
export class ButtonSplitComponent<T> {
  private anim = inject(AnimationService);

  public label = input.required<string>();
  public color = input<'primary' | 'neutral'>('neutral');
  public options = input.required<SplitButtonOption<T>[]>();
  public menuAriaLabel = input.required<string>();

  public main = output<void>();
  public picked = output<T>();

  protected isOpen = signal(false);
  protected colorClass = computed(() =>
    this.color() === 'primary' ? 'btn-primary' : 'btn-neutral',
  );

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const onPointerDown = (event: PointerEvent) => {
      if (!host.contains(event.target as Node)) this.isOpen.set(false);
    };
    // Stopped so the navbar's ESCAPE hotkey doesn't also open the pause menu.
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.isOpen()) return;
      event.stopImmediatePropagation();
      this.isOpen.set(false);
    };
    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('keydown', onKeydown, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('pointerdown', onPointerDown, {
        capture: true,
      });
      window.removeEventListener('keydown', onKeydown, { capture: true });
    });
  }

  protected onMenuEnter(event: AnimationCallbackEvent): void {
    this.anim.fadeIn(event.target, 150);
  }

  protected onMenuLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target, 150)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }

  protected clickMain(): void {
    this.isOpen.set(false);
    this.main.emit();
  }

  protected toggle(): void {
    this.isOpen.update((open) => !open);
  }

  protected pick(value: T): void {
    this.isOpen.set(false);
    this.picked.emit(value);
  }
}
