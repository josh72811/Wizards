import { Flame, Droplet, Eye, Sparkles, Zap } from 'lucide-react';
import type { CardDefinition } from '../game/types';
import SpellArt from './SpellArt';
import { timingLabel } from '../game/cards';
import type { GestureHandlers } from '../interaction/useSpellDrag';

export const ELEMENT_ICONS = { fire: Flame, water: Droplet, psychic: Eye, arcane: Sparkles };
export function ManaCost({ card }: { card: CardDefinition }) {
  const Icon = ELEMENT_ICONS[card.element];
  const cost = card.cost.any ?? card.cost.fire ?? card.cost.water ?? card.cost.psychic ?? 0;
  return <span className={`mana-cost ${card.element}`} title={`${cost} ${card.cost.any ? 'mana of any color' : card.element + ' mana'}`}>{cost}<Icon size={12}/></span>;
}

export default function Card({ card, selected = false, disabled = false, onClick, compact = false, gestures, dragging = false }: { card: CardDefinition; selected?: boolean; disabled?: boolean; onClick?: () => void; compact?: boolean; gestures?: GestureHandlers; dragging?: boolean }) {
  const Icon = ELEMENT_ICONS[card.element];
  return <button {...gestures} draggable={false} className={`spell-card ${card.element} ${selected ? 'selected' : ''} ${disabled ? 'unavailable' : ''} ${compact ? 'compact' : ''} ${gestures ? 'draggable-card' : ''} ${dragging ? 'dragging-source' : ''}`} onClick={onClick} aria-pressed={selected} aria-label={`Inspect ${card.name}. ${card.text}`}>
    <div className="card-heading"><span>{card.name}</span><ManaCost card={card}/></div>
    <SpellArt spell={card.id}/>
    <div className="card-type"><Icon size={10}/><span>{card.element === 'arcane' ? 'Arcane' : card.element} {timingLabel(card)}</span>{card.speed !== 'spell' && <Zap size={11}/>}</div>
    <div className="card-rules">{card.text}</div>
    <div className="card-bottom"><span>WIZARDS</span><span>✦</span></div>
  </button>;
}
