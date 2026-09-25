import type { TutorialDefinition } from '@interfaces';

export const TUTORIAL_CATALOG: TutorialDefinition[] = [
  {
    id: 'main-ui',
    name: 'Getting Started',
    trigger: { kind: 'game-start' },
    steps: [
      {
        targetKey: 'nav-world',
        view: 'world',
        title: 'World',
        body: 'Your party explores the map here - travel between nodes, gather materials, and fight encounters.',
      },
      {
        targetKey: 'nav-kingdom',
        view: 'kingdom',
        title: 'Kingdom',
        body: 'Manage your storage, crafting buildings, armory, and other kingdom facilities from here.',
      },
      {
        targetKey: 'nav-heroes',
        view: 'heroes',
        title: 'Heroes',
        body: 'Review your party equipment/skills, equip gear, give your heroes orders.',
      },
      {
        targetKey: 'nav-adventurelog',
        view: 'adventurelog',
        title: 'Adventure Log',
        body: 'A record of everything your party and kingdom has done - combat, travel, gathering, and crafting.',
      },
    ],
  },
  {
    id: 'workers',
    name: 'Workers',
    trigger: { kind: 'first-worker' },
    steps: [
      {
        targetKey: 'kingdom-subview-workers',
        view: 'kingdom',
        subview: 'workers',
        title: 'Workers',
        body: 'Rescued workers can be assigned to gather materials automatically and independently of your party. They can level up to reach further out locations, too!',
      },
    ],
  },
  {
    id: 'infusion',
    name: 'Infusion',
    trigger: { kind: 'first-infusion-material' },
    steps: [
      {
        targetKey: 'kingdom-subview-infusion',
        view: 'kingdom',
        subview: 'infusion',
        title: 'Infusion',
        body: 'Infuse your equipment with various materials found on your travels to increase your exploration and combat power!',
      },
    ],
  },
  {
    id: 'decree',
    name: 'Decree',
    trigger: { kind: 'party-level', level: 5 },
    steps: [
      {
        targetKey: 'nav-decree',
        view: 'decree',
        title: 'Decree',
        body: 'The Decree allows you to tell your hero party how to explore the world, what items to gather, and what dungeons to farm for loot. There are other orders you can specify too - be sure to check them out! For the decree to be active, you must turn auto mode ON!',
      },
    ],
  },
  {
    id: 'combat-orders',
    name: 'Combat Orders',
    trigger: { kind: 'party-level', level: 3 },
    steps: [
      {
        targetKey: 'nav-heroes',
        view: 'heroes',
        title: 'Combat Orders',
        body: 'Each hero has a Combat Orders button that you can use to loosely guide their actions in combat.',
      },
    ],
  },
  {
    id: 'town',
    name: 'Town',
    trigger: { kind: 'first-town-visit' },
    steps: [
      {
        targetKey: 'game-play-town',
        view: 'town',
        title: 'Town',
        body: "Towns have their own shop, commissions, and crafting. As you build reputation, they'll offer you more perks.",
      },
    ],
  },
  {
    id: 'commissions',
    name: 'Commissions',
    trigger: { kind: 'first-caravan-visit' },
    steps: [
      {
        targetKey: 'kingdom-subview-commissions',
        view: 'kingdom',
        subview: 'commissions',
        title: 'Commissions',
        body: 'Caravans are all over the world, selling items and offering commissions. Complete their commissions to earn Trader Scrip, a currency you can use to unlock more permanent rewards.',
      },
    ],
  },
  {
    id: 'teachings',
    name: 'Teachings',
    trigger: { kind: 'first-trainer-visit' },
    steps: [
      {
        targetKey: 'hero-teachings',
        view: 'heroes',
        title: 'Teachings',
        body: 'Trainers around the world teach permanent upgrades to your heroes. Each teaching is learned per hero, per job, and applies to every job the hero has unlocked.',
      },
    ],
  },
];
