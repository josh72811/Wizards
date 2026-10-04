import { definition, getPlayer, livingPlayers, validateAction } from './engine';
import type { Action, GameState } from './types';

/** Uses only its own hand and public state. No access to opposing hand or deck order. */
export function chooseBotAction(s: GameState): Action | null {
  if (s.ended) return null;
  const bot = getPlayer(s, s.priorityPlayerId);
  if (!bot.bot) return null;
  const opponent = livingPlayers(s).filter(p => p.id !== bot.id).sort((a, b) => a.health - b.health)[0];
  const legal = bot.hand.filter(c => !validateAction(s, { type: 'cast', playerId: bot.id, cardUid: c.uid, targetId: opponent.id }));
  const top = s.stack.at(-1);
  let preferred: string[];
  if (top) {
    const incoming = definition(top.card);
    const hostile = top.casterId !== bot.id;
    const damaging = ['fireball', 'mageBolt', 'mindSpike'].includes(incoming.id) && top.targetId === bot.id;
    const damage = incoming.id === 'fireball' ? getPlayer(s, top.casterId).heat + 1 : incoming.id === 'mindSpike' ? 3 : 2;
    preferred = hostile && incoming.id === 'counterspell' ? ['counterspell'] : [];
    if (damaging) {
      if (incoming.id === 'mindSpike' || damage > 3 || bot.health <= damage) preferred.push('counterspell');
      if (incoming.id !== 'mindSpike' && bot.shield < damage) preferred.push('waterBarrier');
    }
    if (bot.hand.length < 5) preferred.push('foresight');
  } else {
    preferred = bot.heat < 5 && bot.hand.some(c => c.definitionId === 'fireball')
      ? ['fanTheFlames', 'fireball', 'mindSpike', 'mageBolt']
      : ['fireball', 'mindSpike', 'mageBolt', 'fanTheFlames'];
    if (bot.hand.length < 5) preferred.push('foresight');
  }
  for (const id of preferred) {
    const card = legal.find(c => c.definitionId === id);
    if (card) return { type: 'cast', playerId: bot.id, cardUid: card.uid, targetId: opponent.id };
  }
  return top ? { type: 'pass', playerId: bot.id } : { type: 'endTurn', playerId: bot.id };
}
