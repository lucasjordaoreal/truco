# Truco Paulista Online ♠️♥️♦️♣️

Jogo completo de **Truco Paulista** para navegador, desenvolvido com foco em fidelidade às regras tradicionais, visual moderno de mesa de feltro, animações físicas fluidas e efeitos sonoros imersivos.

Jogue **solo contra bots inteligentes** ou convide amigos para partidas **multiplayer online em tempo real**, sem necessidade de cadastro, download ou servidor backend.

---

## Modos de Jogo

### 1. Solo contra Bots
- Inicie uma partida instantânea contra inteligência artificial.
- Mesas disponíveis em **1 vs 1 (Mesa Rápida)**, **2 vs 2 (Duplas Tradicionais)** e **3 vs 3 (Trios)**.
- Bots com comportamento realista: avaliam a força da mão, quantidade de manilhas, urgência do placar, momento da vaza, além de realizarem blefes e retrucos estratégicos com falas típicas de truqueiro.

### 2. Multiplayer Online
- **Criar Sala**: Escolha o formato (**2, 4 ou 6 jogadores**), defina uma senha opcional e ative o preenchimento automático de vagas vazias por bots.
- **Link Direto**: Copie o código ou link da sala (`#sala=XYZ`) diretamente pelo topo da tela. Ao acessar o link, os jogadores entram na mesma mesa instantaneamente.
- **Entrar em Sala**: Digite o código de 5 letras da sala compartilhado pelo anfitrião.

---

## Funcionalidades e Experiência de Jogo

- **Animações de Mesa e Cartas**:
  - **Embaralhamento 3D (Riffle Shuffle)**: Corte de maço e intercalação visual de cartas antes da primeira mão ou após cada rodada.
  - **Distribuição Física**: Cartas voam da estação de baralho para as mãos dos jogadores e mini-cartas dos assentos.
  - **Revelação da Vira**: Carta virada com rotação natural no feltro ao lado do baralho.
  - **Fade Out Suave de Vasas**: Ao término de cada vaza, as cartas jogadas dissolvem suavemente no feltro para abrir espaço para a próxima vaza.
  - **Recolhimento Completo**: Ao fim de cada mão, todas as cartas na mesa voam de volta ao maço.

- **Áudio Procedural Realista (Web Audio API)**:
  - Síntese de áudio procedural sem dependência de arquivos externos de som.
  - Sons de atrito de carta no feltro, batida firme na mesa ao pedir Truco, sino de canga (empate), chimes de vitória, derrota e alertas de contagem regressiva.

- **HUD e Interface Completa**:
  - **Placar Interativo**: Contagem clara de pontos de *Nós* e *Eles*, valor da aposta atual e marcadores de vasas da rodada (pips coloridos).
  - **Guia de Manilhas no Topo**: Exibe em tempo real a carta manilha da rodada e a ordem exata de força dos quatro naipes.
  - **Temporizador Circular**: Indicador visual e sonoro de tempo de turno para cada jogador na mesa.
  - **Balões de Fala e Provocações**: Frases clássicas de Truco disparadas em apostas, corridas, vitórias e blefes.
  - **Chat Integrado**: Menu de mensagens rápidas e chat de texto aberto para comunicação entre os jogadores.
  - **Sistema de Série e Revanche**: Histórico acumulado de vitórias em partidas consecutivas entre as mesmas equipes.

- **Encobrir Carta (Carta Coberta)**:
  - Opção tática para jogar cartas viradas (valor zero) a partir da 2ª vasa para blefe ou estratégia de equipe.

---

## Regras Oficiais do Truco Paulista

### 1. O Baralho
- Baralho limpo de **40 cartas** (excluem-se 8, 9, 10 e curingas).
- Cada jogador recebe **3 cartas** por mão.

### 2. Força das Cartas Comuns
Em ordem crescente de valor (da mais fraca para a mais forte):
$$\text{4} < \text{5} < \text{6} < \text{7} < \text{Q} < \text{J} < \text{K} < \text{A} < \text{2} < \text{3}$$

### 3. A Vira e as Manilhas
Ao início de cada mão, uma carta é virada na mesa (a **Vira**). As **Manilhas** são as quatro cartas de valor imediatamente superior à vira:

