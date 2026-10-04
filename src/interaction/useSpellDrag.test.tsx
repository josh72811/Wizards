// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Card from '../components/Card';
import DragOverlay from '../components/DragOverlay';
import { createGame, definition, reduceGame } from '../game/engine';
import type { Action, GameState } from '../game/types';
import { useSpellDrag } from './useSpellDrag';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
let game: GameState;
const onCast = vi.fn<(action: Action) => void>();
const onSelect = vi.fn();
const onInspect = vi.fn();
const onError = vi.fn();

function Harness({ state, blocked = false }: { state: GameState; blocked?: boolean }) {
  const handRef = useRef<HTMLElement>(null);
  const boardRef = useRef<HTMLElement>(null);
  const { drag, handlers } = useSpellDrag({ game: state, playerId: 'p0', handRef, boardRef, blocked, onCast, onSelect, onError });
  return <main ref={boardRef}>
    <div data-spell-target="p1" data-test-rect="enemy">Enemy</div>
    <section ref={handRef} data-test-rect="hand">{state.players[0].hand.map(card => <Card key={card.uid} card={definition(card)} gestures={handlers(card)} onClick={onInspect}/>)}</section>
    <output>{drag ? `${drag.outside}:${drag.targetId ?? '-'}:${drag.error ?? ''}` : ''}</output>
    {drag && <DragOverlay drag={drag}/>}
  </main>;
}
function render(state = game, blocked = false) { act(() => root.render(<Harness state={state} blocked={blocked}/>)); }
function source(name = 'Fireball') { return host.querySelector<HTMLButtonElement>(`section button[aria-label^="Inspect ${name}."]`)!; }
function pointer(button: HTMLButtonElement, type: string, x: number, y: number, id = 1) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperties(event, { pointerId: { value: id }, isPrimary: { value: true }, pointerType: { value: 'mouse' } });
  act(() => { button.dispatchEvent(event); });
}
function start(button = source()) { pointer(button, 'pointerdown', 190, 580); return button; }

beforeEach(() => {
  vi.clearAllMocks();
  game = createGame(42);
  for (const player of game.players) player.mana = { fire: 9, water: 9, psychic: 9 };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const type = this.dataset.testRect;
    const r = type === 'hand' ? { x: 80, y: 500, width: 520, height: 250 } : type === 'enemy' ? { x: 100, y: 50, width: 500, height: 100 } : { x: 120, y: 530, width: 140, height: 205 };
    return { ...r, left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height, toJSON: () => r };
  });
  render();
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });

