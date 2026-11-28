import { t } from '@helpers/i18n/i18n';
import { heroesSelectCharacter } from '@helpers/engine/ui';
import { partyFirstBurstSkillHero } from '@helpers/hero/job';
import { partyFirstHeroWithFreeSp } from '@helpers/hero/skill-tree';
import { worldPartyState } from '@helpers/state-game';
import type { TutorialDefinition } from '@interfaces';

export const TUTORIAL_CATALOG: TutorialDefinition[] = [
  {
    id: 'main-ui',
    get name() {
      return t('tutorial.mainUi.name');
    },
    trigger: { kind: 'game-start' },
    steps: [
      {
        targetKey: 'nav-world',
        view: 'world',
        get title() {
          return t('tutorial.mainUi.world');
        },
        get body() {
          return t('tutorial.mainUi.yourPartyExploresThe');
        },
      },
      {
        targetKey: 'nav-kingdom',
        view: 'kingdom',
        get title() {
          return t('tutorial.mainUi.kingdom');
        },
        get body() {
          return t('tutorial.mainUi.manageYourStorageCrafting');
        },
      },
      {
        targetKey: 'nav-heroes',
        view: 'heroes',
        get title() {
          return t('tutorial.mainUi.heroes');
        },
        get body() {
          return t('tutorial.mainUi.reviewYourPartyEquipment');
        },
      },
      {
        targetKey: 'nav-adventurelog',
        view: 'adventurelog',
        get title() {
          return t('tutorial.mainUi.adventureLog');
        },
        get body() {
          return t('tutorial.mainUi.aRecordOfEverything');
        },
      },
    ],
  },
  {
    id: 'losing-streak',
    get name() {
      return t('tutorial.losingStreak.name');
    },
    trigger: { kind: 'losing-streak', losses: 3, belowLevel: 10 },
    repeatable: true,
    steps: [
      {
        get title() {
          return t('tutorial.losingStreak.name');
        },
        get body() {
          return t('tutorial.losingStreak.youMightBeUnderpowered');
        },
      },
    ],
  },
  {
    id: 'workers',
    get name() {
      return t('tutorial.workers.name');
    },
    trigger: { kind: 'first-worker' },
    steps: [
      {
        targetKey: 'kingdom-subview-workers',
        view: 'kingdom',
        subview: 'workers',
        get title() {
          return t('tutorial.workers.name');
        },
        get body() {
          return t('tutorial.workers.rescuedWorkersCanBe');
        },
      },
    ],
  },
  {
    id: 'infusion',
    get name() {
      return t('tutorial.infusion.name');
    },
    trigger: { kind: 'first-infusion-material' },
    steps: [
      {
        targetKey: 'kingdom-workshop-tab-infuse',
        view: 'kingdom',
        subview: 'workshop',
        get title() {
          return t('tutorial.infusion.name');
        },
        get body() {
          return t('tutorial.infusion.hereYouCanInfuse');
        },
      },
    ],
  },
  {
    id: 'reforge',
    get name() {
      return t('tutorial.reforge.name');
    },
    trigger: { kind: 'first-reforge-reagent' },
    steps: [
      {
        targetKey: 'kingdom-workshop-tab-reforge',
        view: 'kingdom',
        subview: 'workshop',
        get title() {
          return t('tutorial.reforge.name');
        },
        get body() {
          return t('tutorial.reforge.hereYouCanReforge');
        },
      },
    ],
  },
  {
    id: 'decree',
    get name() {
      return t('tutorial.decree.name');
    },
    trigger: { kind: 'party-level', level: 5 },
    steps: [
      {
        targetKey: 'nav-decree',
        view: 'decree',
        get title() {
          return t('tutorial.decree.name');
        },
        get body() {
          return t('tutorial.decree.theDecreeAllowsYou');
        },
      },
    ],
  },
  {
    id: 'combat-orders',
    get name() {
      return t('tutorial.combatOrders.name');
    },
    trigger: { kind: 'party-level', level: 3 },
    steps: [
      {
        targetKey: 'hero-combat-orders',
        view: 'heroes',
        get title() {
          return t('tutorial.combatOrders.name');
        },
        get body() {
          return t('tutorial.combatOrders.eachHeroHasA');
        },
      },
    ],
  },
  {
    id: 'town',
    get name() {
      return t('tutorial.town.name');
    },
    trigger: { kind: 'first-town-visit' },
    steps: [
      {
        targetKey: 'game-play-town',
        view: 'town',
        get title() {
          return t('tutorial.town.name');
        },
        get body() {
          return t('tutorial.town.townsHaveTheirOwn');
        },
      },
    ],
  },
  {
    id: 'commissions',
    get name() {
      return t('tutorial.commissions.name');
    },
    trigger: { kind: 'first-caravan-visit' },
    steps: [
      {
        targetKey: 'kingdom-subview-commissions',
        view: 'kingdom',
        subview: 'commissions',
        get title() {
          return t('tutorial.commissions.name');
        },
        get body() {
          return t('tutorial.commissions.caravansAreAllOver');
        },
      },
    ],
  },
  {
    id: 'teachings',
    get name() {
      return t('tutorial.teachings.name');
    },
    trigger: { kind: 'first-trainer-visit' },
    steps: [
      {
        targetKey: 'hero-teachings',
        view: 'heroes',
        get title() {
          return t('tutorial.teachings.name');
        },
        get body() {
          return t('tutorial.teachings.trainersAroundTheWorld');
        },
      },
    ],
  },
  {
    id: 'burst-skills',
    get name() {
      return t('tutorial.burstSkills.name');
    },
    trigger: { kind: 'first-burst-skill' },
    steps: [
      {
        targetKey: 'hero-burst-skill',
        view: 'heroes',
        prepare: () => {
          const hero = partyFirstBurstSkillHero(worldPartyState());
          if (hero) heroesSelectCharacter(hero.id);
        },
        get title() {
          return t('tutorial.burstSkills.name');
        },
        get body() {
          return t('tutorial.burstSkills.thisHeroHasLearned');
        },
      },
    ],
  },
  {
    id: 'skill-trees',
    get name() {
      return t('tutorial.skillTrees.name');
    },
    trigger: { kind: 'first-skill-point' },
    steps: [
      {
        targetKey: 'hero-skill-tree',
        view: 'heroes',
        advanceOnTargetClick: true,
        prepare: () => {
          const hero = partyFirstHeroWithFreeSp(worldPartyState());
          if (hero) heroesSelectCharacter(hero.id);
        },
        get title() {
          return t('tutorial.skillTrees.name');
        },
        get body() {
          return t('tutorial.skillTrees.thisHeroHasSkill');
        },
      },
    ],
  },
];