| Se a Vira for | A Manilha é |
|:---:|:---:|
| 4 | 5 |
| 5 | 6 |
| 6 | 7 |
| 7 | Q (Dama) |
| Q | J (Valete) |
| J | K (Rei) |
| K | A (Ás) |
| A | 2 |
| 2 | 3 |
| 3 | 4 |

#### Força dos Naipes das Manilhas (fixa)
As manilhas superam todas as cartas comuns e desempatam entre si pelo naipe, na ordem tradicional decrescente:
1. ♣ **Paus (Zap)** — A mais forte do jogo.
2. ♥ **Copas (Copeta)**.
3. ♠ **Espadas (Espadilha)**.
4. ♦ **Ouros (Pica-fumo / Mole)**.

---

### 4. Dinâmica das Vasas e Empates (Canga)
Uma mão é disputada em melhor de 3 vasas:
- **Empate na 1ª vasa**: Quem vencer a 2ª vasa leva a mão.
- **Empate na 2ª vasa**: Quem venceu a 1ª vasa leva a mão.
- **Empate na 3ª vasa**: Quem venceu a 1ª vasa leva a mão.
- **Empate na 1ª e na 2ª vasa**: Quem vencer a 3ª vasa leva a mão.
- **Empate nas 3 vasas**: A equipe do jogador "Mão" (quem abriu a rodada) vence a mão.

---

### 5. Escala de Apostas
Cada mão começa valendo **1 ponto**. A qualquer momento na sua vez (ou respondendo a um desafio), uma equipe pode pedir aumento:
- **Normal** (1 ponto) ➔ **Truco** (3 pontos) ➔ **Seis** (6 pontos) ➔ **Nove** (9 pontos) ➔ **Doze** (12 pontos).
- Ao receber um pedido de aposta, a equipe adversária pode:
  - **Aceitar**: O valor da mão sobe para a aposta solicitada.
  - **Correr**: A equipe desiste e os adversários levam o valor anterior da aposta.
  - **Aumentar / Retrucar**: Eleva o desafio para o próximo degrau da escala.

---

### 6. Mão de Onze e Mão de Ferro
- **Mão de Onze**: Quando uma equipe atinge **11 pontos**, seus jogadores podem ver as próprias cartas e as cartas da dupla antes de decidir se jogam a mão (valendo 3 pontos) ou fogem (cedendo 1 ponto ao adversário). Pedidos de Truco são proibidos nessa mão.
- **Mão de Ferro (11 x 11)**: Quando ambas as equipes chegam a 11 pontos, a rodada decisiva é jogada totalmente **no escuro** (todas as cartas viradas para baixo). Quem vencer as vasas fecha a partida em 12 pontos e vence o jogo.

---

## Como Executar

### Rodando Localmente
Por ser uma aplicação 100% estática (HTML, CSS e JavaScript puros), não há necessidade de instalação de dependências ou build:

1. Clone ou baixe os arquivos do repositório.
2. Abra um servidor local na pasta do projeto (recomendado para suporte ao Web Audio e WebRTC):
   ```bash
   # Usando Python 3
   python -m http.server 8080
   ```
3. Acesse `http://localhost:8080` no seu navegador.

### Hospedagem no GitHub Pages
1. Envie os arquivos para a branch principal (`main`) do seu repositório no GitHub.
2. Vá em **Settings** > **Pages**.
3. Em **Source**, selecione a branch `main` e a pasta `/root`.
4. Salve para ter o jogo disponível publicamente no endereço `https://seu-usuario.github.io/seu-repositorio/`.

---

## Estrutura do Projeto

```
d:/truco/
├── index.html            # Estrutura da mesa, assentos, modais e HUDs
├── css/
│   ├── main.css          # Variáveis de cores, layout geral, tipografia e modais
│   ├── table.css         # Arena da mesa, cartas, assentos, tapete e descarte
│   └── animations.css    # Animações de baralho, distribuição e efeitos visuais
└── js/
    ├── constants.js      # Cartas, naipes, pesos e escala de apostas
    ├── deck.js           # Criação, embaralhamento e cálculo de força das cartas
    ├── engine.js         # Máquina de regras oficiais do Truco Paulista
    ├── bot.js            # Inteligência artificial dos bots (avaliação, apostas e blefes)
    ├── audio.js          # Efeitos sonoros procedurais via Web Audio API
    ├── network.js        # Camada de comunicação de rede e sincronização multiplayer
    └── app.js            # Controlador principal da interface, animações e fluxo do jogo
```
