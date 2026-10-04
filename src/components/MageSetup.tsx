import { ELEMENTS } from '../game/types';
import type { Element } from '../game/types';
import { manaRule, SURGE_CHANCE } from '../game/mana';
import { ELEMENT_ICONS } from './Card';

export default function MageSetup({ name, elements, onChange }: { name: string; elements: Element[]; onChange: (elements: Element[]) => void }) {
  const toggle = (element: Element) => onChange(elements.includes(element) ? elements.filter(e => e !== element) : ELEMENTS.filter(e => elements.includes(e) || e === element));
  return <fieldset className="mage-setup"><legend>{name}<span>{elements.length === 1 ? 'Single element' : elements.length === 2 ? 'Two elements' : 'Three elements'}</span></legend>
    <div className="element-choices">{ELEMENTS.map(element => {
      const Icon = ELEMENT_ICONS[element];
      const chosen = elements.includes(element);
      return <button key={element} type="button" className={`element-choice ${element} ${chosen ? 'chosen' : ''}`} aria-pressed={chosen} disabled={chosen && elements.length === 1} onClick={() => toggle(element)} title={chosen && elements.length === 1 ? 'Keep at least one element selected' : `Toggle ${element}`}><Icon size={22}/><strong>{element}</strong><span>{chosen ? 'Attuned' : 'Select'}</span></button>;
    })}</div>
    <div className="mana-rule-preview"><b>{SURGE_CHANCE[elements.length] * 100}% surge chance</b><p>{manaRule(elements)}</p></div>
  </fieldset>;
}
