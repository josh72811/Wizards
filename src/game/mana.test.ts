import { describe, expect, it } from 'vitest';
import { chooseBotAction } from './bot';
import { createGame, definition, reduceGame, validateAction } from './engine';
import { emptyMana, nextRandom, rollMana, validateElements } from './mana';
import { ELEMENTS } from './types';
import type { Element, Seat } from './types';

describe('attunement and exact mana probabilities', () => {
  it('allows every nonempty selection and rejects invalid or duplicate elements', () => {
    for (let mask = 1; mask < 8; mask++) {
      const elements = ELEMENTS.filter((_, i) => mask & (1 << i));
      expect(() => validateElements(elements)).not.toThrow();
    }
    for (const elements of [[], ['fire', 'fire'], ['earth'], ['fire', 'water', 'psychic', 'fire']]) {
      expect(() => createGame(1, [{ name: 'Mage', bot: false, elements: elements as Element[] }, { name: 'Bot', bot: true }])).toThrow(/1–3 distinct/);
    }
  });
  it.each(ELEMENTS)('one-element %s mage gains one normally, or exactly two on a 7% surge', element => {
    expect(rollMana([element], 0, 0).mana).toEqual({ ...emptyMana(), [element]: 2 });
    expect(rollMana([element], .069999, .999999).surge).toBe(true);
    expect(rollMana([element], .07, .5)).toEqual({ mana: { ...emptyMana(), [element]: 1 }, surge: false });
    expect(rollMana([element], .999999, 0).mana[element]).toBe(1);
  });
  it('two-element mage has a 5% burst and equally likely normal colors', () => {
    const elements: Element[] = ['fire', 'water'];
    expect(rollMana(elements, .049999, .7)).toEqual({ mana: { fire: 1, water: 1, psychic: 0 }, surge: true });
    expect(rollMana(elements, .05, .499999).mana).toEqual({ fire: 1, water: 0, psychic: 0 });
    expect(rollMana(elements, .05, .5).mana).toEqual({ fire: 0, water: 1, psychic: 0 });
    expect(rollMana(elements, .5, .999999).mana).toEqual({ fire: 0, water: 1, psychic: 0 });
  });
  it('three-element mage has a 2% burst and three equal normal color intervals', () => {
    expect(rollMana(ELEMENTS, .019999, .8)).toEqual({ mana: { fire: 1, water: 1, psychic: 1 }, surge: true });
    expect(rollMana(ELEMENTS, .02, 0).mana).toEqual({ fire: 1, water: 0, psychic: 0 });
    expect(rollMana(ELEMENTS, .02, 1 / 3).mana).toEqual({ fire: 0, water: 1, psychic: 0 });
    expect(rollMana(ELEMENTS, .02, 2 / 3).mana).toEqual({ fire: 0, water: 0, psychic: 1 });
  });
  it.each([1, 2, 3])('partitions the complete roll grid into the expected %i-element outcomes', count => {
    const elements = ELEMENTS.slice(0, count);
    let surges = 0;
    const normalColors = emptyMana();
    for (let chance = 0; chance < 100; chance++) {
      for (let color = 0; color < count; color++) {
        const gain = rollMana(elements, (chance + .5) / 100, (color + .5) / count);
        if (gain.surge) surges++;
        else for (const e of ELEMENTS) normalColors[e] += gain.mana[e];
      }
    }
    const percent = count === 1 ? 7 : count === 2 ? 5 : 2;
    expect(surges).toBe(percent * count);
    for (const e of elements) expect(normalColors[e]).toBe(100 - percent);
    for (const e of ELEMENTS.filter(e => !elements.includes(e))) expect(normalColors[e]).toBe(0);
  });
  it('rejects out-of-range randomness and does not mutate the chosen elements', () => {
    const elements: Element[] = ['psychic', 'water'];
    rollMana(elements, .5, .5);
    expect(elements).toEqual(['psychic', 'water']);
    for (const value of [-1, 1, NaN, Infinity]) {
      expect(() => rollMana(elements, value, .5)).toThrow();
      expect(() => rollMana(elements, .5, value)).toThrow();
    }
  });
});

