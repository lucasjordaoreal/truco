// d:\truco\js\app.js
// Controlador principal de interface e fluxo do jogo Truco Paulista

class TrucoApp {
  constructor() {
    this.engine = null;
    this.network = null;
    this.bots = [];
    this.myPlayerIndex = 0;
    this.coverNextCard = false;
    this.isSinglePlayer = true;
    this.roomConfig = {
      id: '',
      password: '',
      numPlayers: 4,
      fillBots: true
    };

    this.initElements();
    this.bindEvents();
    this.checkUrlInvite();
  }

  initElements() {
    this.table = document.getElementById('pokerTable');
    this.seatsContainer = document.getElementById('seatsContainer');
    this.myHandElement = document.getElementById('myHand');
    this.trickDropzone = document.getElementById('trickDropzone');
    this.viraContainer = document.getElementById('viraContainer');
    this.scoreTeam0 = document.getElementById('scoreTeam0');
    this.scoreTeam1 = document.getElementById('scoreTeam1');
    this.currentStakeBadge = document.getElementById('currentStakeBadge');
    this.trickDots = [
      document.getElementById('trickDot0'),
      document.getElementById('trickDot1'),
      document.getElementById('trickDot2')
    ];

    // Controles de ação
    this.btnTruco = document.getElementById('btnTruco');
    this.btnCoverToggle = document.getElementById('btnCoverToggle');
    this.betResponseBar = document.getElementById('betResponseBar');
    this.btnAcceptBet = document.getElementById('btnAcceptBet');
    this.btnRefuseBet = document.getElementById('btnRefuseBet');
    this.btnRaiseBet = document.getElementById('btnRaiseBet');
    this.betNoticeText = document.getElementById('betNoticeText');

    // Modais
    this.lobbyModal = document.getElementById('lobbyModal');
    this.createRoomModal = document.getElementById('createRoomModal');
    this.joinRoomModal = document.getElementById('joinRoomModal');
    this.maoDeOnzeModal = document.getElementById('maoDeOnzeModal');
    this.eventBanner = document.getElementById('eventBanner');
    this.toastContainer = document.getElementById('toastContainer');
    this.roomBadge = document.getElementById('roomBadge');
    this.roomBadgeText = document.getElementById('roomBadgeText');

    // Chat rápido
    this.btnQuickChat = document.getElementById('btnQuickChat');
    this.quickChatList = document.getElementById('quickChatList');
  }

