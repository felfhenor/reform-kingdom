import { DOCUMENT, inject, Injectable } from '@angular/core';
import { EventManagerPlugin } from '@angular/platform-browser';

const APPLE_PATTERN = /(mac|iphone|ipod|ipad)/i;
const EVENT_PATTERN = /^click(\.(shift|alt|ctrl)){1,3}$/;

// Enables `(click.shift)`, `(click.alt)`, `(click.ctrl)` (cmd on Apple) template bindings.
@Injectable()
export class ClickModifiersPlugin extends EventManagerPlugin {
  constructor() {
    super(inject(DOCUMENT));
  }

  override supports(eventName: string): boolean {
    return EVENT_PATTERN.test(eventName);
  }

  override addEventListener(
    element: HTMLElement,
    eventName: string,
    handler: (event: MouseEvent) => void,
  ): () => void {
    const isApple = APPLE_PATTERN.test(navigator.platform);
    const modifiers = eventName
      .split('.')
      .slice(1)
      .map((key) => (isApple && key === 'ctrl' ? 'metaKey' : `${key}Key`)) as (
      'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'
    )[];

    const listener = (event: MouseEvent) => {
      if (modifiers.every((modifier) => event[modifier])) handler(event);
    };

    element.addEventListener('click', listener);
    return () => element.removeEventListener('click', listener);
  }
}