describe('turn mana integration and replay', () => {
  const seats: Seat[] = [{ name: 'Fire mage', bot: false, elements: ['fire'] }, { name: 'Water mage', bot: true, elements: ['water'] }];
  it('grants first-turn mana exactly once and waits for the other mage’s own turn', () => {
    const s = createGame(42, seats);
    expect([1, 2]).toContain(s.players[0].mana.fire);
    expect(s.players[0].lastManaGain).toEqual(s.players[0].mana);
    expect(s.players[0].turns).toBe(1);
    expect(s.players[1].mana).toEqual(emptyMana());
    const next = reduceGame(s, { type: 'endTurn', playerId: 'p0' });
    expect(next.players[0].mana).toEqual(s.players[0].mana);
    expect([1, 2]).toContain(next.players[1].mana.water);
    expect(next.players[1].turns).toBe(1);
  });
  it('retains banked mana beyond the former cap and generates only chosen colors', () => {
    let s = createGame(42, seats);
    for (let i = 0; i < 16; i++) s = reduceGame(s, { type: 'endTurn', playerId: s.activePlayerId });
    expect(s.players[0].mana.fire).toBeGreaterThanOrEqual(9);
    expect(s.players[1].mana.water).toBeGreaterThanOrEqual(8);
    expect(s.players[0].mana.water).toBe(0);
    expect(s.players[0].mana.psychic).toBe(0);
    expect(s.players[1].mana.fire).toBe(0);
    expect(s.players[1].mana.psychic).toBe(0);
  });
  it('replays the same turn gain after JSON serialization without changing the input', () => {
    const s = createGame(3, seats);
    const snapshot = structuredClone(s);
    const command = { type: 'endTurn' as const, playerId: 'p0' };
    expect(reduceGame(s, command)).toEqual(reduceGame(JSON.parse(JSON.stringify(s)), command));
    expect(s).toEqual(snapshot);
    expect(reduceGame(s, command).randomState).not.toBe(s.randomState);
    expect(reduceGame(s, { type: 'pass', playerId: 'p0' })).toBe(s);
  });
  it('records the exact gain in the chronicle and marks a real rare surge', () => {
    let seed = 0;
    while (nextRandom(seed).value >= .02) seed++;
    const s = createGame(42);
    s.randomState = seed;
    const next = reduceGame(s, { type: 'endTurn', playerId: 'p0' });
    expect(next.players[1].lastManaSurge).toBe(true);
    expect(next.players[1].mana).toEqual({ fire: 1, water: 1, psychic: 1 });
    expect(next.log.some(e => /1 fire \+ 1 water \+ 1 psychic mana · elemental surge/.test(e.text))).toBe(true);
  });
  it('creates a full, uniquely identified, matching deck for every element combination', () => {
    for (let mask = 1; mask < 8; mask++) {
      const elements = ELEMENTS.filter((_, i) => mask & (1 << i));
      const s = createGame(42, [{ name: 'Mage', bot: false, elements }, { name: 'Bot', bot: true }]);
      const p = s.players[0];
      expect(p.elements).toEqual(elements);
      const cards = [...p.hand, ...p.deck];
      expect(p.hand).toHaveLength(7);
      expect(p.deck).toHaveLength(23);
      expect(new Set(cards.map(c => c.uid)).size).toBe(30);
      for (const card of cards) {
        for (const e of ELEMENTS) if (definition(card).cost[e]) expect(elements).toContain(e);
      }
    }
  });
  it('a mixed-attunement four-bot game finishes with legal actions and no off-color gains', () => {
    let s = createGame(27, [
      { name: 'Fire', bot: true, elements: ['fire'] },
      { name: 'Water', bot: true, elements: ['water'] },
      { name: 'Dual', bot: true, elements: ['fire', 'psychic'] },
      { name: 'Triple', bot: true, elements: [...ELEMENTS] },
    ]);
    for (let i = 0; i < 1500 && !s.ended; i++) {
      const action = chooseBotAction(s)!;
      expect(validateAction(s, action)).toBeNull();
      s = reduceGame(s, action);
      for (const p of s.players) for (const e of ELEMENTS) {
        expect(p.mana[e]).toBeGreaterThanOrEqual(0);
        if (!p.elements.includes(e)) expect(p.mana[e]).toBe(0);
      }
    }
    expect(s.ended).toBe(true);
  });
  it('skips a mage eliminated by their turn draw and grants the next living mage’s mana', () => {
    const s = createGame(27, Array.from({ length: 4 }, (_, n) => ({ name: `Mage ${n}`, bot: true, elements: ['fire'] as Element[] })));
    s.players[1].deck = [];
    s.players[1].health = 1;
    const next = reduceGame(s, { type: 'endTurn', playerId: 'p0' });
    expect(next.players[1].health).toBe(0);
    expect(next.activePlayerId).toBe('p2');
    expect(next.priorityPlayerId).toBe('p2');
    expect(next.players[2].turns).toBe(1);
    expect([1, 2]).toContain(next.players[2].mana.fire);
    expect(validateAction(next, chooseBotAction(next)!)).toBeNull();
  });
});
