// d:\truco\js\deck.js
// Gerenciamento de baralho, embaralhamento e cálculo de força das cartas

class TrucoDeck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    for (const rank of TrucoConstants.RANKS) {
      for (const suit of TrucoConstants.SUITS) {
        this.cards.push({
          id: `${rank}_${suit.id}`,
          rank: rank,
          suit: suit.id,
          suitSymbol: suit.symbol,
          suitName: suit.name,
          suitColor: suit.color,
          suitPower: suit.power
        });
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  // Distribui cartas para N jogadores e retorna também a vira
  deal(numPlayers) {
    this.reset();
    this.shuffle();

    const hands = [];
    for (let p = 0; p < numPlayers; p++) {
      hands.push([]);
    }

    // 3 cartas para cada jogador
    for (let c = 0; c < 3; c++) {
      for (let p = 0; p < numPlayers; p++) {
        hands[p].push(this.cards.pop());
      }
    }

    // A carta virada (vira)
    const vira = this.cards.pop();
    const manilhaRank = TrucoConstants.MANILHA_MAP[vira.rank];

    return {
      hands,
      vira,
      manilhaRank
    };
  }

  // Calcula o valor absoluto de confronto de uma carta diante da vira atual
  static getCardPower(card, viraCard) {
    if (!card) return -1;
    if (card.isCovered) return 0; // Carta encoberta/virada tem valor 0

    const manilhaRank = TrucoConstants.MANILHA_MAP[viraCard.rank];

    if (card.rank === manilhaRank) {
      // É manilha! O naipe desempata:
      // Zap (Paus) = 1004, Copeta (Copas) = 1003, Espadilha (Espadas) = 1002, Picafumo (Ouros) = 1001
      const suit = TrucoConstants.SUITS.find(s => s.id === card.suit);
      const suitPower = suit ? suit.power : 0;
      return 1000 + suitPower;
    }

    // Carta comum: valor nominal sem distinção por naipe
    return TrucoConstants.BASE_POWER[card.rank] || 0;
  }

  // Retorna detalhes de manilha para exibição visual
  static getManilhaInfo(card, viraCard) {
    if (!card || !viraCard) return null;
    const manilhaRank = TrucoConstants.MANILHA_MAP[viraCard.rank];
    if (card.rank !== manilhaRank) return null;

    const suit = TrucoConstants.SUITS.find(s => s.id === card.suit);
    return {
      isManilha: true,
      nickname: suit ? suit.nickname : 'Manilha',
      priority: suit ? suit.power : 0
    };
  }
}

window.TrucoDeck = TrucoDeck;
