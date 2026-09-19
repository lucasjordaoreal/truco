// d:\truco\js\bot.js
// Inteligência Artificial Estratégica Avançada dos Bots de Truco Paulista
// Sem uso de aleatoriedade (Math.random) - Tomada de decisão baseada em contagem de cartas,
// probabilidade condicional, teoria dos jogos (EV), dinâmica de vasas e regras oficiais do Truco Paulista.

class TrucoBot {
  constructor(playerIndex, engine) {
    this.playerIndex = playerIndex;
    this.engine = engine;
  }

  // =========================================================================
  // 1. SISTEMA DE FORÇA DE CARTAS E HIERARQUIA DINÂMICA
  // =========================================================================

  /**
   * Retorna a força absoluta de uma carta frente à vira atual.
   * Manilhas: Zap (Paus) = 1004, Copeta (Copas) = 1003, Espadilha (Espadas) = 1002, Picafumo (Ouros) = 1001.
   * Cartas comuns: 3 = 10, 2 = 9, A = 8, K = 7, J = 6, Q = 5, 7 = 4, 6 = 3, 5 = 2, 4 = 1.
   * Carta encoberta = 0.
   */
  _getCardPower(card) {
    if (!card) return -1;
    if (card.isCovered) return 0;
    return TrucoDeck.getCardPower(card, this.engine.vira);
  }

  /**
   * Retorna as cartas da mão do bot com seus respectivos poderes, ordenadas do mais fraco para o mais forte.
   */
  _handPowers(hand) {
    if (!hand || hand.length === 0) return [];
    return hand
      .map(c => ({ card: c, power: this._getCardPower(c) }))
      .sort((a, b) => a.power - b.power);
  }

  /**
   * Lista as manilhas presentes na mão especificada.
   */
  _getManilhas(hand) {
    if (!hand) return [];
    return hand.filter(c => this._getCardPower(c) >= 1001);
  }

  // =========================================================================
  // 2. CONTEXTO COMPLETO DO JOGO E DA MÃO
  // =========================================================================

  /**
   * Extrai o estado estratégico atual da partida e da mão.
   */
  _gameContext() {
    const e = this.engine;
    const player = e.players[this.playerIndex];
    const myTeam = player.team;
    const oppTeam = 1 - myTeam;
    const myScore = e.scores[myTeam];
    const oppScore = e.scores[oppTeam];

    let myVasas = 0;
    let oppVasas = 0;
    let cangas = 0;

    for (let i = 0; i < e.roundWinners.length; i++) {
      const w = e.roundWinners[i];
      if (w === myTeam) myVasas++;
      else if (w === oppTeam) oppVasas++;
      else if (w === -1) cangas++;
    }

    const currentRound = e.currentRound; // 0, 1 ou 2
    const currentStake = e.currentStake; // 1, 3, 6, 9, 12

    return {
      player,
      myTeam,
      oppTeam,
      myScore,
      oppScore,
      myVasas,
      oppVasas,
      cangas,
      currentRound,
      currentStake,
      roundWinners: [...e.roundWinners],
      numPlayers: e.numPlayers,
      isFirstHandStarter: e.handStarterIndex === this.playerIndex,
      handStarterTeam: e.players[e.handStarterIndex].team
    };
  }

  // =========================================================================
  // 3. MOTOR DE CONTAGEM DE CARTAS E CARTAS INVISÍVEIS (POOL DESCONHECIDO)
  // =========================================================================

  /**
   * Reconstrói todo o baralho de 40 cartas e remove:
   * - A vira
   * - As cartas da mão do bot
   * - Todas as cartas já reveladas na mesa por qualquer jogador
   * Retorna o conjunto exato de cartas que ainda estão no jogo (mãos dos adversários/parceiro ou monte).
   */
  _getUnseenPool() {
    const e = this.engine;
    const vira = e.vira;
    if (!vira) return [];

    const seenCardIds = new Set();
    seenCardIds.add(vira.id);

    // Cartas na mão do bot
    const myHand = e.players[this.playerIndex].hand || [];
    for (const c of myHand) {
      seenCardIds.add(c.id);
    }

    // Cartas jogadas na vasa atual
    for (const rc of e.roundCards) {
      if (rc.card && !rc.isCovered) {
        seenCardIds.add(rc.card.id);
      }
    }

    // Monta o baralho padrão de 40 cartas
    const pool = [];
    for (const rank of TrucoConstants.RANKS) {
      for (const suit of TrucoConstants.SUITS) {
        const cardObj = {
          id: `${rank}_${suit.id}`,
          rank: rank,
          suit: suit.id,
          suitPower: suit.power
        };
        if (!seenCardIds.has(cardObj.id)) {
          cardObj.power = TrucoDeck.getCardPower(cardObj, vira);
          pool.push(cardObj);
        }
      }
    }

    return pool;
  }

