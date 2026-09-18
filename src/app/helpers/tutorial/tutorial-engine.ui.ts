import type { ElementRef } from '@angular/core';
import { signal } from '@angular/core';
import { modalHasAnyOpen } from '@helpers/engine/modal-stack';
import {
  gamePlayView,
  kingdomSubview,
  kingdomSubviewShow,
  setGamePlayView,
} from '@helpers/engine/ui';
import { gameloopShouldRun } from '@helpers/gameloop';
import { isGameStateReady } from '@helpers/state-game';
import { TUTORIAL_CATALOG } from '@helpers/tutorial/tutorial-catalog';
import { isTutorialSeen, tutorialMarkSeen } from '@helpers/tutorial/tutorial-seen';
import { tutorialTriggerSatisfied } from '@helpers/tutorial/tutorial-triggers.ui';
import type {
  GamePlayView,
  KingdomSubview,
  TutorialDefinition,
  TutorialId,
  TutorialStep,
  TutorialUnlockStatusEntry,
} from '@interfaces';

const activeTutorial = signal<
  { tutorialId: TutorialId; stepIndex: number } | undefined
>(undefined);

const tutorialTargets = new Map<string, ElementRef>();
const tutorialTargetRegistryVersion = signal(0);

// Cheap ledger check first, so a seen tutorial's (possibly expensive) trigger predicate is never re-evaluated; always in catalog order for deterministic playback.
export function tutorialsPending(): TutorialDefinition[] {
  if (!isGameStateReady()) return [];

  const unseen = TUTORIAL_CATALOG.filter((t) => !isTutorialSeen(t.id));
  if (unseen.length === 0) return [];

  return unseen.filter((t) => tutorialTriggerSatisfied(t.trigger));
}

// Only the next tutorial in catalog order is surfaced - never a choice of several to jump ahead of.
export function tutorialsPendingEntries(): TutorialUnlockStatusEntry[] {
  const next = tutorialsPending()[0];
  return next ? [{ tutorialId: next.id, name: next.name }] : [];
}

export function activeTutorialStepView():
  | {
      tutorial: TutorialDefinition;
      step: TutorialStep;
      stepIndex: number;
      totalSteps: number;
    }
  | undefined {
  const active = activeTutorial();
  if (!active) return undefined;

  const tutorial = TUTORIAL_CATALOG.find((t) => t.id === active.tutorialId);
  const step = tutorial?.steps[active.stepIndex];
  if (!tutorial || !step) return undefined;

  return {
    tutorial,
    step,
    stepIndex: active.stepIndex,
    totalSteps: tutorial.steps.length,
  };
}

function navigateToStep(step: TutorialStep): void {
  setGamePlayView(step.view);
  if (step.view === 'kingdom' && step.subview) {
    kingdomSubviewShow(step.subview);
  }
}

// Never auto-chains into other pending tutorials - each one always needs its own explicit trigger.
export function tutorialStart(tutorialId: TutorialId): void {
  const tutorial = TUTORIAL_CATALOG.find((t) => t.id === tutorialId);
  if (!tutorial || tutorial.steps.length === 0) return;

  activeTutorial.set({ tutorialId, stepIndex: 0 });
  navigateToStep(tutorial.steps[0]);
}

// Awaits the mark-seen write before clearing activeTutorial, or the auto-trigger effect can see the tutorial as still-unseen and instantly restart it.
async function tutorialFinish(tutorialId: TutorialId): Promise<void> {
  await tutorialMarkSeen(tutorialId);
  activeTutorial.set(undefined);
}

export async function tutorialAdvance(): Promise<void> {
  const active = activeTutorial();
  if (!active) return;

  const tutorial = TUTORIAL_CATALOG.find((t) => t.id === active.tutorialId);
  if (!tutorial) return;

  const nextStepIndex = active.stepIndex + 1;
  if (nextStepIndex >= tutorial.steps.length) {
    await tutorialFinish(active.tutorialId);
    return;
  }

  activeTutorial.set({ tutorialId: active.tutorialId, stepIndex: nextStepIndex });
  navigateToStep(tutorial.steps[nextStepIndex]);
}

export async function tutorialSkip(): Promise<void> {
  const active = activeTutorial();
  if (!active) return;
  await tutorialFinish(active.tutorialId);
}

export function tutorialTargetRegister(
  key: string,
  elementRef: ElementRef,
): void {
  tutorialTargets.set(key, elementRef);
  tutorialTargetRegistryVersion.update((v) => v + 1);
}

export function tutorialTargetUnregister(key: string): void {
  tutorialTargets.delete(key);
  tutorialTargetRegistryVersion.update((v) => v + 1);
}

// Reads the version signal unconditionally so computed()/effect() callers re-run once a target (re)registers.
export function tutorialTargetRect(key: string): DOMRect | undefined {
  tutorialTargetRegistryVersion();
  const elementRef = tutorialTargets.get(key);
  return (elementRef?.nativeElement as HTMLElement | undefined)?.getBoundingClientRect();
}

// Tracks the last-checked view/subview, to tell "just navigated here" apart from "was already sitting here" below.
let hasCheckedViewBefore = false;
let lastCheckedView: GamePlayView | undefined;
let lastCheckedSubview: KingdomSubview | undefined;

// Matches the whole pending list, not just the catalog-first entry - landing on a screen should always show that screen's own tutorial, even if an unrelated one is still unseen elsewhere (catalog order only governs the corner icon's "next" suggestion).
// Still requires an actual navigation transition (except the immediate game-start intro), not merely sitting on a matching screen when it becomes eligible.
export function tutorialCheckAutoTrigger(): void {
  if (
    !isGameStateReady() ||
    !gameloopShouldRun() ||
    activeTutorial() ||
    modalHasAnyOpen()
  )
    return;

  const view = gamePlayView();
  const subview = kingdomSubview();
  const isNavigationTransition =
    hasCheckedViewBefore &&
    (view !== lastCheckedView || subview !== lastCheckedSubview);
  hasCheckedViewBefore = true;
  lastCheckedView = view;
  lastCheckedSubview = subview;

  const match = tutorialsPending().find((t) => {
    const firstStep = t.steps[0];
    return (
      firstStep.view === view &&
      (firstStep.view !== 'kingdom' || firstStep.subview === subview)
    );
  });
  if (!match) return;

  const firesImmediately = match.trigger.kind === 'game-start';
  if (!firesImmediately && !isNavigationTransition) return;

  tutorialStart(match.id);
}
