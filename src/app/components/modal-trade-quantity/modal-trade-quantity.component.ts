import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  LOCALE_ID,
  viewChild,
} from '@angular/core';
import { caravanTradeQuantityFromInput } from '@helpers/caravan/caravan-trade-quantity.ui';
import type { TradeQuantityPrompt } from '@interfaces';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-modal-trade-quantity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SweetAlert2Module],
  templateUrl: './modal-trade-quantity.component.html',
})
export class ModalTradeQuantityComponent {
  private locale = inject(LOCALE_ID);
  private confirmSwal = viewChild<SwalComponent>('confirmSwal');
  private quantitySwal = viewChild<SwalComponent>('quantitySwal');

  // Resolves to the chosen quantity, 0 if cancelled. A single available unit skips straight to a yes/no.
  public async ask(
    prompt: TradeQuantityPrompt,
    skipConfirm = false,
  ): Promise<number> {
    if (prompt.maxQuantity <= 0) return 0;
    if (skipConfirm) return 1;

    const price = formatNumber(prompt.price, this.locale);
    return prompt.maxQuantity === 1
      ? this.askSingle(prompt, price)
      : this.askQuantity(prompt, price);
  }

  private async askSingle(
    prompt: TradeQuantityPrompt,
    price: string,
  ): Promise<number> {
    const swal = this.confirmSwal();
    if (!swal) return 0;

    swal.swalOptions = { text: `${prompt.verb} ${prompt.name} for ${price}g?` };
    const result = await swal.fire();
    return result.isConfirmed ? 1 : 0;
  }

  private async askQuantity(
    prompt: TradeQuantityPrompt,
    price: string,
  ): Promise<number> {
    const swal = this.quantitySwal();
    if (!swal) return 0;

    swal.swalOptions = {
      text: `How many ${prompt.name} would you like to ${prompt.verb.toLowerCase()}? (${price}g each)`,
      inputValue: 1,
      inputAttributes: { min: '0', max: `${prompt.maxQuantity}` },
    };
    const result = await swal.fire();
    return result.isConfirmed
      ? caravanTradeQuantityFromInput(result.value, prompt.maxQuantity)
      : 0;
  }
}
