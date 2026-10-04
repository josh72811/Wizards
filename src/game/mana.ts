import { ELEMENTS } from './types';
import type { Element, Mana } from './types';

export const emptyMana = (): Mana => ({ fire: 0, water: 0, psychic: 0 });
export const SURGE_CHANCE: Record<number, number> = { 1: 0.07, 2: 0.05, 3: 0.02 };

export function validateElements(elements: readonly Element[]): void {
  if (elements.length < 1 || elements.length > 3 || new Set(elements).size !== elements.length || elements.some(e => !ELEMENTS.includes(e))) {
    throw new Error('A mage must choose 1–3 distinct, valid elements.');
  }
}

/** The rare outcome replaces the normal gain, rather than adding to it. */
export function rollMana(elements: readonly Element[], surgeRoll: number, colorRoll: number): { mana: Mana; surge: boolean } {
  validateElements(elements);
  if (![surgeRoll, colorRoll].every(n => Number.isFinite(n) && n >= 0 && n < 1)) throw new Error('Mana rolls must be in [0, 1).');
  const mana = emptyMana();
  const surge = surgeRoll < SURGE_CHANCE[elements.length];
  if (surge) {
    if (elements.length === 1) mana[elements[0]] = 2;
    else for (const element of elements) mana[element] = 1;
  } else mana[elements[Math.floor(colorRoll * elements.length)]] = 1;
  return { mana, surge };
}

export function manaRule(elements: readonly Element[]): string {
  if (elements.length === 1) return 'Gain 1 mana of your element each turn. 7% chance to gain 2 instead.';
  if (elements.length === 2) return 'Gain 1 mana of either element, 50/50. 5% chance to gain 1 of both instead.';
  return 'Gain 1 mana of a random element, equally likely. 2% chance to gain 1 of all three instead.';
}

/** State-based Mulberry32: every turn's rolls are reproducible from game state. */
export function nextRandom(state: number): { state: number; value: number } {
  const next = (state + 0x6D2B79F5) >>> 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return { state: next, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}
