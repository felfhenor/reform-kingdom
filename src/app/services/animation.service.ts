import { Injectable } from '@angular/core';
import { animate, type DOMTarget, type JSAnimation } from 'animejs';

@Injectable({
  providedIn: 'root',
})
export class AnimationService {
  popIn(target: Element): JSAnimation {
    return animate(target as DOMTarget, {
      opacity: [0, 0.85],
      scale: [0.8, 1],
      duration: 220,
      ease: 'outBack',
    });
  }

  fadeOut(target: Element): JSAnimation {
    return animate(target as DOMTarget, {
      opacity: [1, 0],
      duration: 250,
      ease: 'inQuad',
    });
  }
}
