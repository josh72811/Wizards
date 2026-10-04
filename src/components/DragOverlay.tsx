import { useId } from 'react';
import { createPortal } from 'react-dom';
import { definition } from '../game/engine';
import type { DragVisual } from '../interaction/useSpellDrag';
import Card from './Card';

export default function DragOverlay({ drag }: { drag: DragVisual }) {
  const marker = `arrow-${useId().replace(/:/g, '')}`;
  const card = definition(drag.card);
  const targeting = drag.outside && card.target === 'opponent';
  const valid = drag.canDrop && !drag.error;
  const message = drag.error ?? (!drag.outside ? 'Drag beyond the hand zone to cast · Esc to cancel' : targeting ? (valid ? 'Release to cast at this enemy' : 'Aim at an enemy · release to cast') : 'Release to cast · return to hand to cancel');
  const ghost = targeting ? drag.origin : drag.point;
  const bend = Math.max(60, Math.abs(drag.origin.y - drag.point.y) * .45);
  const path = `M ${drag.origin.x} ${drag.origin.y} C ${drag.origin.x} ${drag.origin.y - bend}, ${drag.point.x} ${drag.point.y + bend}, ${drag.point.x} ${drag.point.y}`;
  return createPortal(<div className={`spell-drag-overlay ${card.element} ${valid ? 'valid-drop' : ''} ${drag.error ? 'invalid-drag' : ''}`} aria-hidden="true">
    <div className="hand-safe-zone" style={{ left: drag.safeZone.left, top: drag.safeZone.top, width: drag.safeZone.right - drag.safeZone.left, height: drag.safeZone.bottom - drag.safeZone.top }}><span>HAND ZONE · RELEASE HERE TO CANCEL</span></div>
    {targeting && <svg className="targeting-arrow"><defs><marker id={marker} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M 0 0 L 7 3.5 L 0 7 L 2 3.5 Z" fill="currentColor"/></marker></defs><path className="arrow-glow" d={path}/><path className="arrow-path" d={path} markerEnd={`url(#${marker})`}/><circle cx={drag.point.x} cy={drag.point.y} r={valid ? 22 : 12} className="target-reticle"/><circle cx={drag.point.x} cy={drag.point.y} r="3" fill="currentColor"/></svg>}
    <div className={`drag-card-ghost ${targeting ? 'aiming' : ''}`} style={{ left: ghost.x, top: ghost.y }}><Card card={card}/></div>
    <div className="drag-instruction">{card.name}<span>{message}</span></div>
  </div>, document.body);
}
