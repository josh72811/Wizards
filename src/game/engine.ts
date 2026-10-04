import { CARDS, CARD_LIST } from './cards';
import { ELEMENTS } from './types';
import { emptyMana, nextRandom, rollMana, validateElements } from './mana';
import type { Action, CardDefinition, CardInstance, Effect, GameState, Mana, Player, Seat, StackEntry, Value } from './types';

export const STARTING_HEALTH = 24;
export const HAND_LIMIT = 10;
export const getPlayer = (state: GameState, id: string) => state.players.find(p => p.id === id)!;
export const livingPlayers = (state: GameState) => state.players.filter(p => p.health > 0);
export const definition = (card: CardInstance) => CARDS[card.definitionId];

/** Pay colored costs first; generic costs use the most plentiful remaining color. */
export function payCost(mana: Mana, cost: CardDefinition['cost']): Mana | null {
  const remaining = { ...mana };
  for (const color of ELEMENTS) {
    remaining[color] -= cost[color] ?? 0;
    if (remaining[color] < 0) return null;
  }
  for (let i = 0; i < (cost.any ?? 0); i++) {
    const color = [...ELEMENTS].sort((a, b) => remaining[b] - remaining[a])[0];
    if (remaining[color] <= 0) return null;
    remaining[color]--;
  }
  return remaining;
}

function log(s: GameState, text: string, kind: GameState['log'][number]['kind'] = 'effect') {
  s.log.push({ id: s.nextId++, text, kind });
  if (s.log.length > 150) s.log.shift();
}

function nextLiving(s: GameState, afterId: string): string {
  const index = s.players.findIndex(p => p.id === afterId);
  for (let n = 1; n <= s.players.length; n++) {
    const p = s.players[(index + n) % s.players.length];
    if (p.health > 0) return p.id;
  }
  return afterId;
}

function checkEnd(s: GameState) {
  const alive = livingPlayers(s);
  if (alive.length <= 1) {
    s.ended = true;
    s.winnerId = alive[0]?.id ?? null;
    s.stack.forEach(entry => getPlayer(s, entry.casterId).discard.push(entry.card));
    s.stack = [];
    log(s, alive[0] ? `${alive[0].name} wins the duel.` : 'The duel ends in a draw.');
  } else if (getPlayer(s, s.priorityPlayerId).health <= 0) {
    s.priorityPlayerId = nextLiving(s, s.priorityPlayerId);
    s.consecutivePasses = 0;
  }
}

function damage(s: GameState, p: Player, amount: number, unblockable = false) {
  if (p.health <= 0) return;
  const blocked = unblockable ? 0 : Math.min(p.shield, amount);
  p.shield -= blocked;
  p.health = Math.max(0, p.health - (amount - blocked));
  log(s, `${p.name} takes ${amount - blocked} damage${blocked ? ` (${blocked} blocked)` : ''}${unblockable ? ' · unblockable' : ''}.`);
}

function draw(s: GameState, p: Player, amount: number) {
  for (let i = 0; i < amount && p.health > 0; i++) {
    const card = p.deck.shift();
    if (!card) {
      p.fatigue++;
      log(s, `${p.name}'s library is empty. Fatigue deals ${p.fatigue} damage.`);
      damage(s, p, p.fatigue, true);
    } else if (p.hand.length >= HAND_LIMIT) {
      p.discard.push(card);
      log(s, `${p.name}'s hand is full. ${definition(card).name} is discarded.`);
    } else p.hand.push(card);
  }
}

function valueOf(value: Value, s: GameState, entry: StackEntry): number {
  if (typeof value === 'number') return Math.max(0, value);
  if ('add' in value) return value.add.reduce<number>((sum, v) => sum + valueOf(v, s, entry), 0);
  return getPlayer(s, value.of === 'caster' ? entry.casterId : entry.targetId)[value.stat];
}

