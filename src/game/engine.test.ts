import { describe, expect, it } from 'vitest';
import { chooseBotAction } from './bot';
import { CARDS, fx } from './cards';
import { createGame, getPlayer, payCost, reduceGame, validateAction } from './engine';
import type { GameState, Seat } from './types';

// Spell-resolution fixtures provide mana independently of the per-turn economy.
function fundedGame(seed = 1, seats?: Seat[]) {
  const s = createGame(seed, seats);
  for (const p of s.players) p.mana = { fire: 3, water: 3, psychic: 3 };
  return s;
}

function cast(s: GameState, id: string, spell: string, targetId = id === 'p0' ? 'p1' : 'p0') {
  const card = getPlayer(s, id).hand.find(c => c.definitionId === spell)!;
  const action = { type: 'cast' as const, playerId: id, cardUid: card.uid, targetId };
  expect(validateAction(s, action)).toBeNull();
  return reduceGame(s, action);
}
function resolveTop(s: GameState) {
  const before = s.stack.at(-1)?.id;
  let state = s;
  for (let n = 0; n < 4 && state.stack.at(-1)?.id === before && !state.ended; n++) state = reduceGame(state, { type: 'pass', playerId: state.priorityPlayerId });
  return state;
}

describe('composable spell rules', () => {
  it('Foresight can be cast normally on its caster’s turn and draws two cards', () => {
    const pending = cast(fundedGame(1), 'p0', 'foresight');
    expect(pending.priorityPlayerId).toBe('p1');
    const done = resolveTop(pending);
    expect(done.players[0].hand).toHaveLength(8);
    expect(done.players[0].deck).toHaveLength(21);
    expect(Object.values(done.players[0].mana).reduce((a, b) => a + b)).toBe(6);
  });
  it('Foresight cannot be cast on another player’s turn with an empty stack', () => {
    const s = fundedGame(1);
    s.activePlayerId = 'p1';
    const command = { type: 'cast' as const, playerId: 'p0', cardUid: s.players[0].hand.find(c => c.definitionId === 'foresight')!.uid };
    expect(validateAction(s, command)).toMatch(/your turn or in response/);
    expect(reduceGame(s, command)).toBe(s);
  });
  it('Fireball gains Heat before evaluating damage and preserves its input state', () => {
    const initial = fundedGame(1);
    const snapshot = structuredClone(initial);
    const pending = cast(initial, 'p0', 'fireball');
    expect(pending.players[0].heat).toBe(0);
    expect(pending.players[0].mana.fire).toBe(2);
    const done = resolveTop(pending);
    expect(done.players[0].heat).toBe(1);
    expect(done.players[1].health).toBe(23);
    expect(initial).toEqual(snapshot);
  });
  it('composes Fan the Flames with Fireball', () => {
    const fan = resolveTop(cast(fundedGame(1), 'p0', 'fanTheFlames'));
    expect(fan.players[0].heat).toBe(2);
    const fire = resolveTop(cast(fan, 'p0', 'fireball'));
    expect(fire.players[0].heat).toBe(3);
    expect(fire.players[1].health).toBe(21);
    expect(fire.players[0].mana.fire).toBe(0);
  });
  it('Water Barrier resolves before damage and absorbs damage across hits', () => {
    const fire = cast(fundedGame(1), 'p0', 'fireball');
    const barrier = resolveTop(cast(fire, 'p1', 'waterBarrier'));
    expect(barrier.players[1].shield).toBe(3);
    expect(barrier.players[1].health).toBe(24);
    const hit = resolveTop(barrier);
    expect(hit.players[1].health).toBe(24);
    expect(hit.players[1].shield).toBe(2);
    const bolt = resolveTop(cast(hit, 'p0', 'mageBolt'));
    expect(bolt.players[1].health).toBe(24);
    expect(bolt.players[1].shield).toBe(0);
  });
  it('Mind Spike bypasses shields without consuming them', () => {
    const s = fundedGame(1);
    s.players[1].shield = 5;
    const done = resolveTop(cast(s, 'p0', 'mindSpike'));
    expect(done.players[1].health).toBe(21);
    expect(done.players[1].shield).toBe(5);
  });
  it('Counterspell prevents all effects, while costs stay spent', () => {
    const done = resolveTop(cast(cast(fundedGame(1), 'p0', 'fireball'), 'p1', 'counterspell'));
    expect(done.stack).toHaveLength(0);
    expect(done.players[0].heat).toBe(0);
    expect(done.players[1].health).toBe(24);
    expect(done.players[0].mana.fire).toBe(2);
    expect(done.players[1].mana.psychic).toBe(0);
    expect(done.players.every(p => p.discard.length === 1)).toBe(true);
  });
  it('can counter a Counterspell and allow the original spell to resolve', () => {
    let s = cast(fundedGame(1), 'p0', 'fireball');
    s = cast(s, 'p1', 'counterspell');
    s = cast(s, 'p0', 'counterspell');
    s = resolveTop(s);
    expect(s.stack).toHaveLength(1);
    expect(s.stack[0].card.definitionId).toBe('fireball');
    s = resolveTop(s);
    expect(s.players[0].heat).toBe(1);
    expect(s.players[1].health).toBe(23);
  });
  it('Foresight draws exactly two, without resolving the underlying spell', () => {
    const fire = cast(fundedGame(1), 'p0', 'fireball');
    const done = resolveTop(cast(fire, 'p1', 'foresight'));
    expect(done.players[1].hand).toHaveLength(8);
    expect(done.players[1].deck).toHaveLength(21);
    expect(done.stack).toHaveLength(1);
    expect(Object.values(done.players[1].mana).reduce((a, b) => a + b)).toBe(6);
  });
  it('pays generic costs from any combination of colors', () => {
    expect(payCost({ fire: 1, water: 1, psychic: 1 }, { any: 3 })).toEqual({ fire: 0, water: 0, psychic: 0 });
    expect(payCost({ fire: 0, water: 5, psychic: 5 }, { fire: 1 })).toBeNull();
    expect(payCost({ fire: 1, water: 0, psychic: 1 }, { any: 3 })).toBeNull();
    expect(payCost({ fire: 2, water: 2, psychic: 2 }, { fire: 2, any: 2 })).toEqual({ fire: 0, water: 1, psychic: 1 });
  });
  it('supports conditional, arithmetic, healing, and mana primitives without special card rules', () => {
    const original = CARDS.fanTheFlames.effect;
    try {
      CARDS.fanTheFlames.effect = fx.sequence(fx.heat(2), { type: 'if', condition: { value: { stat: 'heat', of: 'caster' }, atLeast: 2 }, then: fx.damage({ add: [1, { stat: 'heat', of: 'caster' }] }, true, 'caster') }, { type: 'heal', amount: 1, to: 'caster' }, { type: 'gainMana', element: 'water', amount: 2, to: 'caster' });
      const done = resolveTop(cast(fundedGame(1), 'p0', 'fanTheFlames'));
      expect(done.players[0].health).toBe(22);
      expect(done.players[0].mana.water).toBe(5);
    } finally { CARDS.fanTheFlames.effect = original; }
  });
});

