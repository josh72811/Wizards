import type { CardDefinition } from '../game/types';

export interface Point { x: number; y: number }
export interface Bounds { left: number; right: number; top: number; bottom: number }
export interface DropTarget { id: string; bounds: Bounds }
export const HAND_SAFE_MARGIN = 24;
export const DRAG_THRESHOLD = 7;

export const contains = (bounds: Bounds, point: Point) => point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
export function safeHandBounds(bounds: Bounds): Bounds {
  return { left: bounds.left - HAND_SAFE_MARGIN, right: bounds.right + HAND_SAFE_MARGIN, top: bounds.top - HAND_SAFE_MARGIN, bottom: bounds.bottom + HAND_SAFE_MARGIN };
}

/** Re-entering the hand always cancels a drop, even after the card left it. */
export function dropIntent(card: CardDefinition, point: Point, hand: Bounds, targets: DropTarget[]): { outside: boolean; targetId?: string; canDrop: boolean } {
  if (contains(safeHandBounds(hand), point)) return { outside: false, canDrop: false };
  if (card.target !== 'opponent') return { outside: true, canDrop: true };
  const target = targets.find(t => contains(t.bounds, point));
  return { outside: true, targetId: target?.id, canDrop: !!target };
}
