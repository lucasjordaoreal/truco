// d:\truco\js\engine.js
// Motor central de regras e estado do Truco Paulista

class TrucoEngine {
  constructor(options = {}) {
    this.numPlayers = options.numPlayers || 2; // 2, 4 ou 6
    this.deck = new TrucoDeck();
    
    // Pontuações das duplas/equipes (Time 0 = Nós/Time A, Time 1 = Eles/Time B)
    this.scores = [0, 0];
    this.maxScore = 12;

    // Estado da mão corrente
    this.dealerIndex = 0; // Quem dá as cartas (roda no sentido horário)
    this.handStarterIndex = 0; // O "mão" da rodada (à direita do carteador / anti-horário)
    this.currentTurnIndex = 0; // Vez de jogar
    this.vira = null;
    this.manilhaRank = null;
    this.players = []; // Array de dados dos jogadores { id, name, team, isBot, hand: [] }
    
    // Vasas (melhor de 3)
    this.currentRound = 0; // 0, 1, 2 (1ª, 2ª e 3ª vasa)
    this.roundCards = []; // Cartas jogadas na vasa atual: [{ playerId, card, isCovered, power }]
    this.roundWinners = []; // Array com [teamWinner, ...] ou -1 para canga/empate
    this.trickStarters = []; // Quem abriu cada vasa

    // Aposta
    this.currentStake = 1; // 1, 3, 6, 9, 12
    this.pendingBet = null; // { requestedByPlayer, requestedByTeam, targetStake, previousStake }
    this.lastBettorTeam = null; // Time que aumentou a aposta pela última vez

    // Modos especiais
    this.isMaoDeOnze = false;
    this.maoDeOnzeTeam = null; // Qual time está com 11
    this.isMaoDeFerro = false; // 11 x 11 às cegas
    this.handOver = false;
    this.gameOver = false;
    this.winningTeam = null;
  }

  // Inicializa jogadores e times
  initPlayers(playerConfigs) {
    this.players = [];
    for (let i = 0; i < this.numPlayers; i++) {
      const cfg = playerConfigs[i] || {};
      this.players.push({
        index: i,
        id: cfg.id || `p_${i}`,
        name: cfg.name || `Jogador ${i + 1}`,
        team: i % 2, // 0 para pares (0, 2, 4), 1 para ímpares (1, 3, 5)
        isBot: !!cfg.isBot,
        hand: []
      });
    }
  }

  // Inicia uma nova mão completa
  startNewHand() {
    this.handOver = false;
    this.currentRound = 0;
    this.roundCards = [];
    this.roundWinners = [];
    this.trickStarters = [];
    this.currentStake = 1;
    this.pendingBet = null;
    this.lastBettorTeam = null;

    // Checagem de Mão de Onze ou Mão de Ferro
    this.isMaoDeFerro = (this.scores[0] === 11 && this.scores[1] === 11);
    this.isMaoDeOnze = (!this.isMaoDeFerro && (this.scores[0] === 11 || this.scores[1] === 11));
    this.maoDeOnzeTeam = this.isMaoDeOnze ? (this.scores[0] === 11 ? 0 : 1) : null;

    if (this.isMaoDeOnze) {
      this.currentStake = 3; // Em SP, se aceita a mão de 11, vale 3 pontos
    }

    // Distribui cartas e vira
    const dealt = this.deck.deal(this.numPlayers);
    this.vira = dealt.vira;
    this.manilhaRank = dealt.manilhaRank;

    for (let i = 0; i < this.numPlayers; i++) {
      this.players[i].hand = dealt.hands[i];
    }

    // O "mão" é o jogador seguinte ao carteador
    this.handStarterIndex = (this.dealerIndex + 1) % this.numPlayers;
    this.currentTurnIndex = this.handStarterIndex;
    this.trickStarters[0] = this.handStarterIndex;

    return {
      scores: [...this.scores],
      vira: this.vira,
      manilhaRank: this.manilhaRank,
      handStarterIndex: this.handStarterIndex,
      isMaoDeOnze: this.isMaoDeOnze,
      maoDeOnzeTeam: this.maoDeOnzeTeam,
      isMaoDeFerro: this.isMaoDeFerro,
      currentStake: this.currentStake
    };
  }

