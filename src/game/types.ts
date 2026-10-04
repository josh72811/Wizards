export const ELEMENTS = ['fire', 'water', 'psychic'] as const;
export type Element = typeof ELEMENTS[number];
export type Mana = Record<Element, number>;
export type PlayerId = string;
export type Subject = 'caster' | 'target';
export type Value = number | { stat: 'heat' | 'health' | 'shield'; of: Subject } | { add: Value[] };

/** Plain data: definitions can be loaded from JSON, inspected, or serialized. */
export type Effect =
  | { type: 'sequence'; effects: Effect[] }
  | { type: 'gainHeat'; amount: Value; to: Subject }
  | { type: 'damage'; amount: Value; to: Subject; unblockable?: boolean }
  | { type: 'shield'; amount: Value; to: Subject }
  | { type: 'draw'; amount: Value; to: Subject }
  | { type: 'heal'; amount: Value; to: Subject }
  | { type: 'gainMana'; element: Element; amount: Value; to: Subject }
  | { type: 'counter' }
  | { type: 'if'; condition: { value: Value; atLeast: number }; then: Effect; otherwise?: Effect };

export interface CardDefinition {
  id: string;
  name: string;
  element: Element | 'arcane';
  cost: Partial<Mana> & { any?: number };
  speed: 'spell' | 'response' | 'flexible';
  target: 'opponent' | 'self' | 'spell';
  text: string;
  flavor: string;
  effect: Effect;
}
export interface CardInstance { uid: string; definitionId: string }
export interface Player {
  id: PlayerId;
  name: string;
  bot: boolean;
  health: number;
  heat: number;
  shield: number;
  mana: Mana;
  elements: Element[];
  lastManaGain: Mana;
  lastManaSurge: boolean;
  turns: number;
  fatigue: number;
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
}
export interface StackEntry {
  id: string;
  card: CardInstance;
  casterId: PlayerId;
  targetId: PlayerId;
  counterTargetId?: string;
}
export interface LogEntry { id: number; text: string; kind: 'turn' | 'cast' | 'effect' | 'counter' }
export interface GameState {
  players: Player[];
  activePlayerId: PlayerId;
  priorityPlayerId: PlayerId;
  turn: number;
  randomState: number;
  stack: StackEntry[];
  consecutivePasses: number;
  log: LogEntry[];
  nextId: number;
  ended: boolean;
  winnerId: PlayerId | null;
}
export interface Seat { name: string; bot: boolean; elements?: Element[] }
export type Action =
  | { type: 'cast'; playerId: PlayerId; cardUid: string; targetId?: PlayerId }
  | { type: 'pass'; playerId: PlayerId }
  | { type: 'endTurn'; playerId: PlayerId };
