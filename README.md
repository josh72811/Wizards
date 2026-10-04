# Wizards — The Arcane Duel

A playable local card game built with TypeScript, React, and Three.js. Duel Vesper, an elemental wizard bot, using seven spells and a fully interactive response stack. The arena uses real-time Three.js geometry; cards use original inline vector artwork.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. On Windows with PowerShell script execution disabled, use `npm.cmd` in place of `npm`.

```sh
npm test
npm run build
```

## Play

- Drag a card beyond the outlined safe zone near your hand. For opponent-targeted spells (Fireball, Mage Bolt, Mind Spike), aim the targeting arrow at an enemy panel and release. Self-targeted spells (Foresight, Water Barrier, Fan the Flames) and Counterspell cast when released outside the hand zone.
- Release inside the hand zone, on an invalid target, or press **Escape** to cancel. Mana is spent only on a valid release. Priority, timing, mana, and living-target rules are rechecked at release. On touch screens, drag vertically to cast and swipe horizontally to scroll your hand. Holding the drag near the screen edge scrolls the page to reach distant targets.
- You can also select a card to inspect it, then choose **Cast spell**. Disabled casting explains why in the hand hint. The button remains available for keyboard casting.
- Regular spells need your turn and an empty stack. Responses require a spell on the stack and your priority.
- After a cast, the caster automatically passes and priority rotates clockwise. All other living players must then pass consecutively to resolve the newest spell. A response starts a new pass cycle, with its caster automatically passing. Priority returns to the active wizard after each resolution; the remaining stack gets another response window.
- **Pass** allows the newest spell to resolve once everyone passes. **End turn** is available only on your turn with an empty stack.
- Counterspell targets the last cast spell at casting time. It can counter any spell, including another Counterspell. Countered spells have no effects; their mana remains spent.
- Heat persists. Fireball gains 1 Heat, then evaluates its damage using the updated Heat. Fan the Flames gains 2 Heat.
- Barrier persists and absorbs the next 3 total blockable damage across hits. Multiple barriers add together. Mind Spike bypasses Barrier and does not consume it.
- Foresight costs 3 mana of any color and draws 2 cards. Cast it normally on your turn with an empty stack, or as a response to a pending spell. Mage Bolt deals 2 damage.

### Prototype defaults

Each wizard chooses 1–3 distinct elements before a duel and starts at 24 health with an empty mana bank. At the beginning of each wizard's own turn, that wizard gains mana according to their attunement. Unspent mana carries over without a cap; spent mana is not refilled.

| Elements | Normal gain | Rare gain (replaces normal gain) |
| --- | --- | --- |
| 1 | 1 mana of that element | 7% chance: 2 mana of that element |
| 2 | 1 mana of either element, 50/50 | 5% chance: 1 mana of both elements |
| 3 | 1 mana of a random element, equally likely | 2% chance: 1 mana of all three elements |

The first player receives their opening turn's mana immediately and skips the opening draw. Other wizards gain their first mana when their first turn starts. The chronicle records every gain and rare surge. New-duel setup lets you configure both your mage and Vesper.

Training decks contain 30 cards drawn only from spells whose colored costs match the selected elements, plus any-color spells. Each mage starts with 7 cards and a shuffled 23-card library. The opening hand cycles through available spells (one of every spell for a three-element mage). Generic costs use the most plentiful remaining color, with ties paid in Fire / Water / Psychic order. Hands hold 10 cards; excess draws go to discard. Drawing from an empty library deals increasing unblockable fatigue damage.

## Architecture

```
src/game/types.ts      Serializable state, commands, value expressions, effect union
src/game/cards.ts      Card definitions composed from reusable effect primitives
src/game/engine.ts     Pure validation and state transitions, effect interpreter
src/game/bot.ts        Bot using its own hand and public game state
src/game/mana.ts       Attunement validation, probability rules, serializable PRNG
src/game/mana.test.ts  Exact probability boundaries, carryover, and replay tests
src/game/engine.test.ts Rules, response chains, multiplayer, and complete-game tests
src/components/       Three.js arena, spell artwork, and card UI
src/App.tsx           Duel UI, bot pacing, inspect/stack/history panels
```

The engine never imports React or Three.js. `reduceGame(state, command)` validates an action and returns a new state; illegal actions return the original state. `validateAction` returns a human-readable error. State, cards, effects, and commands are plain data, enabling replay, persistence, or a future authoritative server.

### Add a card

Add a `CardDefinition` to `CARDS` in `src/game/cards.ts`. The deck, opening hand, and Grimoire use the registry. Combine effects instead of adding card-name checks to the engine:

```ts
effect: fx.sequence(
  fx.heat(2),
  fx.damage({ add: [1, { stat: 'heat', of: 'caster' }] }),
)
```

The interpreter supports sequences, dynamic stat reads, sums, conditional effects, Heat, blockable/unblockable damage, shields, drawing, healing, mana gain, and countering. To introduce a new primitive, add a typed variant to `Effect`, implement it in `applyEffect`, and test its behavior. The bot's heuristic priorities and artwork can be extended separately.

### Four-player extension

`createGame(seed, seats)` accepts 2–4 players. Seats can provide `elements`, for example `{ name: 'Pyromancer', bot: false, elements: ['fire'] }`; omitted elements default to all three. Invalid, empty, or duplicate element choices are rejected. Active turns, targeting, passes, priority rotation, eliminations, and victory already operate on the player list. Random state is serialized in `GameState`, so shuffles and mana gains replay deterministically. The test suite includes four-player response rotation, eliminated-player handling, and an entire four-bot game. The current UI intentionally presents two seats. To expose four players, add opponent selection and render each seat; for online play, run the same engine on an authoritative server and expose only each viewer's hand. There is no network multiplayer or save system in this prototype.