  // Jogar uma carta
  playCard(playerIndex, cardId, isCovered = false) {
    if (this.handOver || this.gameOver) return { error: 'A mão já terminou.' };
    if (this.pendingBet) return { error: 'Existe um pedido de Truco aguardando resposta!' };
    if (playerIndex !== this.currentTurnIndex) return { error: 'Não é a sua vez de jogar!' };

    const player = this.players[playerIndex];
    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return { error: 'Carta não encontrada na mão do jogador.' };

    // Regra do Truco Paulista: Carta encoberta só é permitida a partir da 2ª vasa (round > 0)
    // Na Mão de Ferro, todas as cartas são jogadas cegas (reveladas na mesa ao jogar)
    let actualCovered = false;
    if (this.isMaoDeFerro) {
      actualCovered = false; // Revela na mesa ao jogar
    } else if (isCovered) {
      if (this.currentRound === 0) {
        return { error: 'Não é permitido jogar carta encoberta na primeira vasa!' };
      }
      actualCovered = true;
    }

    const card = player.hand.splice(cardIdx, 1)[0];
    card.isCovered = actualCovered;

    const power = actualCovered ? 0 : TrucoDeck.getCardPower(card, this.vira);

    const playedRecord = {
      playerIndex: playerIndex,
      playerName: player.name,
      team: player.team,
      card: card,
      isCovered: actualCovered,
      power: power
    };

    this.roundCards.push(playedRecord);

    // Se todos jogaram na vasa atual
    if (this.roundCards.length === this.numPlayers) {
      const vasaResult = this.evaluateTrick();
      return {
        played: playedRecord,
        vasaComplete: true,
        vasaResult: vasaResult
      };
    }

    // Passa a vez para o próximo jogador
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.numPlayers;

    return {
      played: playedRecord,
      vasaComplete: false,
      nextTurnIndex: this.currentTurnIndex
    };
  }

  // Avalia o vencedor de uma vasa (trick) e regras de canga (empate)
  evaluateTrick() {
    let maxPower = -1;
    let winningTeam = -1;
    let winningPlayerIndex = -1;
    let isCanga = false;

    for (const item of this.roundCards) {
      if (item.power > maxPower) {
        maxPower = item.power;
        winningTeam = item.team;
        winningPlayerIndex = item.playerIndex;
        isCanga = false;
      } else if (item.power === maxPower && maxPower > 0) {
        // Empate com a mesma maior força
        // Se pertencer ao mesmo time, não é canga contra o oponente
        if (item.team !== winningTeam) {
          isCanga = true;
        }
      }
    }

    const roundWinner = isCanga ? -1 : winningTeam;
    this.roundWinners.push(roundWinner);

    const checkHand = this.checkHandResolution();

    // Se a mão continua para a próxima vasa:
    if (!checkHand.finished) {
      this.currentRound++;
      this.roundCards = [];
      // O vencedor da vasa joga primeiro a próxima vasa.
      // Em caso de empate (canga), quem começou a vasa anterior joga primeiro.
      if (!isCanga) {
        this.currentTurnIndex = winningPlayerIndex;
      } else {
        this.currentTurnIndex = this.trickStarters[this.currentRound - 1];
      }
      this.trickStarters[this.currentRound] = this.currentTurnIndex;
    } else {
      this.resolveHand(checkHand.winningTeam, this.currentStake, checkHand.reason);
    }

    return {
      roundIndex: this.currentRound,
      isCanga: isCanga,
      winnerTeam: roundWinner,
      winningPlayerIndex: isCanga ? null : winningPlayerIndex,
      handFinished: checkHand.finished,
      handSummary: checkHand
    };
  }