  /**
   * Analisa quais manilhas ainda não foram vistas no jogo.
   */
  _getUnseenManilhas() {
    const pool = this._getUnseenPool();
    return pool.filter(c => c.power >= 1001).sort((a, b) => b.power - a.power);
  }

  /**
   * Determina a carta viva mais forte de todo o jogo (o "Zap Efetivo").
   * Se o Zap real (1004) já foi jogado ou está na minha mão, a Copeta (1003) se torna invencível!
   */
  _getHighestUnseenPower() {
    const pool = this._getUnseenPool();
    if (pool.length === 0) return 0;
    let max = 0;
    for (const c of pool) {
      if (c.power > max) max = c.power;
    }
    return max;
  }

  /**
   * Calcula a probabilidade condicional exata de uma carta com determinado `power`
   * ser batida por uma carta aleatória do pool invisível.
   */
  _calculateWinProbability(power) {
    if (power <= 0) return 0;
    const pool = this._getUnseenPool();
    if (pool.length === 0) return 1.0;

    let beatingCards = 0;
    let tyingCards = 0;
    for (const c of pool) {
      if (c.power > power) beatingCards++;
      else if (c.power === power) tyingCards++;
    }

    // Probabilidade de uma única carta aleatória do pool bater a nossa
    const pSingleBeats = beatingCards / pool.length;

    // Número estimado de cartas nas mãos dos adversários
    const e = this.engine;
    const ctx = this._gameContext();
    let oppCardsInHands = 0;
    for (let i = 0; i < e.numPlayers; i++) {
      if (e.players[i].team === ctx.oppTeam) {
        oppCardsInHands += (e.players[i].hand ? e.players[i].hand.length : 0);
      }
    }

    if (oppCardsInHands <= 0) return 1.0;

    // Probabilidade de NENHUMA carta dos adversários ser maior:
    const pNoneBeats = Math.pow(Math.max(0, 1 - pSingleBeats), oppCardsInHands);

    return pNoneBeats;
  }

  // =========================================================================
  // 4. AVALIAÇÃO DA FORÇA DA MÃO
  // =========================================================================

  /**
   * Score qualitativo e probabilístico da mão (0 a 100).
   * Considera garantia de vasas, manilhas e potencial de fechamento.
   */
  evaluateHand(hand, vira) {
    if (!hand || hand.length === 0) return 0;
    const powers = hand.map(c => TrucoDeck.getCardPower(c, vira)).sort((a, b) => a - b);

    let score = 0;
    let manilhasCount = 0;

    for (const p of powers) {
      if (p >= 1004) { // Zap: carta máxima do jogo
        score += 40;
        manilhasCount++;
      } else if (p >= 1003) { // Copeta
        score += 35;
        manilhasCount++;
      } else if (p >= 1002) { // Espadilha
        score += 30;
        manilhasCount++;
      } else if (p >= 1001) { // Picafumo
        score += 25;
        manilhasCount++;
      } else if (p === 10) { // 3
        score += 15;
      } else if (p === 9) { // 2
        score += 10;
      } else if (p === 8) { // Ás
        score += 7;
      } else if (p >= 6) { // K, J
        score += 4;
      } else { // Cartas baixas (4, 5, 6, 7, Q)
        score += 1;
      }
    }

    // Bônus estratégico: 2 manilhas garantem quase 100% de vitória no Truco Paulista
    if (manilhasCount >= 2) score += 20;
    if (manilhasCount >= 3) score += 30;

    return Math.min(100, score);
  }

  /**
   * Calcula se a mão atual do bot possui uma garantia matemática de vitória (carta imbatível).
   */
  _hasUnbeatableCard(hand) {
    if (!hand || hand.length === 0) return false;
    const highestUnseen = this._getHighestUnseenPower();
    return hand.some(c => this._getCardPower(c) > highestUnseen);
  }

