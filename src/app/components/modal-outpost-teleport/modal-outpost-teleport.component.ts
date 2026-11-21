import { FFFocusRowDirective } from '@ff/focus/ff-focus-row.directive';
import { FFButtonComponent } from '@ff/components/button/button.component';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ModalComponent } from '@components/modal/modal.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { OUTPOST_TELEPORT_LEVEL } from '@helpers/config';
import { modalClose } from '@helpers/engine/modal-stack';
import { activeOutpostTeleportNode } from '@helpers/engine/ui';
import {
  outpostTeleport,
  outpostTeleportRows,
} from '@helpers/world-node/world-node-outpost.ui';
import type { OutpostTeleportRow } from '@interfaces';

@Component({
  selector: 'app-modal-outpost-teleport',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FFFocusRowDirective,
    FFButtonComponent,
    DecimalPipe,
    ModalComponent,
    SpriteNodeComponent,
  ],
  templateUrl: './modal-outpost-teleport.component.html',
})
export class ModalOutpostTeleportComponent {
  public teleportLevel = OUTPOST_TELEPORT_LEVEL;

  public rows = computed<OutpostTeleportRow[]>(() => {
    const from = activeOutpostTeleportNode();
    return from ? outpostTeleportRows(from) : [];
  });

  public teleport(row: OutpostTeleportRow): void {
    const from = activeOutpostTeleportNode();
    if (!from || !outpostTeleport(from, row.entry)) return;

    modalClose('outpost-teleport');
  }
}
