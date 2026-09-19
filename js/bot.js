// d:\truco\js\bot.js
// Inteligência Artificial dos Bots de Truco Paulista

class TrucoBot {
  constructor(playerIndex, engine) {
    this.playerIndex = playerIndex;
    this.engine = engine;
  }

  // Retorna o poder de cada carta da mão ordenado crescente
  _handPowers(hand) {
    if (!hand || hand.length === 0) return [];
    return hand
      .map(c => ({ card: c, power: TrucoDeck.getCardPower(c, this.engine.vira) }))
      .sort((a, b) => a.power - b.power);
  }

  // Conta manilhas na mão
  _countManilhas(hand) {
    return hand.filter(c => TrucoDeck.getCardPower(c, this.engine.vira) >= 1000).length;
  }

  // Score normalizado 0..100 da mão: considera potência total e manilhas
  evaluateHand(hand, vira) {
    if (!hand || hand.length === 0) return 0;
    const powers = this._handPowers(hand);
    let score = 0;
    for (const { power } of powers) {
      if (power >= 1000) {
        score += 30 + (power - 1000) * 5; // manilha: 30-50 pts cada
      } else {
        score += Math.max(0, power - 3) * 2; // cartas comuns: 0-20 pts
      }
    }
    return score;
  }

  // Contexto do jogo: situação de vasas, placar e urgência
  _gameContext() {
    const e = this.engine;
    const player = e.players[this.playerIndex];
    const myTeam = player.team;
    const oppTeam = 1 - myTeam;
    const myScore = e.scores[myTeam];
    const oppScore = e.scores[oppTeam];

    // Vasas ganhas/perdidas até aqui
    let myVasas = 0, oppVasas = 0;
    for (const w of e.roundWinners) {
      if (w === myTeam) myVasas++;
      else if (w !== -1) oppVasas++;
    }

    const oppUrgency = oppScore >= 10 ? 'critical' : oppScore >= 8 ? 'high' : 'normal';
    const myUrgency  = myScore  >= 10 ? 'critical' : myScore  >= 8 ? 'high' : 'normal';

    return { myTeam, oppTeam, myScore, oppScore, myVasas, oppVasas, oppUrgency, myUrgency };
  }

  // Decide se joga ou foge na Mão de Onze
  decideMaoDeOnze() {
    const player  = this.engine.players[this.playerIndex];
    const score   = this.evaluateHand(player.hand, this.engine.vira);
    const manilhas = this._countManilhas(player.hand);

    if (manilhas >= 1) return true;
    if (score   >= 35) return true;
    return Math.random() < 0.30; // blefe defensivo ocasional
  }

  // Decide se pede Truco na sua vez
  shouldRequestTruco() {
    const e = this.engine;
    if (e.pendingBet || e.isMaoDeOnze || e.isMaoDeFerro) return false;

    const player = e.players[this.playerIndex];
    if (e.lastBettorTeam === player.team) return false;

    const hand = player.hand;
    if (!hand || hand.length === 0) return false;

    const manilhas = this._countManilhas(hand);
    const score    = this.evaluateHand(hand, e.vira);
    const ctx      = this._gameContext();

    // Nunca trucar se adversário está crítico e mão é fraca
    if (ctx.oppUrgency === 'critical' && score < 25 && manilhas === 0) return false;

    if (manilhas >= 2)                              return Math.random() < 0.85;
    if (manilhas >= 1 && ctx.myVasas >= 1)         return Math.random() < 0.70;
    if (manilhas >= 1 && score >= 30)              return Math.random() < 0.55;
    if (score    >= 45)                             return Math.random() < 0.45;

    // Blefe ocasional na 1ª vasa com score médio
    if (e.currentRound === 0 && score >= 20 && Math.random() < 0.08) return true;

    return false;
  }