  /**
   * Estima a chance de vencer a mão a partir do estado atual.
   * Usa as cartas ainda invisíveis e a quantidade de vasas que faltam.
   */
  _estimateHandWinProbability(ctx, sorted) {
    if (!sorted || sorted.length === 0) return 0;
    if (ctx.myVasas >= 2) return 1;

    const cardWinProbability = (power) => {
      if (power <= 0) return 0;
      if (power > this._getHighestUnseenPower()) return 1;
      return this._calculateWinProbability(power);
    };

    const strongest = cardWinProbability(sorted[sorted.length - 1].power);
    const secondStrongest = sorted.length > 1
      ? cardWinProbability(sorted[sorted.length - 2].power)
      : 0;

    // Depois de vencer ou empatar a 1ª vasa, basta levar a próxima.
    if (ctx.myVasas === 1 || ctx.roundWinners[0] === -1) {
      return strongest;
    }

    // Se o adversário levou a 1ª, precisamos levar as duas restantes.
    if (ctx.oppVasas === 1) {
      return strongest * secondStrongest;
    }

    // Antes da primeira vasa, vencer pelo menos duas das três é uma
    // aproximação melhor do que tratar a mão como uma carta isolada.
    return Math.min(1, strongest * secondStrongest + (1 - strongest) * secondStrongest * 0.5);
  }

  /**
   * Compara aceitar a aposta com correr usando utilidade de partida.
   * A proximidade dos 12 pontos muda o risco aceitável.
   */
  _shouldAcceptBet(ctx, targetStake, previousStake, handWinProbability) {
    const utility = (myScore, oppScore) => {
      if (myScore >= this.engine.maxScore) return 1;
      if (oppScore >= this.engine.maxScore) return 0;
      return Math.max(0.05, Math.min(0.95, 0.5 + (myScore - oppScore) / 24));
    };

    const acceptValue = handWinProbability * utility(
      ctx.myScore + targetStake,
      ctx.oppScore
    ) + (1 - handWinProbability) * utility(
      ctx.myScore,
      ctx.oppScore + targetStake
    );
    const refuseValue = utility(ctx.myScore, ctx.oppScore + previousStake);

    return acceptValue >= refuseValue;
  }

  // =========================================================================
  // 5. DECISÃO DA MÃO DE ONZE (11 x N)
  // =========================================================================

  /**
   * Decide estrategicamente se joga ou corre na Mão de Onze.
   * Regra Paulista: Se aceitar, a mão vale 3 pontos. Se correr, adversário ganha 1 ponto.
   */
  decideMaoDeOnze() {
    const player = this.engine.players[this.playerIndex];
    const hand = player.hand;
    if (!hand || hand.length === 0) return false;

    const ctx = this._gameContext();
    const sortedPowers = this._handPowers(hand);
    const manilhas = this._getManilhas(hand);
    const manilhasCount = manilhas.length;

    // Regra 1: Com 2 ou mais manilhas, SEMPRE joga.
    if (manilhasCount >= 2) return true;

    // Regra 2: Com Zap, Copeta ou Espadilha, SEMPRE joga.
    if (manilhas.some(c => this._getCardPower(c) >= 1002)) return true;

    // Regra 3: Com Picafumo (1001) + ao menos uma carta alta (Ás, 2 ou 3), joga.
    if (manilhasCount === 1) {
      const hasHighSupport = sortedPowers.some(p => p.power >= 8 && p.power < 1000);
      if (hasHighSupport) return true;
      // Se adversário está com 9 ou 10, joga para não entregar o jogo.
      if (ctx.oppScore >= 9) return true;
      return false;
    }

    // Regra 4: Sem manilhas.
    const powersOnly = sortedPowers.map(p => p.power);
    const threesCount = powersOnly.filter(p => p === 10).length;
    const twosCount = powersOnly.filter(p => p === 9).length;

    // Se possui ao menos dois "3" ou (3 + 2):
    if (threesCount >= 2 || (threesCount >= 1 && twosCount >= 1)) {
      if (ctx.oppScore >= 8) return true;
      return false;
    }

    // Se o adversário está em 10 pontos:
    // Se correr, o adversário vai para 11 e teremos Mão de Ferro (50/50 às cegas).
    if (ctx.oppScore === 10) {
      const strongCardsCount = powersOnly.filter(p => p >= 8).length;
      return strongCardsCount >= 2;
    }

    return false;
  }

  // =========================================================================
  // 6. DECISÃO DE PEDIR TRUCO (SEIS, NOVE, DOZE)
  // =========================================================================

