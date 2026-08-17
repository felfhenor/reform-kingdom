import type { TemplateRef, ViewContainerRef } from '@angular/core';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TeleportService {
  private portalOutlets: Record<string, ViewContainerRef> = {};

  // Tracks which template currently owns each outlet, so a teleporter that
  // has already been superseded by a newer one targeting the same key can't
  // clear the outlet out from under it when it is destroyed.
  private activeTemplates: Record<string, TemplateRef<unknown>> = {};

  registerPortalOutlet(key: string, viewContainerRef: ViewContainerRef): void {
    this.portalOutlets[key] = viewContainerRef;
  }

  unregisterPortalOutlet(key: string): void {
    delete this.portalOutlets[key];
  }

  startTeleportation(key: string, templateRef: TemplateRef<unknown>): void {
    const outlet = this.portalOutlets[key];
    outlet?.clear();
    outlet?.createEmbeddedView(templateRef);
    this.activeTemplates[key] = templateRef;
  }

  finishTeleportation(key: string, templateRef: TemplateRef<unknown>): void {
    if (this.activeTemplates[key] !== templateRef) return;

    this.portalOutlets[key]?.clear();
    delete this.activeTemplates[key];
  }
}
