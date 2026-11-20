import type {
  FFActionRegistration,
  FFGamepadAction,
} from '@ff/interfaces/ff-input';
import { sortBy } from 'es-toolkit/compat';

export function ffActionDispatch(
  registrations: FFActionRegistration[],
  action: FFGamepadAction,
  isElementActive: (element: HTMLElement) => boolean,
): FFActionRegistration | undefined {
  const candidates = registrations.filter(
    (registration) =>
      registration.action === action &&
      (!registration.element || isElementActive(registration.element)),
  );

  return sortBy(candidates, [
    (registration) => -registration.priority,
    (registration) => -registration.order,
  ]).find((registration) => registration.handler() !== false);
}