describe('actual pointer gestures and casting', () => {
  it('keeps a click or tiny pointer movement as inspection without casting', () => {
    const button = start();
    pointer(button, 'pointermove', 193, 582);
    pointer(button, 'pointerup', 193, 582);
    act(() => { button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); });
    expect(onInspect).toHaveBeenCalledOnce();
    expect(onCast).not.toHaveBeenCalled();
    expect(document.querySelector('.spell-drag-overlay')).toBeNull();
  });
  it('shows a targeting arrow only after leaving the safe zone, and casts once on enemy release', () => {
    const before = structuredClone(game);
    const button = start();
    pointer(button, 'pointermove', 200, 520);
    expect(document.querySelector('.hand-safe-zone')).not.toBeNull();
    expect(document.querySelector('.targeting-arrow')).toBeNull();
    pointer(button, 'pointermove', 300, 300);
    expect(document.querySelector('.targeting-arrow')).not.toBeNull();
    expect(onCast).not.toHaveBeenCalled();
    expect(game).toEqual(before);
    pointer(button, 'pointermove', 300, 90);
    expect(document.querySelector('.valid-drop')).not.toBeNull();
    pointer(button, 'pointerup', 300, 90);
    const command = { type: 'cast', playerId: 'p0', cardUid: game.players[0].hand[0].uid, targetId: 'p1' };
    expect(onCast).toHaveBeenCalledExactlyOnceWith(command);
    const next = reduceGame(game, command as Action);
    expect(next.players[0].mana.fire).toBe(8);
    expect(next.players[0].hand).toHaveLength(6);
    expect(next.stack[0].targetId).toBe('p1');
    expect(document.querySelector('.spell-drag-overlay')).toBeNull();
    act(() => { button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); });
    expect(onInspect).not.toHaveBeenCalled();
    pointer(button, 'pointerup', 300, 90);
    expect(onCast).toHaveBeenCalledOnce();
  });
  it('returns attacks to hand when released outside the hand without a target', () => {
    const button = start();
    pointer(button, 'pointermove', 300, 300);
    pointer(button, 'pointerup', 300, 300);
    expect(onCast).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('living enemy'));
    expect(game.players[0].mana.fire).toBe(9);
  });
  it('cancels inside the hand margin even after hovering a valid enemy', () => {
    const button = start();
    pointer(button, 'pointermove', 300, 90);
    pointer(button, 'pointermove', 300, 485);
    expect(document.querySelector('.targeting-arrow')).toBeNull();
    pointer(button, 'pointerup', 300, 485);
    expect(onCast).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
  it('casts Foresight outside the hand with no targeting arrow in a response window', () => {
    const bolt = game.players[1].hand.find(c => c.definitionId === 'mageBolt')!;
    game.activePlayerId = 'p1'; game.priorityPlayerId = 'p1';
    game = reduceGame(game, { type: 'cast', playerId: 'p1', cardUid: bolt.uid, targetId: 'p0' });
    render();
    const button = start(source('Foresight'));
    pointer(button, 'pointermove', 300, 300);
    expect(document.querySelector('.targeting-arrow')).toBeNull();
    expect(document.querySelector('.valid-drop')).not.toBeNull();
    pointer(button, 'pointerup', 300, 300);
    expect(onCast).toHaveBeenCalledOnce();
    const next = reduceGame(game, onCast.mock.calls[0][0]);
    expect(next.stack.at(-1)?.card.definitionId).toBe('foresight');
    expect(Object.values(next.players[0].mana).reduce((a, b) => a + b)).toBe(24);
  });
  it('casts Foresight outside the hand normally on its caster’s turn', () => {
    const button = start(source('Foresight'));
    pointer(button, 'pointermove', 300, 300);
    expect(document.querySelector('.targeting-arrow')).toBeNull();
    expect(document.querySelector('.valid-drop')).not.toBeNull();
    pointer(button, 'pointerup', 300, 300);
    expect(onCast).toHaveBeenCalledOnce();
    expect(reduceGame(game, onCast.mock.calls[0][0]).stack.at(-1)?.card.definitionId).toBe('foresight');
  });
  it('rejects a response-only Water Barrier drag without a pending spell', () => {
    const button = start(source('Water Barrier'));
    pointer(button, 'pointermove', 300, 300);
    expect(document.querySelector('.invalid-drag')).not.toBeNull();
    pointer(button, 'pointerup', 300, 300);
    expect(onCast).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Response spells'));
  });
  it('rejects an otherwise valid enemy drop when mana is insufficient', () => {
    game.players[0].mana.fire = 0; render();
    const button = start();
    pointer(button, 'pointermove', 300, 90);
    pointer(button, 'pointerup', 300, 90);
    expect(onCast).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Not enough mana.');
  });
  it('revalidates priority at release even when the drag began legally', () => {
    const button = start();
    pointer(button, 'pointermove', 300, 90);
    const changed = structuredClone(game); changed.priorityPlayerId = 'p1'; render(changed);
    pointer(button, 'pointerup', 300, 90);
    expect(onCast).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Wait for your priority.');
  });
  it.each(['escape', 'pointercancel', 'lostpointercapture', 'blur', 'modal'])('cancels safely on %s', reason => {
    const button = start();
    pointer(button, 'pointermove', 300, 90);
    if (reason === 'escape') act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    else if (reason === 'blur') act(() => { window.dispatchEvent(new Event('blur')); });
    else if (reason === 'modal') render(game, true);
    else pointer(button, reason, 300, 90);
    pointer(button, 'pointerup', 300, 90);
    expect(onCast).not.toHaveBeenCalled();
    expect(document.querySelector('.spell-drag-overlay')).toBeNull();
  });
  it('uses release coordinates rather than a stale hover', () => {
    const button = start();
    pointer(button, 'pointermove', 300, 90);
    pointer(button, 'pointerup', 300, 300);
    expect(onCast).not.toHaveBeenCalled();
  });
  it('does not cast when released beyond the browser viewport', () => {
    const button = start(source('Fan the Flames'));
    pointer(button, 'pointermove', 300, 300);
    pointer(button, 'pointerup', -20, 300);
    expect(onCast).not.toHaveBeenCalled();
  });
});
