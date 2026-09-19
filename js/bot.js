// d:\truco\js\bot.js
// Inteligência Artificial dos Bots de Truco Paulista

class TrucoBot {
  constructor(playerIndex, engine) {
    this.playerIndex = playerIndex;
    this.engine = engine;
  }

  // Avalia o poder relativo total da mão do bot
  evaluateHand(hand, vira) {
    if (!hand || hand.length === 0) return 0;
    let score = 0;
    for (const card of hand) {
      const power = TrucoDeck.getCardPower(card, vira);
      if (power >= 1000) {
        // Manilha! Super valiosa
        score += 35 + (power - 1000) * 5;
      } else {
        score += power * 2;
      }
    }
    return score;
  }

  // Decide se joga ou foge na Mão de Onze
  decideMaoDeOnze() {
    const player = this.engine.players[this.playerIndex];
    const score = this.evaluateHand(player.hand, this.engine.vira);
    // Se a mão tem pelo menos 1 boa manilha ou cartas altas (score >= 40), vale a pena arriscar
    return score >= 38;
  }

  // Decide se pede Truco na sua vez
  shouldRequestTruco() {
    // Não pode se já houver aposta pendente ou nas mãos especiais
    if (this.engine.pendingBet || this.engine.isMaoDeOnze || this.engine.isMaoDeFerro) return false;
    
    const player = this.engine.players[this.playerIndex];
    if (this.engine.lastBettorTeam === player.team) return false;

    const hand = player.hand;
    const score = this.evaluateHand(hand, this.engine.vira);
    const manilhas = hand.filter(c => TrucoDeck.getCardPower(c, this.engine.vira) >= 1000);

    // Se tem 2 manilhas ou Zap, ou venceu a 1ª vasa com carta boa:
    const teamWonFirst = (this.engine.roundWinners[0] === player.team);

    if (manilhas.length >= 2 || (manilhas.length >= 1 && teamWonFirst)) {
      return Math.random() < 0.75;
    }

    if (score >= 45) {
      return Math.random() < 0.50;
    }

    // Blefe ocasional (10% de chance na 1ª vasa ou após empate)
    if (this.engine.currentStake === 1 && Math.random() < 0.10) {
      return true;
    }

    return false;
  }

  // Decide resposta ao pedido de Truco/Seis/Nove/Doze do adversário
  decideBetResponse() {
    const bet = this.engine.pendingBet;
    if (!bet) return 'accept';

    const player = this.engine.players[this.playerIndex];
    const hand = player.hand;
    const score = this.evaluateHand(hand, this.engine.vira);
    const manilhas = hand.filter(c => TrucoDeck.getCardPower(c, this.engine.vira) >= 1000);

    // Mão de monstro: retrucar (raise) se possível
    if (manilhas.length >= 2 || (manilhas.length >= 1 && score >= 50)) {
      if (bet.targetStake < 12 && Math.random() < 0.45) {
        return 'raise';
      }
      return 'accept';
    }

    // Mão razoável: aceitar
    if (score >= 25 || manilhas.length >= 1) {
      return 'accept';
    }

    // Mão muito fraca:
    if (bet.targetStake >= 6) {
      return Math.random() < 0.25 ? 'accept' : 'refuse';
    }

    return Math.random() < 0.40 ? 'accept' : 'refuse';
  }

  // Escolhe a carta ideal para jogar no trick atual
  chooseCardToPlay() {
    const player = this.engine.players[this.playerIndex];
    const hand = player.hand;
    if (!hand || hand.length === 0) return null;

    // Na Mão de Ferro, joga a primeira carta às cegas
    if (this.engine.isMaoDeFerro) {
      return { cardId: hand[0].id, isCovered: false };
    }

    const vira = this.engine.vira;
    const tableCards = this.engine.roundCards;
    const roundIndex = this.engine.currentRound;

    // Analisa cartas da mesa
    let highestPowerOnTable = -1;
    let highestCardOwnerTeam = -1;

    for (const item of tableCards) {
      if (item.power > highestPowerOnTable) {
        highestPowerOnTable = item.power;
        highestCardOwnerTeam = item.team;
      }
    }

    // Ordena as cartas do bot por poder crescente
    const sortedHand = [...hand].map(card => ({
      card,
      power: TrucoDeck.getCardPower(card, vira)
    })).sort((a, b) => a.power - b.power);

    // Cenário 1: Primeiro a jogar na vasa (mesa vazia)
    if (tableCards.length === 0) {
      if (roundIndex === 0) {
        // Na primeira vasa, jogar carta intermediária ou a maior comum
        const mediumCard = sortedHand.find(c => c.power >= 7 && c.power < 1000) || sortedHand[0];
        return { cardId: mediumCard.card.id, isCovered: false };
      } else {
        // Na 2ª ou 3ª vasa decisiva, abrir com a maior
        const bestCard = sortedHand[sortedHand.length - 1];
        return { cardId: bestCard.card.id, isCovered: false };
      }
    }

    // Cenário 2: Meu parceiro já está vencendo a vasa com folga
    if (highestCardOwnerTeam === player.team && highestPowerOnTable >= 1000) {
      // Jogar a carta mais fraca para economizar
      const weakest = sortedHand[0];
      const canCover = (roundIndex > 0 && Math.random() < 0.3);
      return { cardId: weakest.card.id, isCovered: canCover };
    }

    // Cenário 3: O adversário está ganhando a vasa
    // Tenta matar com a MENOR carta suficiente para vencer
    const winningCards = sortedHand.filter(c => c.power > highestPowerOnTable);

    if (winningCards.length > 0) {
      // Escolhe a menor carta que ainda mata o oponente
      const chosen = winningCards[0];
      return { cardId: chosen.card.id, isCovered: false };
    }

    // Não consegue matar o adversário:
    // Descarta a carta mais fraca da mão
    const weakest = sortedHand[0];
    // Se estiver no round 2 ou 3, pode encobrir para esconder o jogo
    const canCover = (roundIndex > 0 && Math.random() < 0.4);
    return { cardId: weakest.card.id, isCovered: canCover };
  }
}

window.TrucoBot = TrucoBot;