/** A small interpreter: all cards execute through the same effect primitives. */
function applyEffect(s: GameState, entry: StackEntry, effect: Effect): void {
  if (effect.type === 'sequence') {
    effect.effects.forEach(e => applyEffect(s, entry, e));
    return;
  }
  if (effect.type === 'if') {
    const branch = valueOf(effect.condition.value, s, entry) >= effect.condition.atLeast ? effect.then : effect.otherwise;
    if (branch) applyEffect(s, entry, branch);
    return;
  }
  if (effect.type === 'counter') {
    const index = s.stack.findIndex(e => e.id === entry.counterTargetId);
    if (index >= 0) {
      const [countered] = s.stack.splice(index, 1);
      getPlayer(s, countered.casterId).discard.push(countered.card);
      log(s, `${definition(countered.card).name} is countered.`, 'counter');
    } else log(s, 'Counterspell has no remaining target.');
    return;
  }
  const p = getPlayer(s, effect.to === 'caster' ? entry.casterId : entry.targetId);
  if (p.health <= 0) { log(s, 'The target has been eliminated.'); return; }
  const amount = Math.floor(valueOf(effect.amount, s, entry));
  switch (effect.type) {
    case 'gainHeat': p.heat += amount; log(s, `${p.name} gains ${amount} Heat (now ${p.heat}).`); break;
    case 'damage': damage(s, p, amount, effect.unblockable); break;
    case 'shield': p.shield += amount; log(s, `${p.name} gains ${amount} Barrier (now ${p.shield}).`); break;
    case 'draw': draw(s, p, amount); log(s, `${p.name} draws ${amount} cards.`); break;
    case 'heal': p.health = Math.min(STARTING_HEALTH, p.health + amount); log(s, `${p.name} restores ${amount} health.`); break;
    case 'gainMana': p.mana[effect.element] += amount; log(s, `${p.name} gains ${amount} ${effect.element} mana.`); break;
  }
}

function gainTurnMana(s: GameState, p: Player) {
  const surgeRoll = nextRandom(s.randomState);
  const colorRoll = nextRandom(surgeRoll.state);
  s.randomState = colorRoll.state;
  const gain = rollMana(p.elements, surgeRoll.value, colorRoll.value);
  p.lastManaGain = gain.mana;
  p.lastManaSurge = gain.surge;
  for (const element of ELEMENTS) p.mana[element] += gain.mana[element];
  const summary = ELEMENTS.filter(e => gain.mana[e]).map(e => `${gain.mana[e]} ${e}`).join(' + ');
  log(s, `${p.name} gains ${summary} mana${gain.surge ? ' · elemental surge!' : ''}.`, 'turn');
}

function beginTurn(s: GameState, id: string) {
  s.activePlayerId = id;
  s.priorityPlayerId = id;
  s.turn++;
  s.consecutivePasses = 0;
  const p = getPlayer(s, id);
  p.turns++;
  gainTurnMana(s, p);
  draw(s, p, 1);
  log(s, `Turn ${s.turn} · ${p.name} draws a card.`, 'turn');
  checkEnd(s);
  // Fatigue can eliminate the active mage during their opening draw.
  if (!s.ended && p.health <= 0) beginTurn(s, nextLiving(s, id));
}

export function validateAction(s: GameState, action: Action): string | null {
  if (s.ended) return 'The duel has ended.';
  const p = s.players.find(p => p.id === action.playerId);
  if (!p || p.health <= 0) return 'This wizard cannot act.';
  if (s.priorityPlayerId !== p.id) return 'Wait for your priority.';
  if (action.type === 'endTurn') {
    if (s.activePlayerId !== p.id) return 'It is not your turn.';
    if (s.stack.length) return 'Resolve the spell stack first.';
    return null;
  }
  if (action.type === 'pass') return s.stack.length ? null : 'No spells are waiting. End your turn instead.';
  const card = p.hand.find(c => c.uid === action.cardUid);
  if (!card || !definition(card)) return 'That card is not in your hand.';
  const def = definition(card);
  if (def.speed === 'spell' && (s.activePlayerId !== p.id || s.stack.length)) return 'Cast this during your turn with an empty spell stack.';
  if (def.speed === 'response' && !s.stack.length) return 'Response spells need a spell on the stack.';
  if (def.speed === 'flexible' && !s.stack.length && s.activePlayerId !== p.id) return 'Cast this during your turn or in response to a spell.';
  if (!payCost(p.mana, def.cost)) return 'Not enough mana.';
  if (def.target === 'opponent') {
    const target = s.players.find(t => t.id === action.targetId);
    if (!target || target.id === p.id || target.health <= 0) return 'Choose a living opponent.';
  }
  return null;
}