describe('turns, legality, and game end', () => {
  it('automatically passes after casting and resolves when the opponent declines', () => {
    const pending = cast(fundedGame(1), 'p0', 'fireball');
    expect(pending.priorityPlayerId).toBe('p1');
    expect(pending.consecutivePasses).toBe(1);
    expect(pending.players[0].heat).toBe(0);
    const done = reduceGame(pending, { type: 'pass', playerId: 'p1' });
    expect(done.stack).toHaveLength(0);
    expect(done.players[0].heat).toBe(1);
    expect(done.players[1].health).toBe(23);
    expect(done.priorityPlayerId).toBe('p0');
  });
  it('automatically passes response casts while preserving the remaining spell’s response window', () => {
    const fire = cast(fundedGame(1), 'p0', 'fireball');
    const response = cast(fire, 'p1', 'waterBarrier');
    expect(response.priorityPlayerId).toBe('p0');
    expect(response.consecutivePasses).toBe(1);
    const barrier = reduceGame(response, { type: 'pass', playerId: 'p0' });
    expect(barrier.players[1].shield).toBe(3);
    expect(barrier.stack).toHaveLength(1);
    expect(barrier.consecutivePasses).toBe(0);
    expect(barrier.priorityPlayerId).toBe('p0');
    const waiting = reduceGame(barrier, { type: 'pass', playerId: 'p0' });
    expect(waiting.stack).toHaveLength(1);
    const done = reduceGame(waiting, { type: 'pass', playerId: 'p1' });
    expect(done.stack).toHaveLength(0);
    expect(done.players[1].shield).toBe(2);
  });
  it('rejects out-of-priority, out-of-turn, response-without-stack, and unaffordable casts', () => {
    const s = fundedGame(1);
    const response = { type: 'cast' as const, playerId: 'p0', cardUid: s.players[0].hand.find(c => c.definitionId === 'waterBarrier')!.uid };
    expect(validateAction(s, response)).toMatch(/pending|stack/);
    expect(reduceGame(s, response)).toBe(s);
    const fire = cast(s, 'p0', 'fireball');
    const regular = { type: 'cast' as const, playerId: 'p1', cardUid: fire.players[1].hand[0].uid, targetId: 'p0' };
    expect(validateAction(fire, regular)).toMatch(/empty spell stack/);
    expect(validateAction(fire, { type: 'pass', playerId: 'p0' })).toMatch(/priority/);
    const poor = fundedGame(1);
    poor.players[0].mana.fire = 0;
    expect(validateAction(poor, { type: 'cast', playerId: 'p0', cardUid: poor.players[0].hand[0].uid, targetId: 'p1' })).toMatch(/mana/);
    expect(validateAction(s, { type: 'cast', playerId: 'p0', cardUid: s.players[0].hand[0].uid, targetId: 'p0' })).toMatch(/opponent/);
  });
  it('only grants mana to the active wizard and preserves banked mana, Heat, and Barrier', () => {
    const s = createGame(1, [{ name: 'You', bot: false, elements: ['fire'] }, { name: 'Bot', bot: true, elements: ['water'] }]);
    s.players[0].heat = 4; s.players[0].shield = 2; s.players[0].mana.fire = 8;
    s.players[1].mana.water = 6;
    const next = reduceGame(s, { type: 'endTurn', playerId: 'p0' });
    expect(next.activePlayerId).toBe('p1');
    expect(next.players[0].mana.fire).toBe(8);
    expect(next.players[1].mana.water).toBe(6 + next.players[1].lastManaGain.water);
    expect(next.players[1].hand).toHaveLength(8);
    const back = reduceGame(next, { type: 'endTurn', playerId: 'p1' });
    expect(back.players[0].mana.fire).toBe(8 + back.players[0].lastManaGain.fire);
    expect(back.players[0].heat).toBe(4);
    expect(back.players[0].shield).toBe(2);
  });
  it('does not end turns with pending spells or pass an empty stack', () => {
    const s = fundedGame(1);
    expect(reduceGame(s, { type: 'pass', playerId: 'p0' })).toBe(s);
    const pending = cast(cast(s, 'p0', 'fireball'), 'p1', 'waterBarrier');
    expect(validateAction(pending, { type: 'endTurn', playerId: 'p0' })).toMatch(/stack/);
  });
  it('declares victory and prevents commands after lethal damage', () => {
    const s = fundedGame(1); s.players[1].health = 1;
    const done = resolveTop(cast(s, 'p0', 'mageBolt'));
    expect(done.ended).toBe(true);
    expect(done.winnerId).toBe('p0');
    expect(done.players[1].health).toBe(0);
    expect(done.stack).toHaveLength(0);
    expect(reduceGame(done, { type: 'endTurn', playerId: 'p0' })).toBe(done);
  });
  it('burns excess draws and applies increasing unblockable fatigue with an empty library', () => {
    const s = fundedGame(1);
    s.players[1].hand.push(...s.players[1].deck.splice(0, 3));
    const full = reduceGame(s, { type: 'endTurn', playerId: 'p0' });
    expect(full.players[1].hand).toHaveLength(10);
    expect(full.players[1].discard).toHaveLength(1);
    const empty = fundedGame(1); empty.players[1].deck = []; empty.players[1].shield = 10;
    let tired = reduceGame(empty, { type: 'endTurn', playerId: 'p0' });
    expect(tired.players[1].health).toBe(23);
    tired = reduceGame(tired, { type: 'endTurn', playerId: 'p1' });
    tired = reduceGame(tired, { type: 'endTurn', playerId: 'p0' });
    expect(tired.players[1].health).toBe(21);
    expect(tired.players[1].shield).toBe(10);
  });
  it('uses deterministic shuffle and unique card IDs in 30-card decks', () => {
    expect(createGame(42)).toEqual(createGame(42));
    expect(createGame(42).players[0].deck).not.toEqual(createGame(43).players[0].deck);
    const all = fundedGame(1).players.flatMap(p => [...p.hand, ...p.deck]);
    expect(all).toHaveLength(60);
    expect(new Set(all.map(c => c.uid)).size).toBe(60);
  });
});