  /**
   * Decide deterministamente se deve pedir Truco na sua vez.
   * Baseado em Expected Value (EV), posição na vasa, vantagem conquistada e risco do placar.
   */
  shouldRequestTruco() {
    const e = this.engine;
    if (e.pendingBet || e.isMaoDeOnze || e.isMaoDeFerro) return false;

    const player = e.players[this.playerIndex];
    if (e.lastBettorTeam === player.team) return false;

    const hand = player.hand;
    if (!hand || hand.length === 0) return false;

    const ctx = this._gameContext();
    const sorted = this._handPowers(hand);
    const manilhas = this._getManilhas(hand);
    const manilhasCount = manilhas.length;
    const bestCardPower = sorted[sorted.length - 1].power;
    const highestUnseen = this._getHighestUnseenPower();

    // -----------------------------------------------------------------------
    // CASO 1: VITÓRIA MATEMÁTICA GARANTIDA (100% Lock)
    // -----------------------------------------------------------------------
    // Se já ganhamos a 1ª vasa e nossa melhor carta é estritamente maior que qualquer carta viva:
    if (ctx.myVasas === 1 && bestCardPower > highestUnseen) {
      return true; // Impossível perder. Truco obrigatório!
    }

    // Se empatamos a 1ª vasa (canga) e temos a carta mais forte viva para a 2ª:
    if (ctx.roundWinners[0] === -1 && bestCardPower > highestUnseen) {
      return true; // Quem leva a 2ª leva a mão. Truco imediato!
    }

    // -----------------------------------------------------------------------
    // CASO 2: VANTAGEM ESMAGADORA NA 2ª OU 3ª VASA
    // -----------------------------------------------------------------------
    if (ctx.myVasas === 1) {
      // Temos pelo menos 1 manilha viva:
      if (manilhasCount >= 1) {
        if (manilhas.some(c => this._getCardPower(c) >= 1002)) return true;
        if (sorted.length <= 2) return true;
      }
      // Não temos manilha, mas temos um 3 e o Zap e a Copeta já morreram:
      if (bestCardPower === 10 && highestUnseen <= 1001) {
        return true;
      }
    }

    // -----------------------------------------------------------------------
    // CASO 3: DUAS MANILHAS NA MÃO
    // -----------------------------------------------------------------------
    if (manilhasCount >= 2) {
      if (ctx.currentRound === 0) {
        if (manilhas.some(c => this._getCardPower(c) === 1004)) return true; // Tem o Zap
        if (sorted[0].power >= 8) return true; // Manilhas + suporte forte (A, 2, 3)
      } else {
        return true;
      }
    }

    // -----------------------------------------------------------------------
    // CASO 4: PRESSÃO TÁTICA NO ADVERSÁRIO CRÍTICO (Adversário com 10 pontos)
    // -----------------------------------------------------------------------
    if (ctx.oppScore === 10 && ctx.myScore <= 9) {
      if (ctx.myVasas === 1 && bestCardPower >= 8) {
        return true;
      }
      if (ctx.currentRound === 0 && manilhasCount >= 1 && bestCardPower >= 1002) {
        return true;
      }
    }

    // -----------------------------------------------------------------------
    // CASO 5: RECUPERAÇÃO AGRESSIVA QUANDO MUITO ATRÁS NO PLACAR
    // -----------------------------------------------------------------------
    if (ctx.oppScore >= 9 && ctx.myScore <= 5) {
      if (ctx.currentRound === 0 && (manilhasCount >= 1 || (bestCardPower === 10 && sorted[1].power >= 8))) {
        return true;
      }
    }

    return false;
  }

  // =========================================================================
  // 7. DECISÃO DE RESPOSTA AO TRUCO / AUMENTO DO ADVERSÁRIO
  // =========================================================================