  bindEvents() {
    // Ações na mão
    this.btnCoverToggle.addEventListener('click', () => {
      if (this.engine && this.engine.currentRound === 0) {
        this.showToast('Não é permitido encobrir carta na 1ª vasa!', 'warning');
        return;
      }
      this.coverNextCard = !this.coverNextCard;
      this.btnCoverToggle.classList.toggle('active', this.coverNextCard);
    });

    this.btnTruco.addEventListener('click', () => {
      this.handlePlayerRequestBet();
    });

    this.btnAcceptBet.addEventListener('click', () => {
      this.handlePlayerRespondBet('accept');
    });

    this.btnRefuseBet.addEventListener('click', () => {
      this.handlePlayerRespondBet('refuse');
    });

    this.btnRaiseBet.addEventListener('click', () => {
      this.handlePlayerRespondBet('raise');
    });

    // Mão de Onze
    document.getElementById('btnMaoDeOnzePlay').addEventListener('click', () => {
      this.handleMaoDeOnzeDecision(true);
    });

    document.getElementById('btnMaoDeOnzeRun').addEventListener('click', () => {
      this.handleMaoDeOnzeDecision(false);
    });

    // Chat Rápido
    this.btnQuickChat.addEventListener('click', (e) => {
      e.stopPropagation();
      this.quickChatList.classList.toggle('is-visible');
    });

    document.addEventListener('click', () => {
      this.quickChatList.classList.remove('is-visible');
    });

    document.querySelectorAll('.chat-phrase-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.textContent;
        this.sendSpeechBubble(this.myPlayerIndex, text);
        if (!this.isSinglePlayer && this.network) {
          const msg = { type: 'CHAT', playerIndex: this.myPlayerIndex, text: text };
          if (this.network.isHost) {
            this.network.broadcast(msg);
          } else {
            this.network.sendToHost(msg);
          }
        }
      });
    });

    // Modais de Criação e Entrada
    document.getElementById('btnOpenCreateModal').addEventListener('click', () => {
      this.openModal(this.createRoomModal);
    });

    document.getElementById('btnOpenJoinModal').addEventListener('click', () => {
      this.openModal(this.joinRoomModal);
    });

    document.getElementById('btnSoloPlay').addEventListener('click', () => {
      this.startSoloGame(4);
    });

    document.getElementById('btnConfirmCreate').addEventListener('click', () => {
      this.handleCreateRoom();
    });

    document.getElementById('btnConfirmJoin').addEventListener('click', () => {
      this.handleJoinRoom();
    });

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });

    // Botão de copiar código da sala
    this.roomBadge.addEventListener('click', () => {
      if (!this.roomConfig.id) return;
      const shareUrl = `${window.location.origin}${window.location.pathname}#sala=${this.roomConfig.id}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        this.showToast('Link da sala copiado!', 'success');
      }).catch(() => {
        navigator.clipboard.writeText(this.roomConfig.id);
        this.showToast(`Código da sala copiado: ${this.roomConfig.id}`, 'success');
      });
    });

    // Seletor de jogadores no modal de criação
    document.querySelectorAll('#createNumPlayers .segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#createNumPlayers .segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.roomConfig.numPlayers = parseInt(btn.dataset.players, 10);
      });
    });

    // Áudio toggle
    document.getElementById('btnToggleAudio').addEventListener('click', (e) => {
      window.TrucoAudio.muted = !window.TrucoAudio.muted;
      e.currentTarget.textContent = window.TrucoAudio.muted ? '🔇 Mudo' : '🔊 Som';
      this.showToast(window.TrucoAudio.muted ? 'Sons desativados' : 'Sons ativados');
    });
  }

  openModal(modal) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    modal.classList.add('active');
  }

  closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  checkUrlInvite() {
    const hash = window.location.hash;
    if (hash.includes('sala=')) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const roomId = params.get('sala');
      if (roomId) {
        document.getElementById('joinRoomCode').value = roomId.toUpperCase();
        this.openModal(this.joinRoomModal);
      }
    }
  }

  // ==========================================
  // INICIALIZAÇÃO DE PARTIDAS
  // ==========================================

  startSoloGame(numPlayers = 4) {
    this.isSinglePlayer = true;
    this.closeModals();
    this.myPlayerIndex = 0;
    this.roomConfig.id = 'SOLO';
    this.roomConfig.numPlayers = numPlayers;

    this.roomBadge.style.display = 'flex';
    this.roomBadgeText.textContent = `SOLO (${numPlayers}P)`;

    const playerConfigs = [
      { id: 'me', name: 'Você', isBot: false }
    ];

    const botNames = ['Chico Bento', 'Zeca Mão de Onze', 'Pedrão do Zap', 'Tião Carreiro', 'Tonho'];
    for (let i = 1; i < numPlayers; i++) {
      playerConfigs.push({
        id: `bot_${i}`,
        name: botNames[i - 1] || `Bot ${i}`,
        isBot: true
      });
    }

    this.setupEngineAndBots(numPlayers, playerConfigs);
  }

  async handleCreateRoom() {
    const playerName = document.getElementById('createPlayerName').value.trim() || 'Criador';
    const password = document.getElementById('createRoomPassword').value.trim();
    const fillBots = document.getElementById('createFillBots').checked;
    const roomId = TrucoNetwork.generateRoomId();

    this.isSinglePlayer = false;
    this.roomConfig.id = roomId;
    this.roomConfig.password = password;
    this.roomConfig.fillBots = fillBots;

    this.showToast('Iniciando sala P2P...', 'info');

    this.network = new TrucoNetwork({
      onError: (err) => {
        this.showToast(`Erro de rede: ${err.message || err}`, 'error');
      },
      onPlayerJoined: (peer) => {
        this.showToast(`${peer.name} entrou na mesa!`, 'success');
        this.handleNetworkPlayerJoined(peer);
      },
      onPlayerLeft: (peerId) => {
        this.showToast('Um jogador se desconectou.', 'warning');
      },
      onMessage: (data, fromPeerId) => {
        this.handleNetworkMessage(data, fromPeerId);
      }
    });

    try {
      await this.network.createRoom(roomId, password, playerName);
      this.closeModals();
      this.myPlayerIndex = 0;
      this.roomBadge.style.display = 'flex';
      this.roomBadgeText.textContent = `SALA: ${roomId}`;

      const playerConfigs = [
        { id: this.network.myPeerId, name: playerName, isBot: false }
      ];

      for (let i = 1; i < this.roomConfig.numPlayers; i++) {
        playerConfigs.push({
          id: `slot_${i}`,
          name: this.roomConfig.fillBots ? `Bot ${i}` : `Aguardando...`,
          isBot: this.roomConfig.fillBots
        });
      }

      this.setupEngineAndBots(this.roomConfig.numPlayers, playerConfigs);
      this.showToast(`Sala criada! Código: ${roomId}`, 'success');
    } catch (err) {
      this.showToast(`Erro ao criar sala: ${err.message}`, 'error');
    }
  }

  async handleJoinRoom() {
    const roomId = document.getElementById('joinRoomCode').value.trim().toUpperCase();
    const password = document.getElementById('joinRoomPassword').value.trim();
    const playerName = document.getElementById('joinPlayerName').value.trim() || 'Amigo';

    if (!roomId) {
      this.showToast('Informe o código da sala!', 'warning');
      return;
    }

    this.showToast('Conectando à mesa...', 'info');

    this.network = new TrucoNetwork({
      onError: (err) => {
        this.showToast(`Erro de conexão: ${err.message || err}`, 'error');
      },
      onDisconnect: (reason) => {
        this.showToast(reason, 'error');
      },
      onMessage: (data) => {
        this.handleNetworkMessage(data);
      }
    });

    try {
      this.isSinglePlayer = false;
      await this.network.joinRoom(roomId, password, playerName);
      this.closeModals();
      this.roomConfig.id = roomId;
      this.roomBadge.style.display = 'flex';
      this.roomBadgeText.textContent = `SALA: ${roomId}`;
      this.showToast('Conectado à partida!', 'success');
    } catch (err) {
      this.showToast(`Falha ao conectar: ${err.message}`, 'error');
    }
  }

  setupEngineAndBots(numPlayers, playerConfigs) {
    this.engine = new TrucoEngine({ numPlayers });
    this.engine.initPlayers(playerConfigs);

    this.bots = [];
    for (let i = 0; i < numPlayers; i++) {
      if (this.engine.players[i].isBot) {
        this.bots[i] = new TrucoBot(i, this.engine);
      }
    }

    this.renderSeats();
    this.startRoundHand();
  }

  // ==========================================
  // RENDERIZAÇÃO DA ARENA E CARTAS
  // ==========================================

  renderSeats() {
    this.seatsContainer.innerHTML = '';
    const numPlayers = this.engine.numPlayers;
    this.table.className = `truco-arena layout-${numPlayers}`;

    for (let i = 0; i < numPlayers; i++) {
      const player = this.engine.players[i];
      const isMe = (i === this.myPlayerIndex);
      const seat = document.createElement('div');
      seat.className = `player-seat seat-${i} team-${player.team}`;
      seat.id = `seat-${i}`;

      const avatarLetter = player.name.charAt(0).toUpperCase();

      seat.innerHTML = `
        <div class="chat-shout-bubble" id="speech-${i}" style="display: none;"></div>
        <div class="seat-avatar-wrap">
          <div class="seat-avatar">${avatarLetter}</div>
          <div class="dealer-chip" id="dealerBadge-${i}" style="display: none;">D</div>
        </div>
        <div class="seat-tag">${player.name}</div>
        ${!isMe ? `
          <div class="seat-hand-mini" id="seatBacks-${i}">
            <div class="mini-card"></div>
            <div class="mini-card"></div>
            <div class="mini-card"></div>
          </div>
        ` : ''}
      `;

      this.seatsContainer.appendChild(seat);
    }
  }

  startRoundHand() {
    const handState = this.engine.startNewHand();
    window.TrucoAudio.playCardSlide();

    // Limpa a mesa de descarte mantendo o label
    this.trickDropzone.innerHTML = '<span class="trick-tabletop-label">Área de Vasa</span>';
    this.coverNextCard = false;
    this.btnCoverToggle.classList.remove('active');
    this.betResponseBar.style.display = 'none';

    this.updateScoreboard();
    this.updateDealerAndTurnHighlights();
    this.renderViraCard();
    this.renderMyHand();
    this.updateActionButtons();

    if (!this.isSinglePlayer && this.network && this.network.isHost) {
      this.syncGameStateToClients();
    }

    if (handState.isMaoDeFerro) {
      this.triggerEventBanner('MÃO DE FERRO!', '11 a 11 - Todas as cartas às cegas!');
      window.TrucoAudio.playCangaBell();
    } else if (handState.isMaoDeOnze) {
      const isMyTeam = (this.engine.players[this.myPlayerIndex].team === handState.maoDeOnzeTeam);
      this.triggerEventBanner('MÃO DE ONZE!', isMyTeam ? 'Sua equipe tem 11 pontos!' : 'Adversários na Mão de Onze!');
      if (isMyTeam) {
        this.openModal(this.maoDeOnzeModal);
      } else {
        this.checkBotMaoDeOnzeDecision(handState.maoDeOnzeTeam);
      }
    }

    this.checkNextTurnAction();
  }

  renderViraCard() {
    this.viraContainer.innerHTML = '';
    const vira = this.engine.vira;
    if (!vira) return;

    const manilhaRank = this.engine.manilhaRank;
    const cardEl = this.createCardElement(vira);
    
    const mat = document.createElement('div');
    mat.className = 'vira-mat';
    mat.innerHTML = `
      <div class="vira-header-badge">VIRA: ${vira.rank}${vira.suitSymbol} ➔ MANILHA: ${manilhaRank}</div>
    `;

    const box = document.createElement('div');
    box.className = 'vira-card-box';
    box.appendChild(cardEl);
    mat.appendChild(box);

    const legend = document.createElement('div');
    legend.className = 'manilha-legend';
    legend.innerHTML = `♣ Zap &gt; ♥ Copeta &gt; ♠ Espadilha &gt; ♦ Ouros`;
    mat.appendChild(legend);

    this.viraContainer.appendChild(mat);
  }

  renderMyHand() {
    this.myHandElement.innerHTML = '';
    const myPlayer = this.engine.players[this.myPlayerIndex];
    if (!myPlayer) return;

    // Atualiza cartas dos adversários
    for (let i = 0; i < this.engine.numPlayers; i++) {
      if (i !== this.myPlayerIndex) {
        const backContainer = document.getElementById(`seatBacks-${i}`);
        if (backContainer) {
          const count = this.engine.players[i].hand.length;
          backContainer.innerHTML = '';
          for (let c = 0; c < count; c++) {
            const mini = document.createElement('div');
            mini.className = 'mini-card';
            backContainer.appendChild(mini);
          }
        }
      }
    }

    const isBlindHand = this.engine.isMaoDeFerro;

    myPlayer.hand.forEach((card) => {
      const cardEl = this.createCardElement(card, isBlindHand);
      cardEl.addEventListener('click', () => {
        this.handlePlayCard(card.id);
      });
      this.myHandElement.appendChild(cardEl);
    });
  }

  createCardElement(card, isFaceDown = false) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item';
    cardEl.dataset.id = card.id;

    if (isFaceDown) {
      cardEl.classList.add('is-covered');
      return cardEl;
    }

    const manilhaInfo = TrucoDeck.getManilhaInfo(card, this.engine.vira);
    if (manilhaInfo) {
      cardEl.classList.add('is-manilha');
      const emblem = document.createElement('div');
      emblem.className = 'manilha-emblem';
      emblem.textContent = manilhaInfo.nickname;
      cardEl.appendChild(emblem);
    }

    const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? '#e63946' : '#1e293b';

    cardEl.innerHTML += `
      <div class="card-corner-index" style="color: ${color};">
        <span class="card-value">${card.rank}</span>
        <span class="card-suit-symbol">${card.suitSymbol}</span>
      </div>
      <div class="card-center-icon" style="color: ${color};">
        ${card.suitSymbol}
      </div>
      <div class="card-corner-index inverted" style="color: ${color};">
        <span class="card-value">${card.rank}</span>
        <span class="card-suit-symbol">${card.suitSymbol}</span>
      </div>
    `;

    return cardEl;
  }

  updateScoreboard() {
    this.scoreTeam0.textContent = this.engine.scores[0];
    this.scoreTeam1.textContent = this.engine.scores[1];

    const currentStage = TrucoConstants.BET_STAGES.find(s => s.value === this.engine.currentStake);
    const stakeText = currentStage ? currentStage.label.toUpperCase() : `${this.engine.currentStake} PONTOS`;
    this.currentStakeBadge.textContent = `VALE ${this.engine.currentStake} (${stakeText})`;

    this.trickDots.forEach((dot, idx) => {
      dot.className = 'trick-pip';
      if (idx < this.engine.roundWinners.length) {
        const winner = this.engine.roundWinners[idx];
        if (winner === 0) dot.classList.add('won-nos');
        else if (winner === 1) dot.classList.add('won-eles');
        else dot.classList.add('tie');
      }
    });
  }

  updateDealerAndTurnHighlights() {
    for (let i = 0; i < this.engine.numPlayers; i++) {
      const seat = document.getElementById(`seat-${i}`);
      const dealerBadge = document.getElementById(`dealerBadge-${i}`);
      if (seat) {
        seat.classList.toggle('is-active-turn', (i === this.engine.currentTurnIndex && !this.engine.handOver));
      }
      if (dealerBadge) {
        dealerBadge.style.display = (i === this.engine.dealerIndex) ? 'flex' : 'none';
      }
    }
  }

  updateActionButtons() {
    const myTeam = this.engine.players[this.myPlayerIndex].team;
    const currentStage = TrucoConstants.BET_STAGES.find(s => s.value === this.engine.currentStake);
    const canRequestBet = (
      !this.engine.pendingBet &&
      !this.engine.isMaoDeOnze &&
      !this.engine.isMaoDeFerro &&
      this.engine.lastBettorTeam !== myTeam &&
      currentStage && currentStage.nextValue !== null
    );

    this.btnTruco.style.display = canRequestBet ? 'block' : 'none';
    if (canRequestBet) {
      this.btnTruco.textContent = `Pedir ${currentStage.nextLabel}!`;
    }

    this.btnCoverToggle.style.display = (this.engine.currentRound > 0 && !this.engine.isMaoDeFerro) ? 'flex' : 'none';
  }

  // ==========================================
  // JOGADAS E APOSTAS
  // ==========================================

  handlePlayCard(cardId) {
    if (this.engine.currentTurnIndex !== this.myPlayerIndex) {
      this.showToast('Aguarde a sua vez de jogar!', 'warning');
      return;
    }

    const isCovered = this.coverNextCard;
    const res = this.engine.playCard(this.myPlayerIndex, cardId, isCovered);

    if (res.error) {
      this.showToast(res.error, 'warning');
      return;
    }

    this.coverNextCard = false;
    this.btnCoverToggle.classList.remove('active');

    window.TrucoAudio.playCardSlide();
    this.renderCardOnTable(res.played);
    this.renderMyHand();
    this.updateDealerAndTurnHighlights();
    this.updateActionButtons();

    if (!this.isSinglePlayer && this.network) {
      const playMsg = {
        type: 'CARD_PLAYED',
        playerIndex: this.myPlayerIndex,
        cardId: cardId,
        isCovered: isCovered
      };
      if (this.network.isHost) {
        this.network.broadcast(playMsg);
      } else {
        this.network.sendToHost(playMsg);
      }
    }

    if (res.vasaComplete) {
      this.handleVasaComplete(res.vasaResult);
    } else {
      this.checkNextTurnAction();
    }
  }

  renderCardOnTable(playedRecord) {
    // Remove o placeholder se houver
    const placeholder = this.trickDropzone.querySelector('.trick-tabletop-label');
    if (placeholder) placeholder.style.display = 'none';

    const cardEl = this.createCardElement(playedRecord.card, playedRecord.isCovered);
    cardEl.classList.add('played-trick-card');

    // Adiciona o selo com o nome de quem jogou
    const authorPill = document.createElement('div');
    authorPill.className = 'played-card-author';
    authorPill.textContent = playedRecord.playerName;
    cardEl.appendChild(authorPill);

    const cardsCount = this.trickDropzone.querySelectorAll('.played-trick-card').length;
    const randomRot = (Math.random() * 16 - 8);
    const offsetX = (cardsCount * 36) - 50;
    cardEl.style.transform = `translateX(${offsetX}px) rotate(${randomRot}deg)`;

    this.trickDropzone.appendChild(cardEl);
  }

  handleVasaComplete(vasaResult) {
    this.updateScoreboard();

    if (vasaResult.isCanga) {
      this.triggerEventBanner('CANGA!', 'Empate na vasa!');
      window.TrucoAudio.playCangaBell();
    }

    if (vasaResult.handFinished) {
      setTimeout(() => {
        this.handleHandFinished(vasaResult.handSummary);
      }, 1400);
    } else {
      setTimeout(() => {
        this.trickDropzone.innerHTML = '<span class="trick-tabletop-label">Área de Vasa</span>';
        this.updateDealerAndTurnHighlights();
        this.updateActionButtons();
        this.checkNextTurnAction();
      }, 1500);
    }
  }

  handleHandFinished(handSummary) {
    const isMyTeamWinner = (handSummary.winningTeam === this.engine.players[this.myPlayerIndex].team);
    const points = this.engine.currentStake;

    if (isMyTeamWinner) {
      window.TrucoAudio.playWinChime();
      this.triggerEventBanner('VITÓRIA NA MÃO!', `Sua equipe marcou +${points} pontos!`);
    } else {
      this.triggerEventBanner('DERROTA NA MÃO', `Adversários marcaram +${points} pontos.`);
    }

    if (this.engine.gameOver) {
      setTimeout(() => {
        const isChamp = (this.engine.winningTeam === this.engine.players[this.myPlayerIndex].team);
        this.triggerEventBanner(
          isChamp ? 'CAMPEÕES DA PARTIDA!' : 'FIM DE JOGO!',
          isChamp ? 'Parabéns! Vocês fecharam os 12 pontos!' : 'A equipe adversária fechou os 12 pontos.'
        );
      }, 2000);
      return;
    }

    setTimeout(() => {
      this.startRoundHand();
    }, 2500);
  }

  // ==========================================
  // PEDIDOS DE TRUCO / AUMENTOS
  // ==========================================

  handlePlayerRequestBet() {
    const res = this.engine.requestBet(this.myPlayerIndex);
    if (res.error) {
      this.showToast(res.error, 'warning');
      return;
    }

    window.TrucoAudio.playTableThump();
    this.table.classList.add('thump-active');
    setTimeout(() => this.table.classList.remove('thump-active'), 400);

    const label = res.pendingBet.targetLabel;
    this.sendSpeechBubble(this.myPlayerIndex, `${label.toUpperCase()}! 🔥`);
    this.triggerEventBanner(`${label.toUpperCase()}!`, `${this.engine.players[this.myPlayerIndex].name} pediu ${label}!`);

    this.updateActionButtons();

    if (!this.isSinglePlayer && this.network) {
      const msg = { type: 'BET_REQUEST', playerIndex: this.myPlayerIndex };
      if (this.network.isHost) {
        this.network.broadcast(msg);
      } else {
        this.network.sendToHost(msg);
      }
    }

    this.checkBotBetResponse();
  }

  showBetResponseUI(pendingBet) {
    const myTeam = this.engine.players[this.myPlayerIndex].team;
    if (pendingBet.requestedByTeam === myTeam) {
      this.betResponseBar.style.display = 'none';
      return;
    }

    this.betResponseBar.style.display = 'flex';
    this.betNoticeText.textContent = `PEDIRAM ${pendingBet.targetLabel.toUpperCase()}!`;

    const nextStage = TrucoConstants.BET_STAGES.find(s => s.value === pendingBet.targetStake);
    if (nextStage && nextStage.nextLabel) {
      this.btnRaiseBet.style.display = 'block';
      this.btnRaiseBet.textContent = `Pedir ${nextStage.nextLabel}!`;
    } else {
      this.btnRaiseBet.style.display = 'none';
    }
  }

  handlePlayerRespondBet(action) {
    const res = this.engine.respondBet(this.myPlayerIndex, action);
    if (res.error) {
      this.showToast(res.error, 'warning');
      return;
    }

    this.betResponseBar.style.display = 'none';

    if (action === 'refuse') {
      this.sendSpeechBubble(this.myPlayerIndex, 'Corro! 🏃');
      this.showToast('Você correu do pedido de aposta.');
      this.handleHandFinished({ winningTeam: res.winningTeam });
    } else if (action === 'accept') {
      window.TrucoAudio.playTableThump();
      this.sendSpeechBubble(this.myPlayerIndex, 'Cai pra dentro! 💪');
      this.triggerEventBanner('ACEITO!', `Mão agora vale ${res.newStake} pontos!`);
      this.updateScoreboard();
      this.updateActionButtons();
      this.checkNextTurnAction();
    } else if (action === 'raise') {
      window.TrucoAudio.playTableThump();
      this.table.classList.add('thump-active');
      setTimeout(() => this.table.classList.remove('thump-active'), 400);

      const label = res.pendingBet.targetLabel;
      this.sendSpeechBubble(this.myPlayerIndex, `${label.toUpperCase()}! 🔥`);
      this.triggerEventBanner(`${label.toUpperCase()}!`, `Aposta aumentada para ${label}!`);
      this.updateScoreboard();
      this.updateActionButtons();
      this.checkBotBetResponse();
    }

    if (!this.isSinglePlayer && this.network) {
      const msg = { type: 'BET_RESPONSE', playerIndex: this.myPlayerIndex, action: action };
      if (this.network.isHost) {
        this.network.broadcast(msg);
      } else {
        this.network.sendToHost(msg);
      }
    }
  }

  handleMaoDeOnzeDecision(play) {
    this.closeModals();
    const res = this.engine.decideMaoDeOnze(this.myPlayerIndex, play);
    if (res.error) {
      this.showToast(res.error, 'warning');
      return;
    }

    if (!play) {
      this.sendSpeechBubble(this.myPlayerIndex, 'Vamos fugir! 🏃');
      this.handleHandFinished({ winningTeam: res.winningTeam });
    } else {
      this.sendSpeechBubble(this.myPlayerIndex, 'Vamos pro jogo! ⚔️');
      this.triggerEventBanner('MÃO DE ONZE ACEITA', 'A rodada está valendo 3 pontos!');
      this.updateScoreboard();
      this.checkNextTurnAction();
    }

    if (!this.isSinglePlayer && this.network) {
      const msg = { type: 'MAO_DE_ONZE_DECISION', playerIndex: this.myPlayerIndex, play: play };
      if (this.network.isHost) {
        this.network.broadcast(msg);
      } else {
        this.network.sendToHost(msg);
      }
    }
  }

  // ==========================================
  // INTELIGÊNCIA DOS BOTS
  // ==========================================

  checkNextTurnAction() {
    if (this.engine.handOver || this.engine.gameOver) return;

    const currentIdx = this.engine.currentTurnIndex;
    const player = this.engine.players[currentIdx];

    if (player.isBot) {
      const bot = this.bots[currentIdx];
      if (!bot) return;

      setTimeout(() => {
        if (bot.shouldRequestTruco()) {
          const betRes = this.engine.requestBet(currentIdx);
          if (!betRes.error) {
            window.TrucoAudio.playTableThump();
            this.table.classList.add('thump-active');
            setTimeout(() => this.table.classList.remove('thump-active'), 400);

            const label = betRes.pendingBet.targetLabel;
            this.sendSpeechBubble(currentIdx, `${label.toUpperCase()}! 🔥`);
            this.triggerEventBanner(`${label.toUpperCase()}!`, `${player.name} pediu ${label}!`);

            this.showBetResponseUI(betRes.pendingBet);
            return;
          }
        }

        const choice = bot.chooseCardToPlay();
        if (choice) {
          const res = this.engine.playCard(currentIdx, choice.cardId, choice.isCovered);
          if (!res.error) {
            window.TrucoAudio.playCardSlide();
            this.renderCardOnTable(res.played);
            this.renderMyHand();
            this.updateDealerAndTurnHighlights();
            this.updateActionButtons();

            if (res.vasaComplete) {
              this.handleVasaComplete(res.vasaResult);
            } else {
              this.checkNextTurnAction();
            }
          }
        }
      }, 900 + Math.random() * 400);
    }
  }

  checkBotBetResponse() {
    if (!this.engine.pendingBet) return;

    const bet = this.engine.pendingBet;
    const respondingTeam = 1 - bet.requestedByTeam;

    const botIdx = this.engine.players.findIndex(p => p.team === respondingTeam && p.isBot);
    if (botIdx === -1) {
      this.showBetResponseUI(bet);
      return;
    }

    const bot = this.bots[botIdx];
    setTimeout(() => {
      const action = bot.decideBetResponse();
      const res = this.engine.respondBet(botIdx, action);

      if (action === 'refuse') {
        this.sendSpeechBubble(botIdx, 'Deixa quieto, é sua! 🏃');
        this.handleHandFinished({ winningTeam: res.winningTeam });
      } else if (action === 'accept') {
        window.TrucoAudio.playTableThump();
        this.sendSpeechBubble(botIdx, 'Pode vir quente! 🔥');
        this.triggerEventBanner('ACEITO!', `Mão agora vale ${res.newStake} pontos!`);
        this.updateScoreboard();
        this.updateActionButtons();
        this.checkNextTurnAction();
      } else if (action === 'raise') {
        window.TrucoAudio.playTableThump();
        this.table.classList.add('thump-active');
        setTimeout(() => this.table.classList.remove('thump-active'), 400);

        const label = res.pendingBet.targetLabel;
        this.sendSpeechBubble(botIdx, `${label.toUpperCase()}! 🔥`);
        this.triggerEventBanner(`${label.toUpperCase()}!`, `${this.engine.players[botIdx].name} aumentou para ${label}!`);
        this.updateScoreboard();
        this.updateActionButtons();
        this.showBetResponseUI(res.pendingBet);
      }
    }, 1100);
  }

  checkBotMaoDeOnzeDecision(team) {
    const botIdx = this.engine.players.findIndex(p => p.team === team && p.isBot);
    if (botIdx === -1) return;

    const bot = this.bots[botIdx];
    setTimeout(() => {
      const willPlay = bot.decideMaoDeOnze();
      const res = this.engine.decideMaoDeOnze(botIdx, willPlay);
      if (!willPlay) {
        this.sendSpeechBubble(botIdx, 'Mão muito ruim, vaza! 🏃');
        this.handleHandFinished({ winningTeam: res.winningTeam });
      } else {
        this.sendSpeechBubble(botIdx, 'Bora pro jogo! ⚔️');
        this.triggerEventBanner('MÃO DE ONZE ACEITA', 'Os adversários resolveram encarar!');
        this.updateScoreboard();
        this.checkNextTurnAction();
      }
    }, 1300);
  }

  // ==========================================
  // MULTIPLAYER E MENSAGENS P2P
  // ==========================================

  handleNetworkPlayerJoined(peer) {
    for (let i = 1; i < this.engine.numPlayers; i++) {
      if (this.engine.players[i].isBot || this.engine.players[i].name.startsWith('Aguardando')) {
        this.engine.players[i].name = peer.name;
        this.engine.players[i].id = peer.peerId;
        this.engine.players[i].isBot = false;
        this.bots[i] = null;
        break;
      }
    }
    this.renderSeats();
    this.syncGameStateToClients();
  }

  handleNetworkMessage(data, fromPeerId = null) {
    if (data.type === 'CHAT') {
      this.sendSpeechBubble(data.playerIndex, data.text);
      window.TrucoAudio.playNotification();
    } else if (data.type === 'CARD_PLAYED') {
      const res = this.engine.playCard(data.playerIndex, data.cardId, data.isCovered);
      if (!res.error) {
        window.TrucoAudio.playCardSlide();
        this.renderCardOnTable(res.played);
        this.renderMyHand();
        this.updateDealerAndTurnHighlights();
        this.updateActionButtons();
        if (res.vasaComplete) {
          this.handleVasaComplete(res.vasaResult);
        } else {
          this.checkNextTurnAction();
        }
      }
    } else if (data.type === 'BET_REQUEST') {
      const res = this.engine.requestBet(data.playerIndex);
      if (!res.error) {
        window.TrucoAudio.playTableThump();
        const label = res.pendingBet.targetLabel;
        this.sendSpeechBubble(data.playerIndex, `${label.toUpperCase()}! 🔥`);
        this.triggerEventBanner(`${label.toUpperCase()}!`, `Pedido de ${label}!`);
        this.showBetResponseUI(res.pendingBet);
      }
    } else if (data.type === 'BET_RESPONSE') {
      this.handlePlayerRespondBet(data.action);
    } else if (data.type === 'STATE_SYNC') {
      this.engine.scores = data.scores;
      this.engine.currentStake = data.currentStake;
      this.engine.vira = data.vira;
      this.engine.manilhaRank = data.manilhaRank;
      this.engine.dealerIndex = data.dealerIndex;
      this.engine.currentTurnIndex = data.currentTurnIndex;
      this.myPlayerIndex = data.assignedIndex;

      this.updateScoreboard();
      this.renderSeats();
      this.renderViraCard();
      this.renderMyHand();
      this.updateDealerAndTurnHighlights();
      this.updateActionButtons();
    }
  }

  syncGameStateToClients() {
    if (!this.network || !this.network.isHost) return;

    this.network.connections.forEach((conn, peerId) => {
      const pIdx = this.engine.players.findIndex(p => p.id === peerId);
      if (pIdx !== -1) {
        conn.send({
          type: 'STATE_SYNC',
          assignedIndex: pIdx,
          scores: [...this.engine.scores],
          currentStake: this.engine.currentStake,
          vira: this.engine.vira,
          manilhaRank: this.engine.manilhaRank,
          dealerIndex: this.engine.dealerIndex,
          currentTurnIndex: this.engine.currentTurnIndex
        });
      }
    });
  }

  // ==========================================
  // EFEITOS VISUAIS E UTILITÁRIOS
  // ==========================================

  sendSpeechBubble(playerIndex, text) {
    const bubble = document.getElementById(`speech-${playerIndex}`);
    if (bubble) {
      bubble.textContent = text;
      bubble.style.display = 'block';
      setTimeout(() => {
        bubble.style.display = 'none';
      }, 3500);
    }
  }

  triggerEventBanner(title, subtitle) {
    document.getElementById('eventBannerTitle').textContent = title;
    document.getElementById('eventBannerSubtitle').textContent = subtitle;
    this.eventBanner.classList.add('show-banner');
    setTimeout(() => {
      this.eventBanner.classList.remove('show-banner');
    }, 2200);
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new TrucoApp();
});
