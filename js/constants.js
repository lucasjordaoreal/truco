// Constantes e definições de regras do Truco Paulista
const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];

const SUITS = [
  { id: 'diamonds', name: 'Ouros', symbol: '♦', color: '#e63946', power: 1, nickname: 'Picafumo / Mole' },
  { id: 'spades',   name: 'Espadas', symbol: '♠', color: '#1a1a2e', power: 2, nickname: 'Espadilha' },
  { id: 'hearts',   name: 'Copas', symbol: '♥', color: '#e63946', power: 3, nickname: 'Copeta' },
  { id: 'clubs',    name: 'Paus', symbol: '♣', color: '#1a1a2e', power: 4, nickname: 'Zap' }
];

// Força base das cartas normais (sem ser manilha)
const BASE_POWER = {
  '4': 1,
  '5': 2,
  '6': 3,
  '7': 4,
  'Q': 5,
  'J': 6,
  'K': 7,
  'A': 8,
  '2': 9,
  '3': 10
};

// Próxima carta na sequência do Paulista (determina a manilha com base na vira)
const MANILHA_MAP = {
  '4': '5',
  '5': '6',
  '6': '7',
  '7': 'Q',
  'Q': 'J',
  'J': 'K',
  'K': 'A',
  'A': '2',
  '2': '3',
  '3': '4'
};

const BET_STAGES = [
  { value: 1, label: 'Normal', nextLabel: 'Truco', nextValue: 3 },
  { value: 3, label: 'Truco', nextLabel: 'Seis', nextValue: 6 },
  { value: 6, label: 'Seis', nextLabel: 'Nove', nextValue: 9 },
  { value: 9, label: 'Nove', nextLabel: 'Doze', nextValue: 12 },
  { value: 12, label: 'Doze', nextLabel: null, nextValue: null }
];

// A chave da Gemini não deve ser exposta no código enviado ao navegador.
const GEMINI_API_ENDPOINT = null;

window.TrucoConstants = {
  RANKS,
  SUITS,
  BASE_POWER,
  MANILHA_MAP,
  BET_STAGES,
  GEMINI_API_ENDPOINT
};