  /**
   * Decide deterministamente como responder a um pedido de aposta:
   * 'accept' (aceitar), 'refuse' (correr), ou 'raise' (retrucar / pedir mais).
   */
  decideBetResponse() {
    const e = this.engine;
    const bet = e.pendingBet;
    if (!bet) return 'accept';

    const player = e.players[this.playerIndex];
    const hand = player.hand;
    if (!hand || hand.length === 0) return 'refuse';

    const ctx = this._gameContext();
    const sorted = this._handPowers(hand);
    const manilhas = this._getManilhas(hand);
    const manilhasCount = manilhas.length;
    const bestCardPower = sorted[sorted.length - 1].power;
    const highestUnseen = this._getHighestUnseenPower();
    const targetStake = bet.targetStake; // 3 (Truco), 6 (Seis), 9 (Nove), 12 (Doze)

    // -----------------------------------------------------------------------
    // A. QUANDO RETRUCAR ('raise')
    // -----------------------------------------------------------------------
    if (targetStake < 12) {
      // 1. Garantia matemática absoluta (invencível):
      if (ctx.myVasas === 1 && bestCardPower > highestUnseen) {
        return 'raise';
      }
      // 2. Empatou a 1ª vasa e temos a maior carta viva:
      if (ctx.roundWinners[0] === -1 && bestCardPower > highestUnseen) {
        return 'raise';
      }
      // 3. Duas manilhas muito fortes (ex: Zap e Copeta):
      if (manilhasCount >= 2 && manilhas.some(c => this._getCardPower(c) === 1004)) {
        return 'raise';
      }
      // 4. Se o adversário pediu Truco (3) e nós ganhamos a 1ª vasa com Zap ou Copeta:
      if (targetStake === 3 && ctx.myVasas === 1 && manilhasCount >= 1 && bestCardPower >= 1003) {
        return 'raise';
      }
    }

    // -----------------------------------------------------------------------
    // B. ANÁLISE DE RISCO POR VASA E PELO PLACAR
    // -----------------------------------------------------------------------
    const handWinProbability = this._estimateHandWinProbability(ctx, sorted);
    return this._shouldAcceptBet(
      ctx,
      targetStake,
      bet.previousStake,
      handWinProbability
    ) ? 'accept' : 'refuse';
  }

  // =========================================================================
  // 8. ESCOLHA DA CARTA A JOGAR NO TRICK (ZERO RANDOM)
  // =========================================================================

  /**
   * Escolhe a carta ideal e decide deterministamente se deve cobrir (isCovered).
   */
  chooseCardToPlay() {
    const player = this.engine.players[this.playerIndex];
    const hand = player.hand;
    if (!hand || hand.length === 0) return null;

    if (this.engine.isMaoDeFerro) {
      return { cardId: hand[0].id, isCovered: false };
    }

    const tableCards = this.engine.roundCards;
    const ctx = this._gameContext();
    const sortedHand = this._handPowers(hand);

    let highestPowerOnTable = -1;
    let leadingTeam = -1;
    let isCurrentTrickTied = false;

    for (const item of tableCards) {
      if (item.power > highestPowerOnTable) {
        highestPowerOnTable = item.power;
        leadingTeam = item.team;
        isCurrentTrickTied = false;
      } else if (item.power === highestPowerOnTable && item.power > 0) {
        if (item.team !== leadingTeam) {
          isCurrentTrickTied = true;
          leadingTeam = -1;
        }
      }
    }

    // CENÁRIO 1: MESA VAZIA
    if (tableCards.length === 0) {
      return this._playLeadCard(sortedHand, ctx);
    }

    // CENÁRIO 2: MEU PARCEIRO ESTÁ VENCENDO A MESA
    if (leadingTeam === ctx.myTeam && !isCurrentTrickTied) {
      return this._playPartnerWinning(sortedHand, ctx, highestPowerOnTable);
    }

    // CENÁRIO 3: ADVERSÁRIO ESTÁ VENCENDO (OU HÁ CANGA NA MESA)
    return this._playOpponentWinning(sortedHand, ctx, highestPowerOnTable);
  }

  // -------------------------------------------------------------------------
  // SUB-ROTINA: Primeiro a jogar na vasa (Mesa vazia)
  // -------------------------------------------------------------------------
  _playLeadCard(sortedHand, ctx) {
    const roundIndex = ctx.currentRound;
    const manilhas = sortedHand.filter(c => c.power >= 1001);
    const highestUnseen = this._getHighestUnseenPower();

    // 1ª VASA (round 0)
    if (roundIndex === 0) {
      if (manilhas.length >= 2) {
        const strongNonManilha = sortedHand.slice().reverse().find(c => c.power < 1001 && c.power >= 8);
        if (strongNonManilha) {
          return { cardId: strongNonManilha.card.id, isCovered: false };
        }
      }

      if (manilhas.length === 1 && manilhas[0].power === 1004) {
        return { cardId: manilhas[0].card.id, isCovered: false };
      }

      const highCommon = sortedHand.slice().reverse().find(c => c.power >= 8 && c.power < 1001);
      if (highCommon) {
        return { cardId: highCommon.card.id, isCovered: false };
      }

      const mid = sortedHand[Math.floor(sortedHand.length / 2)];
      return { cardId: mid.card.id, isCovered: false };
    }

    // 2ª VASA (round 1)
    if (roundIndex === 1) {
      if (ctx.myVasas === 1) {
        const winningGuaranteed = sortedHand.find(c => c.power > highestUnseen);
        if (winningGuaranteed) {
          return { cardId: winningGuaranteed.card.id, isCovered: false };
        }

        const strongM = manilhas.find(c => c.power >= 1002);
        if (strongM) {
          return { cardId: strongM.card.id, isCovered: false };
        }

        return { cardId: sortedHand[0].card.id, isCovered: false };
      }

      if (ctx.oppVasas === 1 || ctx.roundWinners[0] === -1) {
        return { cardId: sortedHand[sortedHand.length - 1].card.id, isCovered: false };
      }
    }

    // 3ª VASA DECISIVA (round 2)
    return { cardId: sortedHand[sortedHand.length - 1].card.id, isCovered: false };
  }