/** Pure state transition. Invalid commands return the original state unchanged. */
export function reduceGame(state: GameState, action: Action): GameState {
  if (validateAction(state, action)) return state;
  const s = structuredClone(state);
  const p = getPlayer(s, action.playerId);
  if (action.type === 'cast') {
    const index = p.hand.findIndex(c => c.uid === action.cardUid);
    const [card] = p.hand.splice(index, 1);
    const def = definition(card);
    p.mana = payCost(p.mana, def.cost)!;
    s.stack.push({
      id: `spell-${s.nextId++}`, card, casterId: p.id,
      targetId: def.target === 'opponent' ? action.targetId! : p.id,
      counterTargetId: def.target === 'spell' ? s.stack.at(-1)?.id : undefined,
    });
    // Casting includes an automatic pass, so only the other living seats must decline.
    s.consecutivePasses = 1;
    s.priorityPlayerId = nextLiving(s, p.id);
    log(s, `${p.name} casts ${def.name}.`, 'cast');
  } else if (action.type === 'endTurn') {
    beginTurn(s, nextLiving(s, p.id));
  } else {
    s.consecutivePasses++;
    if (s.consecutivePasses >= livingPlayers(s).length) {
      const entry = s.stack.pop()!;
      log(s, `${definition(entry.card).name} resolves.`);
      applyEffect(s, entry, definition(entry.card).effect);
      getPlayer(s, entry.casterId).discard.push(entry.card);
      s.consecutivePasses = 0;
      s.priorityPlayerId = s.activePlayerId;
      checkEnd(s);
      // A removed active wizard's turn ends once all pending spells resolve.
      if (!s.ended && !s.stack.length && getPlayer(s, s.activePlayerId).health <= 0) beginTurn(s, nextLiving(s, s.activePlayerId));
    } else s.priorityPlayerId = nextLiving(s, p.id);
  }
  return s;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
}

/** The same engine accepts two, three, or four seats without duel-specific logic. */
export function createGame(seed = Date.now(), seats: Seat[] = [ { name: 'You', bot: false }, { name: 'Vesper', bot: true } ]): GameState {
  if (seats.length < 2 || seats.length > 4) throw new Error('Choose between 2 and 4 players.');
  let randomState = seed >>> 0;
  const random = () => { const next = nextRandom(randomState); randomState = next.state; return next.value; };
  const players: Player[] = seats.map((seat, index) => {
    const id = `p${index}`;
    const elements = seat.elements ? [...seat.elements] : [...ELEMENTS];
    validateElements(elements);
    // Keep the training deck playable for any attunement; generic-cost cards fit every mage.
    const available = CARD_LIST.filter(c => ELEMENTS.every(e => !c.cost[e] || elements.includes(e)));
    const opening = Array.from({ length: 7 }, (_, n) => ({ uid: `${id}-opening-${n}`, definitionId: available[n % available.length].id }));
    const rest = Array.from({ length: 23 }, (_, n) => available[n % available.length].id);
    const deck = shuffle(rest.map((definitionId, n) => ({ uid: `${id}-${n}`, definitionId })), random);
    return { id, name: seat.name, bot: seat.bot, elements, health: STARTING_HEALTH, heat: 0, shield: 0, mana: emptyMana(), lastManaGain: emptyMana(), lastManaSurge: false, turns: index === 0 ? 1 : 0, fatigue: 0, hand: opening, deck, discard: [] };
  });
  const s: GameState = { players, activePlayerId: players[0].id, priorityPlayerId: players[0].id, turn: 1, randomState, stack: [], consecutivePasses: 0, log: [{ id: 0, text: 'The duel begins. You have the first turn.', kind: 'turn' }], nextId: 1, ended: false, winnerId: null };
  gainTurnMana(s, players[0]);
  return s;
}