  // Regras oficiais de desempate do Truco Paulista (Melhor de 3)
  checkHandResolution() {
    const w = this.roundWinners;
    // w[0] = 1ª vasa, w[1] = 2ª vasa, w[2] = 3ª vasa (-1 significa canga/empate)

    // 1 vasa concluída:
    if (w.length === 1) {
      return { finished: false };
    }

    // 2 vasas concluídas:
    if (w.length === 2) {
      // 1ª empatou: quem vencer a 2ª leva a mão imediatamente!
      if (w[0] === -1) {
        if (w[1] !== -1) {
          return { finished: true, winningTeam: w[1], reason: 'Empate na 1ª, levou na 2ª vasa' };
        }
        // Ambas empataram: vai para a 3ª vasa
        return { finished: false };
      }

      // 1ª teve vencedor e 2ª empatou: quem levou a 1ª ganha a mão!
      if (w[1] === -1) {
        return { finished: true, winningTeam: w[0], reason: 'Venceu a 1ª e empatou a 2ª vasa' };
      }

      // Se o mesmo time venceu a 1ª e a 2ª: venceu 2 a 0
      if (w[0] === w[1]) {
        return { finished: true, winningTeam: w[0], reason: 'Venceu 2 vasas seguidas' };
      }

      // Times diferentes venceram (1 x 1): vai para a 3ª vasa
      return { finished: false };
    }

    // 3 vasas concluídas:
    if (w.length === 3) {
      // Se a 3ª vasa teve vencedor:
      if (w[2] !== -1) {
        // Se empatou a 1ª e a 2ª, quem levou a 3ª ganha
        if (w[0] === -1 && w[1] === -1) {
          return { finished: true, winningTeam: w[2], reason: 'Levou a 3ª vasa decisiva' };
        }
        // Se 1x1 na 1ª e 2ª, quem levou a 3ª ganha
        return { finished: true, winningTeam: w[2], reason: 'Venceu a 3ª vasa decisiva' };
      }

      // A 3ª vasa empatou (canga na 3ª):
      // Regra paulista: Se a 3ª empatar, quem venceu a 1ª leva a mão!
      if (w[0] !== -1) {
        return { finished: true, winningTeam: w[0], reason: 'Empate na 3ª, vence quem levou a 1ª vasa' };
      }

      // Se as 3 vasas empataram (canga tripla):
      // Vence a equipe do "mão" (quem abriu a 1ª vasa)
      const handStarterTeam = this.players[this.handStarterIndex].team;
      return { finished: true, winningTeam: handStarterTeam, reason: 'Empate nas 3 vasas! Vence o time do Mão' };
    }

    return { finished: false };
  }

  // Pedir Truco / Aumentar aposta (Seis, Nove, Doze)
  requestBet(playerIndex) {
    if (this.handOver || this.gameOver) return { error: 'Mão ou partida já encerrada.' };
    if (this.pendingBet) return { error: 'Já existe um pedido de aposta pendente.' };

    // Regra da Mão de Onze e Mão de Ferro: Não é permitido pedir truco
    if (this.isMaoDeOnze) {
      return { error: 'Proibido pedir truco em Mão de Onze!' };
    }
    if (this.isMaoDeFerro) {
      return { error: 'Proibido pedir truco em Mão de Ferro!' };
    }

    const player = this.players[playerIndex];
    const playerTeam = player.team;

    // Regra: Quem pediu o nível anterior não pode pedir o próximo
    if (this.lastBettorTeam === playerTeam) {
      return { error: 'Sua equipe não pode aumentar a aposta que ela mesma pediu!' };
    }

    const currentStage = TrucoConstants.BET_STAGES.find(s => s.value === this.currentStake);
    if (!currentStage || !currentStage.nextValue) {
      return { error: 'A aposta já está no valor máximo (Doze)!' };
    }

    this.pendingBet = {
      requestedByPlayer: playerIndex,
      requestedByTeam: playerTeam,
      targetStake: currentStage.nextValue,
      targetLabel: currentStage.nextLabel,
      previousStake: this.currentStake
    };

    return {
      success: true,
      pendingBet: this.pendingBet
    };
  }