  // Decide resposta ao pedido de Truco/Seis/Nove/Doze do adversário
  decideBetResponse() {
    const e   = this.engine;
    const bet = e.pendingBet;
    if (!bet) return 'accept';

    const player  = e.players[this.playerIndex];
    const hand    = player.hand;
    const score   = this.evaluateHand(hand, e.vira);
    const manilhas = this._countManilhas(hand);
    const ctx     = this._gameContext();
    const targetStake = bet.targetStake;

    // Mão excelente: retrucar se possível
    if (manilhas >= 2 || (manilhas >= 1 && score >= 45)) {
      if (targetStake < 12 && Math.random() < 0.55) return 'raise';
      return 'accept';
    }

    // 1 manilha ou mão boa
    if (manilhas >= 1 || score >= 30) {
      if (ctx.myVasas >= 1 && targetStake < 12 && Math.random() < 0.30) return 'raise';
      return 'accept';
    }

    // Mão razoável: aceita truco mas vacila em valores maiores
    if (score >= 20) {
      if (targetStake <= 3) return 'accept';
      if (targetStake <= 6) return Math.random() < 0.55 ? 'accept' : 'refuse';
      return Math.random() < 0.25 ? 'accept' : 'refuse';
    }

    // Mão fraca: foge quase sempre
    if (targetStake >= 9) return Math.random() < 0.10 ? 'accept' : 'refuse';
    if (targetStake >= 6) return Math.random() < 0.20 ? 'accept' : 'refuse';
    return Math.random() < 0.35 ? 'accept' : 'refuse';
  }

  // Escolhe a carta ideal para jogar no trick atual
  chooseCardToPlay() {
    const player = this.engine.players[this.playerIndex];
    const hand   = player.hand;
    if (!hand || hand.length === 0) return null;

    // Mão de Ferro: joga às cegas
    if (this.engine.isMaoDeFerro) {
      return { cardId: hand[0].id, isCovered: false };
    }

    const tableCards = this.engine.roundCards;
    const roundIndex = this.engine.currentRound;
    const ctx        = this._gameContext();
    const sortedHand = this._handPowers(hand);

    // Quem está liderando na mesa
    let highestPowerOnTable = -1;
    let leadingTeam = -1;

    for (const item of tableCards) {
      if (item.power > highestPowerOnTable) {
        highestPowerOnTable = item.power;
        leadingTeam = item.team;
      } else if (item.power === highestPowerOnTable && item.team !== leadingTeam) {
        leadingTeam = -1; // canga
      }
    }

    // Cenário 1: Primeiro a jogar na vasa (mesa vazia)
    if (tableCards.length === 0) {
      if (roundIndex === 0) {
        // 1ª vasa: carta intermediária para economizar manilhas
        const medium = sortedHand.find(c => c.power >= 8 && c.power < 1000)
                    || sortedHand.find(c => c.power < 1000)
                    || sortedHand[sortedHand.length - 1];
        return { cardId: medium.card.id, isCovered: false };
      }
      if (roundIndex === 1) {
        // 2ª vasa: se ganhou a 1ª, economiza jogando a mais fraca
        if (ctx.myVasas >= 1) {
          return { cardId: sortedHand[0].card.id, isCovered: false };
        }
        // Perdeu a 1ª: joga a maior para tentar igualar
        return { cardId: sortedHand[sortedHand.length - 1].card.id, isCovered: false };
      }
      // 3ª vasa decisiva: joga a maior
      return { cardId: sortedHand[sortedHand.length - 1].card.id, isCovered: false };
    }

    // Cenário 2: Meu parceiro já está vencendo
    if (leadingTeam === player.team) {
      const weakest   = sortedHand[0];
      const canCover = (roundIndex > 0 && Math.random() < 0.25);
      return { cardId: weakest.card.id, isCovered: canCover };
    }

    // Cenário 3: Adversário está ganhando — tenta matar com a menor carta suficiente
    const winningCards = sortedHand.filter(c => c.power > highestPowerOnTable);
    if (winningCards.length > 0) {
      return { cardId: winningCards[0].card.id, isCovered: false };
    }

    // Não consegue ganhar: descarta a mais fraca, pode cobrir para esconder
    const weakest  = sortedHand[0];
    const canCover = (roundIndex > 0 && Math.random() < 0.35);
    return { cardId: weakest.card.id, isCovered: canCover };
  }
}

window.TrucoBot = TrucoBot;
