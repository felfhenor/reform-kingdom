import { TPipe } from '@pipes/t.pipe';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AnalyticsClickDirective } from '@directives/analytics-click.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { STEAM_STORE_URL } from '@helpers/demo/demo.ui';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { tablerBrandSteam } from '@ng-icons/tabler-icons';

@Component({
  selector: 'app-button-wishlist',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, AnalyticsClickDirective, NgIconComponent, SFXDirective],
  providers: [provideIcons({ tablerBrandSteam })],
  template: `
    @if (storeUrl) {
      <a
        class="btn btn-primary"
        [class.btn-sm]="small()"
        [href]="storeUrl"
        target="_blank"
        rel="nofollow"
        appAnalyticsClick="Demo:Wishlist"
        appSfx="ui-click"
        [sfxTrigger]="['click', 'hover']"
      >
        <ng-icon name="tablerBrandSteam" />
        {{ 'buttonWishlist.wishlistOnSteam' | t }}
      </a>
    }
  `,
})
export class ButtonWishlistComponent {
  public readonly storeUrl = STEAM_STORE_URL;
  public small = input(true);
}