  // Responder ao pedido de aposta: 'accept', 'refuse' (correr), ou 'raise' (aumentar)
  respondBet(playerIndex, action) {
    if (!this.pendingBet) return { error: 'Nenhum pedido de aposta pendente.' };

    const player = this.players[playerIndex];
    // Apenas a equipe adversária à que pediu pode responder
    if (player.team === this.pendingBet.requestedByTeam) {
      return { error: 'Apenas a equipe adversária pode responder ao pedido!' };
    }

    if (action === 'refuse') {
      // Recusou/Correu: a equipe desafiante ganha os pontos acumulados até então
      const winningTeam = this.pendingBet.requestedByTeam;
      const pointsWon = this.pendingBet.previousStake;
      const response = {
        action: 'refused',
        winningTeam: winningTeam,
        pointsWon: pointsWon,
        playerIndex: playerIndex
      };
      this.pendingBet = null;
      this.resolveHand(winningTeam, pointsWon, `Adversário correu do ${this.currentStake === 1 ? 'Truco' : 'aumento'}`);
      return response;
    }

    if (action === 'accept') {
      // Aceitou: atualiza o valor da mão e define o último a apostar
      this.currentStake = this.pendingBet.targetStake;
      this.lastBettorTeam = this.pendingBet.requestedByTeam;
      const targetLabel = this.pendingBet.targetLabel;
      this.pendingBet = null;
      return {
        action: 'accepted',
        newStake: this.currentStake,
        label: targetLabel,
        playerIndex: playerIndex
      };
    }

    if (action === 'raise') {
      // Aumentou (Retrucou / Seis / Nove / Doze)
      const currentNextStage = TrucoConstants.BET_STAGES.find(s => s.value === this.pendingBet.targetStake);
      if (!currentNextStage || !currentNextStage.nextValue) {
        return { error: 'Não é possível aumentar além de Doze!' };
      }

      const previousStake = this.pendingBet.targetStake;
      const nextStake = currentNextStage.nextValue;
      const nextLabel = currentNextStage.nextLabel;

      this.pendingBet = {
        requestedByPlayer: playerIndex,
        requestedByTeam: player.team,
        targetStake: nextStake,
        targetLabel: nextLabel,
        previousStake: previousStake
      };

      return {
        action: 'raised',
        pendingBet: this.pendingBet,
        playerIndex: playerIndex
      };
    }

    return { error: 'Ação de aposta inválida.' };
  }

  // Decisão da Mão de Onze: Jogar ou Correr
  decideMaoDeOnze(playerIndex, playHand) {
    if (!this.isMaoDeOnze) return { error: 'Não estamos em Mão de Onze.' };
    const player = this.players[playerIndex];
    if (player.team !== this.maoDeOnzeTeam) {
      return { error: 'Apenas a equipe com 11 pontos pode decidir a Mão de Onze.' };
    }

    if (!playHand) {
      // Desistiu / Correu: adversário ganha 1 ponto
      const opponentTeam = 1 - this.maoDeOnzeTeam;
      this.resolveHand(opponentTeam, 1, 'Equipe na Mão de Onze optou por não jogar');
      return { action: 'declined', winningTeam: opponentTeam, pointsWon: 1 };
    } else {
      // Aceitou jogar: a mão vale 3 pontos
      this.currentStake = 3;
      return { action: 'accepted', stake: 3 };
    }
  }

  // Conclui a mão, adiciona pontuação e verifica fim de jogo
  resolveHand(winningTeam, points, reason) {
    this.handOver = true;
    this.scores[winningTeam] += points;

    if (this.scores[winningTeam] >= this.maxScore) {
      this.gameOver = true;
      this.winningTeam = winningTeam;
    }

    // Passa o carteador para o próximo jogador
    this.dealerIndex = (this.dealerIndex + 1) % this.numPlayers;

    return {
      handOver: true,
      winningTeam: winningTeam,
      pointsWon: points,
      scores: [...this.scores],
      reason: reason,
      gameOver: this.gameOver,
      championTeam: this.winningTeam
    };
  }
}

window.TrucoEngine = TrucoEngine;