  // -------------------------------------------------------------------------
  // SUB-ROTINA: Meu parceiro está vencendo a mesa
  // -------------------------------------------------------------------------
  _playPartnerWinning(sortedHand, ctx, partnerPower) {
    const roundIndex = ctx.currentRound;
    const highestUnseen = this._getHighestUnseenPower();

    if (partnerPower > highestUnseen) {
      return this._discardWeakest(sortedHand, roundIndex);
    }

    const e = this.engine;
    const nextPlayersCount = (e.numPlayers - e.roundCards.length);

    if (nextPlayersCount === 0) {
      return this._discardWeakest(sortedHand, roundIndex);
    }

    if (partnerPower >= 1003 || (partnerPower === 10 && highestUnseen <= 1001)) {
      return this._discardWeakest(sortedHand, roundIndex);
    }

    if (roundIndex === 0 && partnerPower < 8) {
      const secureCard = sortedHand.find(c => c.power >= 9 && c.power < 1004);
      if (secureCard) {
        return { cardId: secureCard.card.id, isCovered: false };
      }
    }

    return this._discardWeakest(sortedHand, roundIndex);
  }

  // -------------------------------------------------------------------------
  // SUB-ROTINA: Adversário está vencendo (ou mesa empatada)
  // -------------------------------------------------------------------------
  _playOpponentWinning(sortedHand, ctx, targetPower) {
    const roundIndex = ctx.currentRound;

    const winningCards = sortedHand.filter(c => c.power > targetPower);
    const tyingCards = sortedHand.filter(c => c.power === targetPower && targetPower > 0);

    // No Truco Paulista, se nós vencemos a 1ª vasa, EMPATAR A 2ª OU A 3ª VENCE A MÃO!
    if (roundIndex === 1 && ctx.myVasas === 1 && tyingCards.length > 0) {
      return { cardId: tyingCards[0].card.id, isCovered: false };
    }

    if (roundIndex === 2 && ctx.myVasas === 1 && tyingCards.length > 0) {
      return { cardId: tyingCards[0].card.id, isCovered: false };
    }

    // Matar por baixo com a menor carta vencedora
    if (winningCards.length > 0) {
      return { cardId: winningCards[0].card.id, isCovered: false };
    }

    // Não dá para vencer: tenta cangar na 1ª vasa se for vantajoso
    if (roundIndex === 0 && tyingCards.length > 0) {
      const hasStrongForSecond = sortedHand.some(c => c.power >= 1001);
      if (hasStrongForSecond) {
        return { cardId: tyingCards[0].card.id, isCovered: false };
      }
    }

    // Não dá para vencer nem cangar: descarta a mais fraca
    return this._discardWeakest(sortedHand, roundIndex);
  }

  // -------------------------------------------------------------------------
  // SUB-ROTINA: Descarte estratégico e decisão de carta coberta
  // -------------------------------------------------------------------------
  _discardWeakest(sortedHand, roundIndex) {
    const weakest = sortedHand[0];

    // Na 1ª vasa: proibido cobrir pela regra oficial
    if (roundIndex === 0) {
      return { cardId: weakest.card.id, isCovered: false };
    }

    // Na 2ª vasa: se a carta for intermediária/alta (Q, J, K, A, 2, 3), cobre para esconder informação!
    const shouldCover = (roundIndex > 0 && weakest.power >= 5);

    return { cardId: weakest.card.id, isCovered: shouldCover };
  }
}

window.TrucoBot = TrucoBot;
