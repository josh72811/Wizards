import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, RefObject } from 'react';
import { definition, getPlayer, validateAction } from '../game/engine';
import type { Action, CardInstance, GameState } from '../game/types';
import { DRAG_THRESHOLD, dropIntent, safeHandBounds } from './drag';
import type { Bounds, Point } from './drag';

export type GestureHandlers = Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onLostPointerCapture' | 'onClickCapture' | 'onDragStart'>;
export interface DragVisual {
  card: CardInstance;
  point: Point;
  origin: Point;
  safeZone: Bounds;
  outside: boolean;
  targetId?: string;
  canDrop: boolean;
  error: string | null;
}
interface Options {
  game: GameState;
  playerId: string;
  handRef: RefObject<HTMLElement | null>;
  boardRef: RefObject<HTMLElement | null>;
  blocked: boolean;
  onCast: (action: Action) => void;
  onSelect: (uid: string) => void;
  onError: (message: string) => void;
}
interface Session { card: CardInstance; pointerId: number; start: Point; point: Point; source: HTMLButtonElement; active: boolean }

export function useSpellDrag(options: Options) {
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const session = useRef<Session | null>(null);
  const suppressClick = useRef<string | null>(null);
  const [drag, setDrag] = useState<DragVisual | null>(null);

  const measure = useCallback((current: Session, point: Point): DragVisual | null => {
    const { game, playerId, handRef, boardRef, blocked } = latest.current;
    if (blocked || !handRef.current) return null;
    const def = definition(current.card);
    const targets = Array.from(boardRef.current?.querySelectorAll<HTMLElement>('[data-spell-target]') ?? [])
      .filter(node => game.players.some(p => p.id === node.dataset.spellTarget && p.id !== playerId && p.health > 0))
      .map(node => ({ id: node.dataset.spellTarget!, bounds: node.getBoundingClientRect() }));
    const hand = handRef.current.getBoundingClientRect();
    const intent = dropIntent(def, point, hand, targets);
    const source = current.source.getBoundingClientRect();
    const action: Action = { type: 'cast', playerId, cardUid: current.card.uid, targetId: intent.targetId ?? targets[0]?.id };
    return { card: current.card, point, origin: { x: source.left + source.width / 2, y: hand.top - 40 }, safeZone: safeHandBounds(hand), ...intent, error: validateAction(game, action) };
  }, []);

  const clear = useCallback(() => {
    const current = session.current;
    session.current = null;
    if (current?.active) suppressClick.current = current.card.uid;
    if (current?.source.hasPointerCapture?.(current.pointerId)) current.source.releasePointerCapture(current.pointerId);
    setDrag(null);
  }, []);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && session.current) { event.preventDefault(); clear(); } };
    const hidden = () => { if (document.hidden) clear(); };
    window.addEventListener('keydown', escape);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('keydown', escape); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', hidden); };
  }, [clear]);
  useEffect(() => {
    if (options.blocked || options.game.ended || !getPlayer(options.game, options.playerId).hand.some(c => c.uid === session.current?.card.uid)) clear();
  }, [options.blocked, options.game, options.playerId, clear]);
  useEffect(() => {
    if (!drag) return;
    const refresh = () => { const current = session.current; if (current?.active) setDrag(measure(current, current.point)); };
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    let frame: number;
    let lastTime = 0;
    const autoScroll = (time: number) => {
      const current = session.current;
      if (!current?.active) return;
      const y = current.point.y;
      const speed = y < 65 ? -Math.min(12, (65 - y) / 5) : y > window.innerHeight - 65 ? Math.min(12, (y - window.innerHeight + 65) / 5) : 0;
      if (speed && time - lastTime > 15) { window.scrollBy(0, speed); lastTime = time; }
      frame = requestAnimationFrame(autoScroll);
    };
    frame = requestAnimationFrame(autoScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', refresh, true); window.removeEventListener('resize', refresh); };
  }, [!!drag, measure]);

  function handlers(card: CardInstance): GestureHandlers {
    return {
      onDragStart: event => event.preventDefault(),
      onPointerDown: event => {
        if (event.button !== 0 || !event.isPrimary || latest.current.blocked || session.current) return;
        suppressClick.current = null;
        const point = { x: event.clientX, y: event.clientY };
        session.current = { card, pointerId: event.pointerId, start: point, point, source: event.currentTarget, active: false };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove: event => {
        const current = session.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const point = { x: event.clientX, y: event.clientY };
        current.point = point;
        if (!current.active) {
          const dx = point.x - current.start.x, dy = point.y - current.start.y;
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD || (event.pointerType === 'touch' && Math.abs(dx) > Math.abs(dy))) return;
          current.active = true;
          latest.current.onSelect(card.uid);
        }
        event.preventDefault();
        setDrag(measure(current, point));
      },
      onPointerUp: event => {
        const current = session.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const visual = current.active ? measure(current, { x: event.clientX, y: event.clientY }) : null;
        if (current.active) event.preventDefault();
        clear();
        if (event.clientX < 0 || event.clientY < 0 || event.clientX > window.innerWidth || event.clientY > window.innerHeight) return;
        if (!visual?.outside) return;
        if (visual.error) { latest.current.onError(visual.error); return; }
        if (!visual.canDrop) { latest.current.onError('Spell returned to hand. Release the targeting arrow over a living enemy.'); return; }
        latest.current.onCast({ type: 'cast', playerId: latest.current.playerId, cardUid: current.card.uid, targetId: visual.targetId });
      },
      onPointerCancel: event => { if (session.current?.pointerId === event.pointerId) clear(); },
      onLostPointerCapture: event => { if (session.current?.pointerId === event.pointerId) clear(); },
      onClickCapture: event => {
        if (suppressClick.current === card.uid && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = null; }
      },
    };
  }
  return { drag, handlers, cancel: clear };
}
