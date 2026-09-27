import type { ElementRef } from '@angular/core';
import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ModalComponent } from '@components/modal/modal.component';
import { ModalCloseDirective } from '@directives/modal-close.directive';
import { ModalOpenDirective } from '@directives/modal-open.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { TeleportToDirective } from '@directives/teleport.to.directive';
import { changelogSplitSections } from '@helpers/engine/changelog.ui';
import { modalIsOpen } from '@helpers/engine/modal-stack';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { tablerPackage } from '@ng-icons/tabler-icons';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';
import { MetaService } from '@services/meta.service';
import type { JSAnimation } from 'animejs';

@Component({
  selector: 'app-modal-changelog',
  imports: [
    NgIconComponent,
    TippyDirective,
    SFXDirective,
    ModalComponent,
    ModalOpenDirective,
    ModalCloseDirective,
    TeleportToDirective,
  ],
  providers: [provideIcons({ tablerPackage })],
  templateUrl: './modal-changelog.component.html',
  styleUrl: './modal-changelog.component.scss',
})
export class ModalChangelogComponent {
  private meta = inject(MetaService);
  private sanitizer = inject(DomSanitizer);
  private anim = inject(AnimationService);
  private animations: JSAnimation[] = [];

  public readonly color = '#089000';
  public currentColor = '#ccc';

  public currentView = signal<'all' | 'recent'>('recent');

  public text = computed(() =>
    this.currentView() === 'recent'
      ? this.meta.changelogCurrent()
      : this.meta.changelogAll(),
  );
  public sections = computed(() =>
    changelogSplitSections(this.text()).map((html, index) => ({
      key: `${this.currentView()}-${index}`,
      html: this.sanitizer.bypassSecurityTrustHtml(html),
    })),
  );

  private sectionEls = viewChildren<ElementRef<HTMLElement>>('section');

  constructor() {
    inject(DestroyRef).onDestroy(() =>
      this.animations.forEach((a) => a.pause()),
    );

    // Replays on every open and every Recent/All switch, since the content stays mounted while the modal is closed.
    afterRenderEffect(() => {
      if (!modalIsOpen('changelog')) return;

      const els = this.sectionEls();
      untracked(() => {
        this.animations.forEach((a) => a.pause());
        this.animations = els.map((el, i) =>
          this.anim.staggerIn(el.nativeElement, i),
        );
      });
    });
  }
}