describe('multiplayer-ready priority and bot', () => {
  const seats = Array.from({ length: 4 }, (_, n) => ({ name: `Wizard ${n}`, bot: true }));
  it('automatically passes the caster, then requires all three other players to pass', () => {
    let s = cast(fundedGame(1, seats), 'p0', 'fireball', 'p3');
    expect(s.priorityPlayerId).toBe('p1');
    expect(s.consecutivePasses).toBe(1);
    for (const id of ['p1', 'p2']) { s = reduceGame(s, { type: 'pass', playerId: id }); expect(s.stack).toHaveLength(1); }
    expect(s.priorityPlayerId).toBe('p3');
    s = reduceGame(s, { type: 'pass', playerId: 'p3' });
    expect(s.stack).toHaveLength(0);
    expect(s.players[3].health).toBe(23);
  });
  it('resets consecutive passes on a reaction and skips eliminated seats', () => {
    const initial = fundedGame(1, seats); initial.players[2].health = 0;
    let s = cast(initial, 'p0', 'fireball', 'p3');
    s = reduceGame(s, { type: 'pass', playerId: 'p1' });
    expect(s.priorityPlayerId).toBe('p3');
    expect(s.consecutivePasses).toBe(2);
    s = cast(s, 'p3', 'waterBarrier');
    expect(s.consecutivePasses).toBe(1);
    expect(s.priorityPlayerId).toBe('p0');
    s = resolveTop(s);
    expect(s.players[3].shield).toBe(3);
    expect(s.stack).toHaveLength(1);
  });
  it('advances an eliminated active player after the stack clears', () => {
    const initial = fundedGame(1, seats); initial.players[0].health = 1;
    const original = CARDS.waterBarrier.effect;
    try {
      CARDS.waterBarrier.effect = fx.damage(2, true, 'target');
      let s = cast(initial, 'p0', 'fireball', 'p1');
      // A test response targets its caster; make p0 cast it after the other seats decline a response.
      s = cast(s, 'p1', 'foresight');
      s = reduceGame(s, { type: 'pass', playerId: 'p2' });
      s = reduceGame(s, { type: 'pass', playerId: 'p3' });
      s = cast(s, 'p0', 'waterBarrier');
      s = resolveTop(s);
      expect(s.players[0].health).toBe(0);
      expect(s.ended).toBe(false);
      while (s.stack.length) s = resolveTop(s);
      expect(s.activePlayerId).toBe('p1');
      expect(s.priorityPlayerId).toBe('p1');
    } finally { CARDS.waterBarrier.effect = original; }
  });
  it('bot chooses only legal actions and a full four-wizard game finishes', () => {
    let s = createGame(8, seats);
    for (let n = 0; n < 1500 && !s.ended; n++) {
      const action = chooseBotAction(s);
      expect(action).not.toBeNull();
      expect(validateAction(s, action!)).toBeNull();
      s = reduceGame(s, action!);
      for (const p of s.players) {
        expect(p.health).toBeGreaterThanOrEqual(0);
        expect(p.shield).toBeGreaterThanOrEqual(0);
        expect(p.hand.length).toBeLessThanOrEqual(10);
        expect(Object.values(p.mana).every(m => m >= 0)).toBe(true);
      }
    }
    expect(s.ended).toBe(true);
    expect(s.players.filter(p => p.health > 0).length).toBeLessThanOrEqual(1);
  });
});
