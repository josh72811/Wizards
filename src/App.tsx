import { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowRight, BookOpen, ChevronRight, CircleHelp, Eye, Flame, Layers3, RotateCcw, Shield, Skull, Sparkles, Swords, X, Zap } from 'lucide-react';
import Arena from './components/Arena';
import Card, { ELEMENT_ICONS, ManaCost } from './components/Card';
import SpellArt from './components/SpellArt';
import MageSetup from './components/MageSetup';
import DragOverlay from './components/DragOverlay';
import { useSpellDrag } from './interaction/useSpellDrag';
import { CARD_LIST, timingLabel } from './game/cards';
import { createGame, definition, getPlayer, reduceGame, STARTING_HEALTH, validateAction } from './game/engine';
import { chooseBotAction } from './game/bot';
import { ELEMENTS } from './game/types';
import { manaRule } from './game/mana';
import type { Action, Element, GameState, Player, Seat } from './game/types';

type UIAction = Action | { type: 'restart'; seats: Seat[] };
function reducer(state: GameState, action: UIAction) { return action.type === 'restart' ? createGame(Date.now(), action.seats) : reduceGame(state, action); }

function PlayerPanel({ player, active, priority, opponent = false, dropState }: { player: Player; active: boolean; priority: boolean; opponent?: boolean; dropState?: 'ready' | 'hover' }) {
  return <div data-spell-target={opponent ? player.id : undefined} className={`player-panel ${opponent ? 'opponent' : 'you'} ${priority ? 'has-priority' : ''} ${dropState ? `drop-target-${dropState}` : ''}`}>
    <div className="wizard-avatar"><span>{opponent ? 'V' : 'A'}</span><Sparkles size={14}/></div>
    <div className="wizard-info"><div className="wizard-name">{opponent ? player.name : 'The Arcanist'} <span className="seat-label">{opponent ? 'BOT' : 'YOU'}</span>{active && <span className="turn-marker">●</span>}</div><div className="wizard-subtitle attunement" title={manaRule(player.elements)}>{player.elements.join(' / ')} mage</div>
      <div className="wizard-stats"><span className="heat-stat" title="Heat persists across turns and strengthens Fireball"><Flame size={13}/>{player.heat} Heat</span><span className="shield-stat" title="Barrier absorbs incoming damage until depleted"><Shield size={13}/>{player.shield} Barrier</span><span className="library-stat"><Layers3 size={12}/>{player.deck.length} in library</span></div>
    </div>
    <div className="mana-bank"><div className="mana-pool">{ELEMENTS.map(element => { const Icon = ELEMENT_ICONS[element]; return <div className={`mana-column ${element} ${!player.elements.includes(element) && !player.mana[element] ? 'unattuned' : ''}`} key={element} title={`${player.mana[element]} ${element} mana banked${player.elements.includes(element) ? '' : ' · not attuned'}`}><span><Icon size={15}/><b>{player.mana[element]}</b></span><small className="mana-element-label">{element}</small></div>; })}</div><div className={`mana-gain-note ${player.lastManaSurge ? 'surge' : ''}`} title="Mana gained at the start of this mage’s most recent turn. Unspent mana carries over.">{player.turns ? <>{player.lastManaSurge ? '✦ Surge' : 'Last gain'}: {ELEMENTS.filter(e => player.lastManaGain[e]).map(e => `+${player.lastManaGain[e]} ${e}`).join(' · ')}</> : 'Gain mana on your first turn'}</div></div>
    <div className="health-block"><div><b>{player.health}</b><span>/{STARTING_HEALTH}</span></div><small>HEALTH</small><div className="health-track"><i style={{ width: `${player.health / STARTING_HEALTH * 100}%` }}/></div></div>
  </div>;
}

