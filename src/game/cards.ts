import type { CardDefinition, Effect, Subject, Value } from './types';

// Author cards by composing these primitives. No card-specific engine branches.
export const fx = {
  sequence: (...effects: Effect[]): Effect => ({ type: 'sequence', effects }),
  heat: (amount: Value, to: Subject = 'caster'): Effect => ({ type: 'gainHeat', amount, to }),
  damage: (amount: Value, unblockable = false, to: Subject = 'target'): Effect => ({ type: 'damage', amount, unblockable, to }),
  shield: (amount: Value): Effect => ({ type: 'shield', amount, to: 'caster' }),
  draw: (amount: Value): Effect => ({ type: 'draw', amount, to: 'caster' }),
  counter: (): Effect => ({ type: 'counter' }),
};

export const CARDS: Record<string, CardDefinition> = {
  fireball: {
    id: 'fireball', name: 'Fireball', element: 'fire', cost: { fire: 1 }, speed: 'spell', target: 'opponent',
    text: 'Gain 1 Heat. Then deal damage equal to your Heat.', flavor: 'Every spark remembers the last.',
    effect: fx.sequence(fx.heat(1), fx.damage({ stat: 'heat', of: 'caster' })),
  },
  fanTheFlames: {
    id: 'fanTheFlames', name: 'Fan the Flames', element: 'fire', cost: { fire: 2 }, speed: 'spell', target: 'self',
    text: 'Gain 2 Heat.', flavor: 'A whisper is all an ember needs.', effect: fx.heat(2),
  },
  waterBarrier: {
    id: 'waterBarrier', name: 'Water Barrier', element: 'water', cost: { water: 2 }, speed: 'response', target: 'self',
    text: 'Block the next 3 incoming damage.', flavor: 'Be still. Let the storm break around you.', effect: fx.shield(3),
  },
  counterspell: {
    id: 'counterspell', name: 'Counterspell', element: 'psychic', cost: { psychic: 3 }, speed: 'response', target: 'spell',
    text: 'Counter the last cast spell.', flavor: 'Some words are better left unspoken.', effect: fx.counter(),
  },
  mindSpike: {
    id: 'mindSpike', name: 'Mind Spike', element: 'psychic', cost: { psychic: 3 }, speed: 'spell', target: 'opponent',
    text: 'Deal 3 damage. This damage cannot be blocked.', flavor: 'There is no armor for a thought.', effect: fx.damage(3, true),
  },
  foresight: {
    id: 'foresight', name: 'Foresight', element: 'arcane', cost: { any: 3 }, speed: 'flexible', target: 'self',
    text: 'Draw 2 cards.', flavor: 'Tomorrow has already begun.', effect: fx.draw(2),
  },
  mageBolt: {
    id: 'mageBolt', name: 'Mage Bolt', element: 'arcane', cost: { any: 1 }, speed: 'spell', target: 'opponent',
    text: 'Deal 2 damage.', flavor: 'The first lesson. The last word.', effect: fx.damage(2),
  },
};
export const CARD_LIST = Object.values(CARDS);
export const timingLabel = (card: CardDefinition) => card.speed === 'flexible' ? 'spell / response' : card.speed;
