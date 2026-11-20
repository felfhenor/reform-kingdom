import type {
  FFActionRegistration,
  FFGamepadAction,
  FFPrompt,
} from '@ff/interfaces/ff-input';
import { sortBy } from 'es-toolkit/compat';

export function ffActionCandidates(
  registrations: FFActionRegistration[],
  action: FFGamepadAction,
  isElementActive: (element: HTMLElement) => boolean,
): FFActionRegistration[] {
  const candidates = registrations.filter(
    (registration) =>
      registration.action === action &&
      (registration.enabled?.() ?? true) &&
      (!registration.element || isElementActive(registration.element)),
  );

  return sortBy(candidates, [
    (registration) => -registration.priority,
    (registration) => -registration.order,
  ]);
}

export function ffActionDispatch(
  registrations: FFActionRegistration[],
  action: FFGamepadAction,
  isElementActive: (element: HTMLElement) => boolean,
): FFActionRegistration | undefined {
  return ffActionCandidates(registrations, action, isElementActive).find(
    (registration) => registration.handler() !== false,
  );
}

function ffRegistrationLabel(
  registration?: FFActionRegistration,
): string | undefined {
  const label = registration?.label;
  return typeof label === 'function' ? label() : label;
}

// Only the top handler counts, so an unlabeled blocker hides the prompts it blocks.
export function ffActivePrompts(
  registrations: FFActionRegistration[],
  actions: FFGamepadAction[],
  isElementActive: (element: HTMLElement) => boolean,
): FFPrompt[] {
  return actions.reduce<FFPrompt[]>((prompts, action) => {
    const top = ffActionCandidates(registrations, action, isElementActive)[0];
    const label = ffRegistrationLabel(top);
    if (!label) return prompts;

    const existing = prompts.find((prompt) => prompt.label === label);
    if (existing) existing.actions.push(action);
    else prompts.push({ actions: [action], label });
    return prompts;
  }, []);
}