export default function App() {
  const [game, dispatch] = useReducer(reducer, undefined, () => createGame());
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [modal, setModal] = useState<'rules' | 'grimoire' | 'restart' | 'setup' | null>('setup');
  const [mageElements, setMageElements] = useState<{ you: Element[]; bot: Element[] }>({ you: [...ELEMENTS], bot: [...ELEMENTS] });
  const [tab, setTab] = useState<'chronicle' | 'discard'>('chronicle');
  const [error, setError] = useState('');
  const [compactLog, setCompactLog] = useState(false);
  const handRef = useRef<HTMLElement>(null);
  const boardRef = useRef<HTMLElement>(null);
  const me = game.players[0];
  const enemy = game.players[1];
  const myPriority = game.priorityPlayerId === me.id && !game.ended;
  const myTurn = game.activePlayerId === me.id;
  const pending = game.stack.at(-1);
  const selected = me.hand.find(c => c.uid === selectedUid);
  const selectedDef = selected ? definition(selected) : null;
  const castAction: Action | null = selected ? { type: 'cast', playerId: me.id, cardUid: selected.uid, targetId: enemy.id } : null;
  const castError = castAction ? validateAction(game, castAction) : 'Select a card from your hand.';
  const status = game.ended ? (game.winnerId === me.id ? 'Victory is yours' : game.winnerId ? 'A worthy adversary' : 'A duel of equals') : myPriority ? (pending ? 'Your response' : 'Your turn') : 'Vesper is thinking';
  const { drag, handlers } = useSpellDrag({ game, playerId: me.id, handRef, boardRef, blocked: !!modal, onCast: act, onSelect: uid => { setSelectedUid(uid); setError(''); }, onError: setError });
  const aiming = drag?.outside && definition(drag.card).target === 'opponent' && !drag.error;
  useEffect(() => {
    if (modal) return;
    const action = chooseBotAction(game);
    if (!action) return;
    const timer = window.setTimeout(() => dispatch(action), 850);
    return () => window.clearTimeout(timer);
  }, [game, modal]);
  useEffect(() => {
    if (selectedUid && !me.hand.some(c => c.uid === selectedUid)) setSelectedUid(null);
  }, [me.hand, selectedUid]);
  useEffect(() => {
    if (!modal) return;
    const focused = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const items = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button, [tabindex="0"]') ?? []);
    items()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
      if (event.key === 'Tab') {
        const buttons = items();
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); focused?.focus(); };
  }, [modal]);
  function act(action: Action) {
    const reason = validateAction(game, action);
    if (reason) { setError(reason); return; }
    setError('');
    dispatch(action);
  }
  function openSetup() { setMageElements({ you: [...me.elements], bot: [...enemy.elements] }); setModal('restart'); }
  function restart() { dispatch({ type: 'restart', seats: [{ name: 'You', bot: false, elements: mageElements.you }, { name: 'Vesper', bot: true, elements: mageElements.bot }] }); setSelectedUid(null); setError(''); setModal(null); }

  return <div className="app-shell">
    <header className="topbar">
      <a href="./" className="brand" aria-label="Wizards home"><span className="brand-mark"><Sparkles size={24}/></span><span>WIZARDS<small>THE ARCANE DUEL</small></span></a>
      <div className="session-label"><span className="live-dot"/> TRAINING GROUNDS <span className="slash">/</span> <span>SOLO DUEL</span></div>
      <nav><button className="nav-button" onClick={() => setModal('grimoire')}><BookOpen size={16}/><span>Grimoire</span></button><button className="nav-button" onClick={() => setModal('rules')}><CircleHelp size={16}/><span>How to play</span></button><button className="icon-button" title="New duel · choose elements" aria-label="Start a new duel and choose elements" onClick={openSetup}><RotateCcw size={17}/></button></nav>
    </header>
    <div className="game-layout">
      <main ref={boardRef} className="duel-main">
        <div className="duel-heading"><div><span className="eyebrow">THE ELEMENTS AWAIT</span><h1>An arcane encounter</h1></div><div className="round-pill"><span>TURN</span><b>{String(game.turn).padStart(2, '0')}</b><i/>{myTurn ? 'Your turn' : "Vesper’s turn"}</div></div>
        <PlayerPanel player={enemy} active={!myTurn} priority={!myPriority && !game.ended} opponent dropState={aiming ? (drag.targetId === enemy.id ? 'hover' : 'ready') : undefined}/>
        <section className={`battlefield ${pending ? 'spell-pending' : ''}`} aria-label="Spell arena">
          <div className="board-corner top-left"/><div className="board-corner bottom-right"/>
          <div className="board-topline"><span><Swords size={12}/> DUEL ARENA</span><span>FIRST TO FALL · 24 HEALTH</span></div>
          <div className="enemy-hand" aria-label={`Vesper has ${enemy.hand.length} cards in hand`}>{Array.from({ length: Math.min(enemy.hand.length, 10) }, (_, i) => <div className="card-back" key={i} style={{ transform: `rotate(${(i-(Math.min(enemy.hand.length,10)-1)/2)*5}deg) translateY(${Math.abs(i-(Math.min(enemy.hand.length,10)-1)/2)*3}px)` }}><Sparkles size={17}/></div>)}<span>{enemy.hand.length} cards in hand</span></div>
          <Arena element={pending ? definition(pending.card).element : 'psychic'} active={!!pending}/>
          {pending ? <div className="pending-spell"><div className="pending-label"><Zap size={12}/> ON THE STACK · {game.stack.length}</div><div className="pending-art"><SpellArt spell={pending.card.definitionId}/></div><h2>{definition(pending.card).name}</h2><p>{getPlayer(game, pending.casterId).name} casts {definition(pending.card).target === 'opponent' ? `→ ${getPlayer(game, pending.targetId).name}` : 'a spell'}</p></div> : <div className="arena-idle"><span className="arena-diamond">◇</span><span>THE AETHER IS STILL</span><p>{game.ended ? 'The elements have spoken.' : 'A single spell can change everything.'}</p></div>}
          <div className="arena-footer"><span className="arena-rule"/><span>✦</span><span className="arena-rule"/></div>
        </section>
        <PlayerPanel player={me} active={myTurn} priority={myPriority}/>
        <section className={`decision-bar ${myPriority ? 'your-priority' : ''}`} aria-label="Turn controls">
          <div className="decision-status"><span className={`priority-light ${myPriority ? 'ready' : ''}`}/><div><strong role="status">{status}</strong><p>{game.ended ? (game.winnerId === me.id ? 'Your mastery of the elements prevailed.' : 'Study the chronicle, then try another duel.') : myPriority ? (pending ? 'Cast a response, or pass to let the spell resolve.' : 'Select a spell from your hand to cast it.') : 'You’ll get a chance to respond to every spell.'}</p></div></div>
          {game.ended ? <button className="primary-button" onClick={openSetup}><RotateCcw size={15}/>Play again</button> : <button className="primary-button" disabled={!myPriority} onClick={() => act(pending ? { type: 'pass', playerId: me.id } : { type: 'endTurn', playerId: me.id })}>{pending ? 'Pass' : 'End turn'}<ArrowRight size={16}/></button>}
        </section>
        <section ref={handRef} className={`hand-section ${drag ? 'drag-active' : ''}`} aria-label="Your hand">
          <div className="hand-toolbar"><h2>YOUR HAND <span>{me.hand.length}/10</span></h2><div className="cast-toolbar">{selectedDef && <span className="selected-title">{selectedDef.name}<ChevronRight size={13}/></span>}<button className="cast-button" disabled={!!castError} title={castError ?? 'Cast selected spell'} onClick={() => castAction && act(castAction)}><Sparkles size={14}/>{selectedDef && selectedDef.speed !== 'spell' && pending ? 'Cast response' : 'Cast spell'}</button></div></div>
          <div className="hand-cards">{me.hand.map(card => { const reason = validateAction(game, { type: 'cast', playerId: me.id, cardUid: card.uid, targetId: enemy.id }); return <Card key={card.uid} card={definition(card)} selected={card.uid === selectedUid} disabled={!!reason} gestures={handlers(card)} dragging={drag?.card.uid === card.uid} onClick={() => { setSelectedUid(card.uid); setError(''); }}/>; })}{!me.hand.length && <div className="empty-hand">Your hand is empty. End your turn to draw a card.</div>}</div>
          <div className="hand-hint" role="status">{error || (selectedDef ? (castError || `${selectedDef.name} is ready. ${selectedDef.target === 'opponent' ? 'Drag out of the hand and release the arrow over an enemy.' : 'Drag and release outside the hand zone to cast.'}`) : <><Eye size={12}/> Drag a spell to cast, or click to inspect. Return to hand to cancel.</>)}</div>
        </section>
      </main>
      <aside className="duel-sidebar">
        <section className="stack-section"><div className="section-heading"><h2><Layers3 size={15}/>SPELL STACK</h2><span className="count-badge">{game.stack.length}</span></div><p className="section-note">Last cast, first resolved.</p>
          {game.stack.length ? <div className="stack-list">{[...game.stack].reverse().map((entry, i) => <div className={`stack-item ${definition(entry.card).element}`} key={entry.id}><div className="stack-index">{i === 0 ? <Zap size={13}/> : game.stack.length-i}</div><div><strong>{definition(entry.card).name}</strong><small>{getPlayer(game, entry.casterId).name}{i === 0 ? ' · resolves next' : ' · waiting'}</small></div><ManaCost card={definition(entry.card)}/></div>)}</div> : <div className="empty-stack"><span className="stack-empty-icon"><Layers3 size={26}/></span><strong>No spells pending</strong><span>The next spell starts a new chain.</span></div>}
        </section>
        <section className="inspect-section">{selectedDef ? <><div className="section-heading"><h2><Eye size={14}/>SPELL DETAILS</h2><button className="tiny-button" aria-label="Clear selected card" onClick={() => setSelectedUid(null)}><X size={14}/></button></div><div className={`inspect-art ${selectedDef.element}`}><SpellArt spell={selectedDef.id}/></div><div className="inspect-heading"><h3>{selectedDef.name}</h3><ManaCost card={selectedDef}/></div><div className={`inspect-type ${selectedDef.element}`}>{selectedDef.speed !== 'spell' && <Zap size={11}/>} {selectedDef.element} {timingLabel(selectedDef)}</div><p className="inspect-rules">{selectedDef.text}</p><p className="flavor">“{selectedDef.flavor}”</p></> : <><div className="section-heading"><h2><Sparkles size={14}/>A WIZARD’S WISDOM</h2></div><div className="wisdom-symbol">✧</div><h3>Power is in the timing.</h3><p className="wisdom-text">Heat fuels your Fireballs. Water protects your life. Psychic magic bends the rules.</p><button className="text-button" onClick={() => setModal('rules')}>Learn the duel<ArrowRight size={13}/></button></>}</section>
        <section className="chronicle-section"><div className="chronicle-tabs"><button className={tab === 'chronicle' ? 'active' : ''} onClick={() => setTab('chronicle')}>Chronicle</button><button className={tab === 'discard' ? 'active' : ''} onClick={() => setTab('discard')}>Discard <span>{me.discard.length+enemy.discard.length}</span></button>{tab === 'chronicle' && <button className="tiny-button" title={compactLog ? 'Show all events' : 'Show spell events only'} aria-label="Toggle detailed chronicle" onClick={() => setCompactLog(v => !v)}><Eye size={13}/></button>}</div>
          <div className="chronicle-feed" aria-label={tab === 'chronicle' ? 'Game history' : 'Discarded cards'}>{tab === 'chronicle' ? [...game.log].reverse().filter(e => !compactLog || e.kind !== 'effect').map(entry => <div className={`log-entry ${entry.kind}`} key={entry.id}><span className="log-dot"/><p>{entry.text}</p></div>) : game.players.flatMap(p => p.discard.map(c => ({ p, c }))).reverse().map(({ p, c }) => <div className="discard-item" key={c.uid}><Skull size={12}/><span>{definition(c).name}<small>{p.name}</small></span></div>)}{tab === 'discard' && !me.discard.length && !enemy.discard.length && <p className="empty-message">Resolved and countered spells will appear here.</p>}</div>
        </section>
        <div className="sidebar-foot"><span className="live-dot"/> LOCAL DUEL <span>01 / 02 PLAYERS</span></div>
      </aside>
    </div>
    <footer className="app-footer"><span>WIZARDS <i>✦</i> A game of elemental mastery</span><span>Fire. Water. Mind.</span></footer>
    {drag && <DragOverlay drag={drag}/>}
    {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><section className={`modal ${modal === 'grimoire' ? 'grimoire-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}><button className="modal-close icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><X size={20}/></button><span className="eyebrow">THE ARCANIST’S COMPANION</span><h2 id="modal-title">{modal === 'rules' ? 'Master the elements.' : modal === 'grimoire' ? 'The Grimoire' : modal === 'setup' ? 'Choose your elements.' : 'Begin a new duel?'}</h2>
      {modal === 'rules' ? <><p className="modal-intro">A duel of spells, strategy, and perfectly timed responses. Reduce Vesper from 24 health to 0 to win.</p><div className="rules-grid"><div><b>01</b><h3>Shape your turn</h3><p>Choose 1 to 3 elements for each mage. Both start with 7 matching cards and an empty mana bank. Your first turn grants mana immediately. Select a card, then cast. Regular spells can only be cast on your turn with an empty stack. Foresight can also be cast as a response.</p></div><div><b>02</b><h3>Respond to the unexpected</h3><p>Casting automatically passes to the other wizard. Cast a response or choose Pass. If the other wizard passes, the newest spell resolves. Each remaining spell gets another response window.</p></div><div><b>03</b><h3>Build your power</h3><p>Heat and Barrier persist between turns. Fireball increases Heat before dealing damage. Barrier absorbs the next damage across multiple hits. Mind Spike bypasses Barrier without consuming it.</p></div><div><b>04</b><h3>Keep something in reserve</h3><p>Gain mana at the start of your turn and keep all unspent mana. A one-element mage gains 1, with a 7% chance for 2 instead. A two-element mage gains 1 of either color (50/50), with a 5% chance for 1 of both. A three-element mage gains 1 of a random color (equal odds), with a 2% chance for 1 of each. You also draw one card. Any-color costs spend the most plentiful mana first. A full hand holds 10 cards; excess draws are discarded. An empty library causes increasing, unblockable fatigue damage.</p></div></div><p className="rules-footnote">Responses require a pending spell. Counterspell targets the spell immediately below it, including another response. Training decks include only spells your chosen elements can pay for, plus any-color spells. Rare mana gains replace the normal gain; there is no mana cap.</p><button className="primary-button" onClick={() => setModal(null)}>Enter the arena<ArrowRight size={16}/></button></> : modal === 'grimoire' ? <><p className="modal-intro">Seven spells. Three elements. Countless possibilities.</p><div className="grimoire-grid">{CARD_LIST.map(card => <div key={card.id}><Card card={card} onClick={() => { const found = me.hand.find(c => c.definitionId === card.id); if (found) { setSelectedUid(found.uid); setModal(null); } }}/><p>{card.flavor}</p></div>)}</div></>  : <><p className="modal-intro">{modal === 'restart' ? 'Start a fresh duel with new attunements. Your current duel will be reset.' : 'Attune each mage to one, two, or three elements. Fewer elements give you more consistent mana.'} Unspent mana carries over, and rare surges replace the normal gain.</p><MageSetup name="Your mage" elements={mageElements.you} onChange={you => setMageElements(current => ({ ...current, you }))}/><MageSetup name="Vesper - Bot" elements={mageElements.bot} onChange={bot => setMageElements(current => ({ ...current, bot }))}/><p className="rules-footnote">Each mage starts with an empty mana bank and gains mana on their first turn. Training decks match the selected elements and include any-color spells.</p><div className="restart-actions"><button className="nav-button" onClick={() => setModal(null)}>{modal === 'restart' ? 'Keep playing' : 'Use default mage'}</button><button className="primary-button" onClick={restart}>Begin duel<ArrowRight size={15}/></button></div></>}

    </section></div>}
  </div>;
}
