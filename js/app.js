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

    // Timer de vez
    this._turnTimerInterval = null;
    this._turnTimerRemaining = 30;
    this._timerCircumference = 175.9; // 2*pi*28

    // Flag para evitar flash de cartas: CARD_PLAYED_EVENT já renderizou a mesa
    this._skipTableRender = false;
    this.isFadingTrickCards = false;
    this.trickFadeTimer = null;

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

    // Elementos do Baralho e Animações de Mesa
    this.tableDeckStation = document.getElementById('tableDeckStation');
    this.deckPile = document.getElementById('deckPile');
    this.deckShuffleRig = document.getElementById('deckShuffleRig');
    this.shuffleStatusBadge = document.getElementById('shuffleStatusBadge');
    this.isDealing = false;
    this._pendingDealAnimation = false;

    // Controles de ação
    this.btnTruco = document.getElementById('btnTruco');
    this.btnFold = document.getElementById('btnFold');
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

    // Chat rápido (removido - agora é painel lateral)
    this.btnQuickChat = null;
    this.quickChatList = null;

    // Timer overlay
    this.turnOverlay = document.getElementById('turnOverlay');
    this.turnCountdown = document.getElementById('turnCountdown');
    this.timerArc = document.getElementById('timerArc');

    // Chat panel
    this.chatPanel = document.getElementById('chatPanel');
    this.chatMessages = document.getElementById('chatMessages');
    this.chatInput = document.getElementById('chatInput');
    this.chatUnreadBadge = document.getElementById('chatUnreadBadge');
    this._chatOpen = false;
    this._chatUnread = 0;

    // Configuração solo
    this._soloNumPlayers = 4;

    // Fim de jogo e Revanche
    this.gameOverModal = document.getElementById('gameOverModal');
    this.btnPlayAgain = document.getElementById('btnPlayAgain');
    this.btnReturnLobby = document.getElementById('btnReturnLobby');
    this.seriesBadge0 = document.getElementById('seriesBadge0');
    this.seriesBadge1 = document.getElementById('seriesBadge1');
    this.seriesWins = [0, 0]; // [Vitórias Time 0, Vitórias Time 1]
  }

  bindEvents() {
    // Fim de jogo e Revanche
    this.btnPlayAgain?.addEventListener('click', () => {
      this.handlePlayAgain();
    });

    this.btnReturnLobby?.addEventListener('click', () => {
      this.handleReturnToLobby();
    });

    // Ações na mão
    this.btnCoverToggle?.addEventListener('click', () => {
      if (this.engine && this.engine.currentRound === 0) {
        this.showToast('Não é permitido encobrir carta na 1ª vasa!', 'warning');
        return;
      }
      this.coverNextCard = !this.coverNextCard;
      this.btnCoverToggle.classList.toggle('active', this.coverNextCard);
    });

    this.btnTruco?.addEventListener('click', () => {
      this.handlePlayerRequestBet();
    });

    this.btnFold?.addEventListener('click', () => {
      this.handlePlayerConcede();
    });

    this.btnAcceptBet?.addEventListener('click', () => {
      this.handlePlayerRespondBet('accept');
    });

    this.btnRefuseBet?.addEventListener('click', () => {
      this.handlePlayerRespondBet('refuse');
    });

    this.btnRaiseBet?.addEventListener('click', () => {
      this.handlePlayerRespondBet('raise');
    });

    // Mão de Onze
    document.getElementById('btnMaoDeOnzePlay')?.addEventListener('click', () => {
      this.handleMaoDeOnzeDecision(true);
    });

    document.getElementById('btnMaoDeOnzeRun')?.addEventListener('click', () => {
      this.handleMaoDeOnzeDecision(false);
    });

    document.getElementById('btnM11Peek')?.addEventListener('click', () => {
      this.toggleMaoDeOnzePeek();
    });

    // === CHAT PANEL ===
    document.getElementById('btnOpenChat')?.addEventListener('click', () => {
      this.toggleChatPanel();
    });

    document.getElementById('btnCloseChat')?.addEventListener('click', () => {
      this.closeChatPanel();
    });

    document.getElementById('btnChatSend')?.addEventListener('click', () => {
      this.handleChatSend();
    });

    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.handleChatSend(); }
    });

    // === SOLO MODAL ===
    document.querySelectorAll('#soloNumPlayers .segment-btn').forEach(btn => {
      btn?.addEventListener('click', () => {
        document.querySelectorAll('#soloNumPlayers .segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._soloNumPlayers = parseInt(btn.dataset.players, 10);
      });
    });

    document.getElementById('btnConfirmSolo')?.addEventListener('click', () => {
      const name = document.getElementById('soloPlayerName')?.value?.trim() || 'Você';
      this.startSoloGame(this._soloNumPlayers, name);
    });

    // Modais de Criação e Entrada
    document.getElementById('btnOpenCreateModal')?.addEventListener('click', () => {
      this.openModal(this.createRoomModal);
    });

    document.getElementById('btnOpenJoinModal')?.addEventListener('click', () => {
      this.openModal(this.joinRoomModal);
    });

    document.getElementById('btnOpenSoloModal')?.addEventListener('click', () => {
      this.openModal(document.getElementById('soloModal'));
    });

    document.getElementById('btnConfirmCreate')?.addEventListener('click', () => {
      this.handleCreateRoom();
    });

    document.getElementById('btnConfirmJoin')?.addEventListener('click', () => {
      this.handleJoinRoom();
    });

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn?.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });

    // Botão de copiar código da sala
    this.roomBadge?.addEventListener('click', () => {
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
      btn?.addEventListener('click', () => {
        document.querySelectorAll('#createNumPlayers .segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.roomConfig.numPlayers = parseInt(btn.dataset.players, 10);
      });
    });

    // Áudio toggle
    document.getElementById('btnToggleAudio')?.addEventListener('click', (e) => {
      window.TrucoAudio.muted = !window.TrucoAudio.muted;
      e.currentTarget.textContent = window.TrucoAudio.muted ? 'Mudo' : 'Som';
      this.showToast(window.TrucoAudio.muted ? 'Sons desativados' : 'Sons ativados');
    });
  }

  openModal(modal) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    modal.classList.add('active');
  }

  closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => {
      m.classList.remove('active');
      m.classList.remove('is-peeking');
    });
    const peekText = document.getElementById('m11PeekText');
    const peekIcon = document.getElementById('m11PeekIcon');
    if (peekText) peekText.textContent = 'Espiar Mesa';
    if (peekIcon) peekIcon.textContent = 'Espiar';
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

  startSoloGame(numPlayers = 4, playerName = 'Você') {
    this.isSinglePlayer = true;
    this.closeModals();
    this.myPlayerIndex = 0;
    this.roomConfig.id = 'SOLO';
    this.roomConfig.numPlayers = numPlayers;
    this.seriesWins = [0, 0];
    this.updateSeriesHUD();

    this.roomBadge.style.display = 'flex';
    this.roomBadgeText.textContent = `SOLO (${numPlayers}P)`;

    const playerConfigs = [
      { id: 'me', name: playerName, isBot: false }
    ];

    const botNames = ['Chico Bento', 'Zeca Mão de Onze', 'Pedrão do Zap', 'Tião Carreiro', 'Tonho'];
    for (let i = 1; i < numPlayers; i++) {
      playerConfigs.push({
        id: `bot_${i}`,
        name: botNames[i - 1] || `Bot ${i}`,
        isBot: true
      });
    }

    this.addChatMessage('system', '', `Partida iniciada — ${numPlayers} jogadores`);
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
    this.seriesWins = [0, 0];
    this.updateSeriesHUD();
    this.roomConfig.fillBots = fillBots;

    this.showToast('Iniciando sala...', 'info');

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

      const hasWaiting = !fillBots;
      this.setupEngineAndBots(this.roomConfig.numPlayers, playerConfigs, !hasWaiting);
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

    // ── MODO DEBUG ──────────────────────────────────────────────────────────
    if (roomId === 'DEBUGGER') {
      this.closeModals();
      this.isSinglePlayer = true;
      this.myPlayerIndex = 0;
      this.roomConfig.id = 'DEBUG';
      this.roomConfig.numPlayers = 4;
      this.seriesWins = [0, 0];
      this.updateSeriesHUD();

      this.roomBadge.style.display = 'flex';
      this.roomBadgeText.textContent = 'DEBUG';

      const debugPlayers = [
        { id: 'me', name: playerName || 'Dev', isBot: false },
        { id: 'bot_1', name: 'Bot Alpha', isBot: true },
        { id: 'bot_2', name: 'Bot Beta', isBot: true },
        { id: 'bot_3', name: 'Bot Gamma', isBot: true },
      ];

      this.setupEngineAndBots(4, debugPlayers, false);

      // Forçar placar 11×0 → Mão de Onze no próximo startNewHand
      this.engine.scores = [11, 0];

      this.addChatMessage('system', '', 'Modo DEBUG ativo — placar 11×0, Mão de Onze garantida');
      this.startRoundHand({ animate: true, isFirstRound: true });

      this.triggerEventBanner('DEBUG MODE', 'Placar 11×0 — Mão de Onze ativa!');
      this.showToast('Modo Debug ativado!', 'success');
      return;
    }
    // ────────────────────────────────────────────────────────────────────────

    this.showToast('Conectando à mesa...', 'info');

    this.network = new TrucoNetwork({
      onError: (err) => {
        this.showToast(`Erro de conexão: ${err.message || err}`, 'error');
      },
      onDisconnect: (reason) => {
        this.showToast(reason, 'error');
      },
      onMessage: (data, fromPeerId) => {
        this.handleNetworkMessage(data, fromPeerId);
      }
    });

    try {
      this.isSinglePlayer = false;
      await this.network.joinRoom(roomId, password, playerName);
      this.closeModals();
      this.roomConfig.id = roomId;
      this.roomBadge.style.display = 'flex';
      this.roomBadgeText.textContent = `SALA: ${roomId}`;
      this.showToast('Conectado à partida! Sincronizando mesa...', 'success');
      this.triggerEventBanner('CONECTADO!', `Sincronizando mesa com o criador da sala...`);
    } catch (err) {
      this.showToast(`Falha ao conectar: ${err.message}`, 'error');
    }
  }

  setupEngineAndBots(numPlayers, playerConfigs, autoStart = true) {
    this.engine = new TrucoEngine({ numPlayers });
    this.engine.initPlayers(playerConfigs);

    this.bots = [];
    for (let i = 0; i < numPlayers; i++) {
      if (this.engine.players[i].isBot) {
        this.bots[i] = new TrucoBot(i, this.engine);
      }
    }

    this.renderSeats();
    if (autoStart) {
      this.startRoundHand({ animate: true, isFirstRound: true });
    } else {
      this.triggerEventBanner('SALA ABERTA!', `Aguardando jogadores entrarem (código: ${this.roomConfig.id})...`);
    }
  }

  // ==========================================
  // RENDERIZAÇÃO DA ARENA E CARTAS
  // ==========================================

  renderSeats() {
    this.seatsContainer.innerHTML = '';
    if (!this.engine || !this.engine.players) return;
    const numPlayers = this.engine.numPlayers;
    this.table.className = `truco-arena layout-${numPlayers}`;

    for (let i = 0; i < numPlayers; i++) {
      const player = this.engine.players[i];
      if (!player) continue;
      const isMe = (i === this.myPlayerIndex);
      const relPos = (i - this.myPlayerIndex + numPlayers) % numPlayers;
      const seat = document.createElement('div');
      seat.className = `player-seat seat-${i} seat-pos-${relPos} team-${player.team}`;
      seat.id = `seat-${i}`;

      const avatarLetter = (player.name && player.name.trim().length > 0) ? player.name.trim().charAt(0).toUpperCase() : '?';
      const cardCount = player.hand ? player.hand.length : 3;

      seat.innerHTML = `
        <div class="seat-avatar-wrap">
          <div class="chat-shout-bubble" id="speech-${i}" style="display: none;"></div>
          <div class="seat-avatar">${avatarLetter}</div>
          <div class="dealer-chip" id="dealerBadge-${i}" style="display: none;">D</div>
        </div>
        <div class="seat-tag">${player.name}</div>
        ${!isMe ? `
          <div class="seat-hand-mini" id="seatBacks-${i}">
            ${Array.from({ length: cardCount }).map(() => '<div class="mini-card"></div>').join('')}
          </div>
        ` : ''}
      `;

      this.seatsContainer.appendChild(seat);
    }
  }

  getDeckCenter() {
    if (this.tableDeckStation) {
      const rect = this.tableDeckStation.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
    }
    if (this.table) {
      const tableRect = this.table.getBoundingClientRect();
      return { x: tableRect.left + tableRect.width / 2, y: tableRect.top + tableRect.height / 2 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  animateCollectCards(callback) {
    if (!this.table) {
      callback?.();
      return;
    }

    const { x: deckX, y: deckY } = this.getDeckCenter();
    const cardsToCollect = [];

    // 1. Cartas jogadas no tapete de descarte
    this.trickDropzone?.querySelectorAll('.played-trick-card')?.forEach(el => cardsToCollect.push(el));
    // 2. Carta na área da vira
    this.viraContainer?.querySelectorAll('.card-item')?.forEach(el => cardsToCollect.push(el));
    // 3. Cartas remanescentes na mão do jogador
    this.myHandElement?.querySelectorAll('.card-item')?.forEach(el => cardsToCollect.push(el));
    // 4. Mini cartas dos assentos
    this.seatsContainer?.querySelectorAll('.mini-card')?.forEach(el => cardsToCollect.push(el));

    if (cardsToCollect.length === 0) {
      if (this.deckPile) this.deckPile.style.display = 'block';
      callback?.();
      return;
    }

    window.TrucoAudio?.playCardCollect?.();

    const flights = [];
    cardsToCollect.forEach(cardEl => {
      const rect = cardEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const flight = document.createElement('div');
      flight.className = 'flight-card card-back-copag';
      flight.style.left = `${rect.left}px`;
      flight.style.top = `${rect.top}px`;
      flight.style.width = `${rect.width}px`;
      flight.style.height = `${rect.height}px`;
      flight.style.transition = 'transform 0.44s cubic-bezier(0.2, 0.8, 0.25, 1), opacity 0.4s ease';
      document.body.appendChild(flight);
      flights.push({ el: flight, rect });

      cardEl.style.visibility = 'hidden';
    });

    // Limpa os recipientes na mesa
    if (this.trickDropzone) {
      this.trickDropzone.innerHTML = '<span class="trick-tabletop-label">Área de Vasa</span>';
    }
    if (this.viraContainer) this.viraContainer.innerHTML = '';
    this.updateTopRightManilhasHUD(null);
    if (this.myHandElement) this.myHandElement.innerHTML = '';
    document.querySelectorAll('.seat-hand-mini').forEach(el => el.innerHTML = '');

    requestAnimationFrame(() => {
      flights.forEach(({ el, rect }) => {
        const dx = deckX - (rect.left + rect.width / 2);
        const dy = deckY - (rect.top + rect.height / 2);
        const rot = (Math.random() * 24 - 12);
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.65) rotate(${rot}deg)`;
        el.style.opacity = '0.85';
      });
    });

    setTimeout(() => {
      flights.forEach(f => f.el.remove());
      if (this.deckPile) this.deckPile.style.display = 'block';
      callback?.();
    }, 450);
  }

  animateShuffleDeck(callback) {
    window.TrucoAudio?.playCardShuffle?.();

    if (this.deckPile) this.deckPile.style.display = 'none';
    if (this.deckShuffleRig) {
      this.deckShuffleRig.style.display = 'block';
      this.deckShuffleRig.classList.add('active');
    }
    if (this.shuffleStatusBadge) {
      this.shuffleStatusBadge.classList.add('visible');
    }

    setTimeout(() => {
      if (this.deckShuffleRig) {
        this.deckShuffleRig.classList.remove('active');
        this.deckShuffleRig.style.display = 'none';
      }
      if (this.shuffleStatusBadge) {
        this.shuffleStatusBadge.classList.remove('visible');
      }
      if (this.deckPile) {
        this.deckPile.style.display = 'block';
      }
      callback?.();
    }, 1250);
  }

  animateDealCards(callback) {
    if (!this.engine || !this.engine.players) {
      this.isDealing = false;
      callback?.();
      return;
    }

    this.isDealing = true;
    const numPlayers = this.engine.numPlayers;
    const starter = this.engine.handStarterIndex || 0;
    const { x: deckX, y: deckY } = this.getDeckCenter();

    // Limpa assentos e mãos para receber as cartas que estão chegando
    document.querySelectorAll('.seat-hand-mini').forEach(el => el.innerHTML = '');
    if (this.myHandElement) this.myHandElement.innerHTML = '';
    if (this.viraContainer) this.viraContainer.innerHTML = '';
    this.updateTopRightManilhasHUD(null);

    // Monta a ordem de entrega: 3 voltas na mesa (1 carta para cada jogador por volta) + vira
    const dealQueue = [];
    for (let round = 0; round < 3; round++) {
      for (let p = 0; p < numPlayers; p++) {
        const playerIdx = (starter + p) % numPlayers;
        dealQueue.push({ type: 'player', playerIndex: playerIdx, cardRound: round });
      }
    }
    dealQueue.push({ type: 'vira' });

    const isBlindHand = !!this.engine.isMaoDeFerro;
    const myHandCards = (this.engine.players[this.myPlayerIndex] && this.engine.players[this.myPlayerIndex].hand)
      ? this.engine.players[this.myPlayerIndex].hand
      : [];

    dealQueue.forEach((item, seqIndex) => {
      const delay = seqIndex * 70;

      setTimeout(() => {
        const pitchMod = 0.8 + (seqIndex / dealQueue.length) * 0.5;
        window.TrucoAudio?.playCardDeal?.(pitchMod);

        const flight = document.createElement('div');
        flight.className = 'flight-card card-back-copag';
        flight.style.left = `${deckX - 35}px`;
        flight.style.top = `${deckY - 51}px`;
        flight.style.width = '70px';
        flight.style.height = '102px';
        document.body.appendChild(flight);

        let destX = deckX;
        let destY = deckY;
        let isMini = false;

        if (item.type === 'player') {
          if (item.playerIndex === this.myPlayerIndex) {
            const trayRect = this.myHandElement.getBoundingClientRect();
            const cardW = 78;
            const gap = 12;
            const totalW = 3 * cardW + 2 * gap;
            const startX = trayRect.left + (trayRect.width - totalW) / 2;
            destX = startX + item.cardRound * (cardW + gap) + cardW / 2;
            destY = trayRect.top + trayRect.height / 2;
          } else {
            isMini = true;
            flight.classList.add('target-mini');
            const seatEl = document.getElementById(`seatBacks-${item.playerIndex}`) || document.getElementById(`seat-${item.playerIndex}`);
            if (seatEl) {
              const sRect = seatEl.getBoundingClientRect();
              destX = sRect.left + sRect.width / 2;
              destY = sRect.top + sRect.height / 2;
            }
          }
        } else if (item.type === 'vira') {
          const vMat = this.viraContainer.getBoundingClientRect();
          if (vMat.width > 0 && vMat.height > 0) {
            destX = vMat.left + vMat.width / 2;
            destY = vMat.top + vMat.height / 2;
          } else {
            destX = deckX + 105;
            destY = deckY;
          }
        }

        requestAnimationFrame(() => {
          const dx = destX - deckX;
          const dy = destY - deckY;
          if (isMini) {
            flight.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.24) rotate(0deg)`;
          } else if (item.type === 'vira') {
            flight.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.0) rotate(-6deg)`;
          } else {
            flight.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.05) rotate(0deg)`;
          }
        });

        const landDuration = isMini ? 320 : 360;
        setTimeout(() => {
          flight.remove();

          if (item.type === 'player') {
            if (item.playerIndex === this.myPlayerIndex) {
              const cardData = myHandCards[item.cardRound];
              if (cardData) {
                const cardEl = this.createCardElement(cardData, isBlindHand);
                cardEl.classList.add('deal-animated');
                cardEl.addEventListener('click', () => {
                  this.handlePlayCard(cardData.id);
                });
                this.myHandElement.appendChild(cardEl);
              }
            } else {
              const seatMiniTray = document.getElementById(`seatBacks-${item.playerIndex}`);
              if (seatMiniTray) {
                const mini = document.createElement('div');
                mini.className = 'mini-card';
                seatMiniTray.appendChild(mini);
              }
            }
          } else if (item.type === 'vira') {
            this.renderViraCard();
            const vBox = this.viraContainer.querySelector('.vira-card-box');
            if (vBox) vBox.classList.add('deal-reveal');
          }

          // Se for o último item da fila, conclui a animação
          if (seqIndex === dealQueue.length - 1) {
            setTimeout(() => {
              this.isDealing = false;
              callback?.();
            }, 200);
          }
        }, landDuration);
      }, delay);
    });
  }

  startRoundHand(options = { animate: true, isFirstRound: false }) {
    if (options && options.isFirstRound) {
      this.startFirstRoundWithShuffleAndDeal();
      return;
    }

    const handState = this.engine.startNewHand();
    this.stopTurnTimer();
    this.isDealing = true;

    if (this.trickFadeTimer) {
      clearTimeout(this.trickFadeTimer);
      this.trickFadeTimer = null;
    }
    this.isFadingTrickCards = false;

    // Limpa a mesa de descarte mantendo o label
    this.trickDropzone.innerHTML = '<span class="trick-tabletop-label">Área de Vasa</span>';
    this.coverNextCard = false;
    this.btnCoverToggle.classList.remove('active');
    this.betResponseBar.style.display = 'none';

    this.updateScoreboard();
    this.updateDealerAndTurnHighlights();
    this.updateActionButtons();

    if (!this.isSinglePlayer && this.network && this.network.isHost) {
      this.network.broadcast({
        type: 'ROUND_DEAL_START',
        handState: {
          dealerIndex: this.engine.dealerIndex,
          handStarterIndex: this.engine.handStarterIndex
        }
      });
      this.syncGameStateToClients();
    }

    if (options && options.animate === false) {
      this.isDealing = false;
      this.renderViraCard();
      this.renderMyHand();
      this.finalizeHandStart(handState);
    } else {
      this.animateDealCards(() => {
        this.finalizeHandStart(handState);
      });
    }
  }

  startFirstRoundWithShuffleAndDeal() {
    const handState = this.engine.startNewHand();
    this.stopTurnTimer();
    this.isDealing = true;

    this.trickDropzone.innerHTML = '<span class="trick-tabletop-label">Área de Vasa</span>';
    this.viraContainer.innerHTML = '';
    this.updateTopRightManilhasHUD(null);
    this.myHandElement.innerHTML = '';
    this.coverNextCard = false;
    this.btnCoverToggle.classList.remove('active');
    this.betResponseBar.style.display = 'none';

    this.updateScoreboard();
    this.updateDealerAndTurnHighlights();
    this.updateActionButtons();

    if (!this.isSinglePlayer && this.network && this.network.isHost) {
      this.network.broadcast({
        type: 'ROUND_COLLECT_SHUFFLE_EVENT',
        isFirstRound: true
      });
      this.syncGameStateToClients();
    }

    this.animateShuffleDeck(() => {
      this.animateDealCards(() => {
        this.finalizeHandStart(handState);
      });
    });
  }

  finalizeHandStart(handState) {
    this.isDealing = false;
    this.renderViraCard();
    this.renderMyHand();
    this.updateDealerAndTurnHighlights();
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
        this.renderMaoDeOnzeModal();
        this.openModal(this.maoDeOnzeModal);
      } else {
        this.checkBotMaoDeOnzeDecision(handState.maoDeOnzeTeam);
      }
    }

    this.checkNextTurnAction();
  }

  renderViraCard() {
    this.viraContainer.innerHTML = '';
    const vira = this.engine ? this.engine.vira : null;
    if (!vira) {
      this.updateTopRightManilhasHUD(null);
      return;
    }

    const manilhaRank = this.engine.manilhaRank;
    this.updateTopRightManilhasHUD(manilhaRank);

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

  updateTopRightManilhasHUD(manilhaRank = null) {
    const widget = document.getElementById('hudManilhasWidget');
    if (!widget) return;

    if (!manilhaRank && this.engine) {
      manilhaRank = this.engine.manilhaRank;
    }

    const cardZap = document.getElementById('hudCardZap');
    const cardCopeta = document.getElementById('hudCardCopeta');
    const cardEspadilha = document.getElementById('hudCardEspadilha');
    const cardOuros = document.getElementById('hudCardOuros');

    if (!manilhaRank) {
      widget.classList.add('is-empty');
      const headerRankEl = document.getElementById('hudManilhaHeaderRank');
      if (headerRankEl) headerRankEl.textContent = '—';
      const rankEls = widget.querySelectorAll('.m-rank');
      rankEls.forEach(el => { el.textContent = '—'; });

      if (cardZap) cardZap.title = '1ª maior: Zap — Paus (♣)';
      if (cardCopeta) cardCopeta.title = '2ª maior: Copeta — Copas (♥)';
      if (cardEspadilha) cardEspadilha.title = '3ª maior: Espadilha — Espadas (♠)';
      if (cardOuros) cardOuros.title = '4ª maior: Pica-fumo / Ouros — Ouros (♦)';
      return;
    }

    widget.classList.remove('is-empty');

    const headerRankEl = document.getElementById('hudManilhaHeaderRank');
    if (headerRankEl) headerRankEl.textContent = manilhaRank;

    const rankEls = widget.querySelectorAll('.m-rank');
    rankEls.forEach(el => {
      el.textContent = manilhaRank;
    });

    if (cardZap) cardZap.title = `1ª maior: ♣ ${manilhaRank} — Paus (Zap)`;
    if (cardCopeta) cardCopeta.title = `2ª maior: ♥ ${manilhaRank} — Copeta (Copas)`;
    if (cardEspadilha) cardEspadilha.title = `3ª maior: ♠ ${manilhaRank} — Espadilha (Espadas)`;
    if (cardOuros) cardOuros.title = `4ª maior: ♦ ${manilhaRank} — Pica-fumo / Ouros`;
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
    if (!this.engine) return;
    const myPlayer = (this.engine.players && this.engine.players[this.myPlayerIndex]) ? this.engine.players[this.myPlayerIndex] : null;
    const myTeam = myPlayer ? myPlayer.team : 0;
    const oppTeam = 1 - myTeam;

    // NÓS sempre mostra a pontuação da equipe do jogador atual
    this.scoreTeam0.textContent = (this.engine.scores && this.engine.scores[myTeam] !== undefined) ? this.engine.scores[myTeam] : 0;
    // ELES sempre mostra a pontuação da equipe adversária
    this.scoreTeam1.textContent = (this.engine.scores && this.engine.scores[oppTeam] !== undefined) ? this.engine.scores[oppTeam] : 0;

    const currentStage = TrucoConstants.BET_STAGES.find(s => s.value === this.engine.currentStake);
    const stakeText = currentStage ? currentStage.label.toUpperCase() : `${this.engine.currentStake} PONTOS`;
    this.currentStakeBadge.textContent = `VALE ${this.engine.currentStake} (${stakeText})`;

    this.trickDots.forEach((dot, idx) => {
      dot.className = 'trick-pip';
      if (this.engine.roundWinners && idx < this.engine.roundWinners.length) {
        const winner = this.engine.roundWinners[idx];
        if (winner === myTeam) dot.classList.add('won-nos');
        else if (winner === oppTeam) dot.classList.add('won-eles');
        else if (winner === -1) dot.classList.add('tie');
      }
    });

    this.updateSeriesHUD();
  }

  updateDealerAndTurnHighlights() {
    if (!this.engine) return;
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
    if (this.isDealing) {
      if (this.btnTruco) this.btnTruco.style.display = 'none';
      if (this.btnFold) this.btnFold.style.display = 'none';
      if (this.btnCoverToggle) this.btnCoverToggle.style.display = 'none';
      return;
    }
    if (!this.engine || !this.engine.players || !this.engine.players[this.myPlayerIndex]) return;
    const myTeam = this.engine.players[this.myPlayerIndex].team;
    const currentStage = TrucoConstants.BET_STAGES.find(s => s.value === this.engine.currentStake);
    const canRequestBet = (
      !this.engine.pendingBet &&
      !this.engine.isMaoDeOnze &&
      !this.engine.isMaoDeFerro &&
      !this.engine.handOver &&
      !this.engine.gameOver &&
      this.engine.lastBettorTeam !== myTeam &&
      currentStage && currentStage.nextValue !== null
    );

    this.btnTruco.style.display = canRequestBet ? 'block' : 'none';
    if (canRequestBet) {
      this.btnTruco.textContent = `Pedir ${currentStage.nextLabel}!`;
    }

    const canConcede = (
      this.engine.currentRound > 0 &&
      !this.engine.handOver &&
      !this.engine.gameOver &&
      !this.engine.pendingBet
    );
    if (this.btnFold) {
      this.btnFold.style.display = canConcede ? 'inline-flex' : 'none';
    }

    this.btnCoverToggle.style.display = (this.engine.currentRound > 0 && !this.engine.isMaoDeFerro && !this.engine.handOver) ? 'flex' : 'none';
  }

  // ==========================================
  // JOGADAS E APOSTAS
  // ==========================================

  handlePlayCard(cardId) {
    if (this.isDealing) return;
    if (!this.engine) return;
    if (this.engine.currentTurnIndex !== this.myPlayerIndex) {
      this.showToast('Aguarde a sua vez de jogar!', 'warning');
      return;
    }
    if (this.engine.pendingBet) {
      this.showToast('Responda ao pedido de Truco antes de jogar!', 'warning');
      return;
    }

    this.stopTurnTimer();

    const isCovered = this.coverNextCard;
    this.coverNextCard = false;
    this.btnCoverToggle.classList.remove('active');

    // Se for Solo ou Host, executa no motor local
    if (this.isSinglePlayer || (this.network && this.network.isHost)) {
      const res = this.engine.playCard(this.myPlayerIndex, cardId, isCovered);

      if (res.error) {
        this.showToast(res.error, 'warning');
        return;
      }

      window.TrucoAudio.playCardSlide();
      this.renderCardOnTable(res.played);
      this.renderMyHand();
      this.updateDealerAndTurnHighlights();
      this.updateActionButtons();

      if (!this.isSinglePlayer && this.network && this.network.isHost) {
        this.network.broadcast({
          type: 'CARD_PLAYED_EVENT',
          played: res.played,
          vasaComplete: res.vasaComplete,
          vasaResult: res.vasaResult,
          nextTurnIndex: res.nextTurnIndex
        });
        this.syncGameStateToClients();
      }

      if (res.vasaComplete) {
        this.handleVasaComplete(res.vasaResult);
      } else {
        this.checkNextTurnAction();
      }
    } else {
      // Cliente conectado: envia a intenção de jogada para o Host validar
      this.network.sendToHost({
        type: 'CLIENT_PLAY_CARD',
        cardId: cardId,
        isCovered: isCovered
      });
    }
  }

  renderCardOnTable(playedRecord) {
    const placeholder = this.trickDropzone.querySelector('.trick-tabletop-label');
    if (placeholder) placeholder.style.display = 'none';

    const cardEl = this.createCardElement(playedRecord.card, playedRecord.isCovered);
    cardEl.classList.add('played-trick-card');

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

  renderTableCards(cards = []) {
    this.trickDropzone.innerHTML = '<span class="trick-tabletop-label">Área de Vasa</span>';
    if (!cards || cards.length === 0) return;
    cards.forEach(record => {
      this.renderCardOnTable(record);
    });
  }

  animateTrickCardsFadeOut(callback) {
    if (!this.trickDropzone) {
      callback?.();
      return;
    }

    const cards = this.trickDropzone.querySelectorAll('.played-trick-card');
    if (!cards || cards.length === 0) {
      this.trickDropzone.innerHTML = '<span class="trick-tabletop-label">Área de Vasa</span>';
      callback?.();
      return;
    }

    this.isFadingTrickCards = true;

    cards.forEach(cardEl => {
      cardEl.classList.add('trick-fade-out');
      const currentTransform = cardEl.style.transform || '';
      if (!currentTransform.includes('scale(')) {
        cardEl.style.transform = `${currentTransform} scale(0.88) translateY(-8px)`;
      }
    });

    if (this.trickFadeTimer) {
      clearTimeout(this.trickFadeTimer);
    }

    this.trickFadeTimer = setTimeout(() => {
      if (this.trickDropzone) {
        this.trickDropzone.innerHTML = '<span class="trick-tabletop-label">Área de Vasa</span>';
      }
      this.isFadingTrickCards = false;
      this.trickFadeTimer = null;
      callback?.();
    }, 450);
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
      if (this.trickFadeTimer) {
        clearTimeout(this.trickFadeTimer);
        this.trickFadeTimer = null;
      }
      this.trickFadeTimer = setTimeout(() => {
        this.animateTrickCardsFadeOut(() => {
          this.updateDealerAndTurnHighlights();
          this.updateActionButtons();
          if (this.isSinglePlayer || (this.network && this.network.isHost)) {
            this.checkNextTurnAction();
          }
        });
      }, 1000);
    }
  }

  handleHandFinished(handSummary) {
    if (!this.engine || !this.engine.players) return;
    this.stopTurnTimer();
    const myPlayer = this.engine.players[this.myPlayerIndex];
    const isMyTeamWinner = (myPlayer && handSummary.winningTeam === myPlayer.team);
    const points = this.engine.currentStake;

    if (isMyTeamWinner) {
      window.TrucoAudio.playWinChime();
      this.triggerEventBanner('VITÓRIA NA MÃO!', `Sua equipe marcou +${points} pontos!`);
    } else {
      this.triggerEventBanner('DERROTA NA MÃO', `Adversários marcaram +${points} pontos.`);
    }

    if (this.engine.gameOver) {
      const champTeam = this.engine.winningTeam;
      if (champTeam !== null && champTeam !== undefined) {
        this.seriesWins[champTeam] = (this.seriesWins[champTeam] || 0) + 1;
        this.updateSeriesHUD();
      }

      setTimeout(() => {
        const isChamp = (myPlayer && this.engine.winningTeam === myPlayer.team);
        this.triggerEventBanner(
          isChamp ? 'CAMPEÕES DA PARTIDA!' : 'FIM DE JOGO!',
          isChamp ? 'Parabéns! Vocês fecharam os 12 pontos!' : 'A equipe adversária fechou os 12 pontos.'
        );
        this.showGameOverModal();
      }, 1600);
      return;
    }

    // Apenas o Host ou partida solo inicia a próxima mão
    if (this.isSinglePlayer || (this.network && this.network.isHost)) {
      setTimeout(() => {
        if (!this.isSinglePlayer && this.network && this.network.isHost) {
          this.network.broadcast({
            type: 'ROUND_COLLECT_SHUFFLE_EVENT',
            isFirstRound: false
          });
        }
        this.animateCollectCards(() => {
          this.animateShuffleDeck(() => {
            this.startRoundHand({ animate: true, isFirstRound: false });
          });
        });
      }, 1500);
    }
  }

  // ==========================================
  // PEDIDOS DE TRUCO / AUMENTOS
  // ==========================================

  handlePlayerRequestBet() {
    if (this.isDealing) return;
    if (!this.engine) return;

    // Só permite pedir truco na vez do próprio jogador
    if (this.engine.currentTurnIndex !== this.myPlayerIndex) {
      this.showToast('Você só pode pedir Truco na sua vez!', 'warning');
      return;
    }

    if (this.isSinglePlayer || (this.network && this.network.isHost)) {
      const res = this.engine.requestBet(this.myPlayerIndex);
      if (res.error) {
        this.showToast(res.error, 'warning');
        return;
      }

      window.TrucoAudio.playTableThump();
      this.table.classList.add('thump-active');
      setTimeout(() => this.table.classList.remove('thump-active'), 400);

      const label = res.pendingBet.targetLabel;
      this.sendSpeechBubble(this.myPlayerIndex, `${label.toUpperCase()}!`);
      this.triggerEventBanner(`${label.toUpperCase()}!`, `${this.engine.players[this.myPlayerIndex].name} pediu ${label}!`);
      this.updateActionButtons();

      if (!this.isSinglePlayer && this.network && this.network.isHost) {
        this.network.broadcast({
          type: 'BET_REQUEST_EVENT',
          playerIndex: this.myPlayerIndex,
          pendingBet: res.pendingBet
        });
        this.syncGameStateToClients();
      }

      this.checkBotBetResponse();
    } else {
      // Cliente envia pedido ao Host
      this.network.sendToHost({
        type: 'CLIENT_REQUEST_BET'
      });
    }
  }

  showBetResponseUI(pendingBet) {
    if (!this.engine || !this.engine.players || !this.engine.players[this.myPlayerIndex]) return;
    const myTeam = this.engine.players[this.myPlayerIndex].team;
    if (pendingBet.requestedByTeam === myTeam) {
      this.betResponseBar.style.display = 'none';
      return;
    }

    this.stopTurnTimer();
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
    if (!this.engine) return;

    if (this.isSinglePlayer || (this.network && this.network.isHost)) {
      this.executeBetResponse(this.myPlayerIndex, action);
    } else {
      this.betResponseBar.style.display = 'none';
      this.network.sendToHost({
        type: 'CLIENT_RESPOND_BET',
        action: action
      });
    }
  }

  executeBetResponse(playerIndex, action) {
    const res = this.engine.respondBet(playerIndex, action);
    if (res.error) {
      this.showToast(res.error, 'warning');
      return;
    }

    this.betResponseBar.style.display = 'none';
    const respondingPlayerName = this.engine.players[playerIndex] ? this.engine.players[playerIndex].name : 'Jogador';

    if (action === 'refuse') {
      this.sendSpeechBubble(playerIndex, 'Corro!');
      this.triggerEventBanner('FUGIU!', `${respondingPlayerName} correu do pedido de aposta.`);
      this.handleHandFinished({ winningTeam: res.winningTeam });
    } else if (action === 'accept') {
      window.TrucoAudio.playTableThump();
      this.sendSpeechBubble(playerIndex, 'Cai pra dentro!');
      this.triggerEventBanner('ACEITO!', `Mão agora vale ${res.newStake} pontos!`);
      this.updateScoreboard();
      this.updateActionButtons();
      this.checkNextTurnAction();
    } else if (action === 'raise') {
      window.TrucoAudio.playTableThump();
      this.table.classList.add('thump-active');
      setTimeout(() => this.table.classList.remove('thump-active'), 400);

      const label = res.pendingBet.targetLabel;
      this.sendSpeechBubble(playerIndex, `${label.toUpperCase()}!`);
      this.triggerEventBanner(`${label.toUpperCase()}!`, `${respondingPlayerName} aumentou para ${label}!`);
      this.updateScoreboard();
      this.updateActionButtons();
      this.showBetResponseUI(res.pendingBet);
      this.checkBotBetResponse();
    }

    if (!this.isSinglePlayer && this.network && this.network.isHost) {
      this.network.broadcast({
        type: 'BET_RESPONSE_EVENT',
        playerIndex: playerIndex,
        action: action,
        newStake: res.newStake,
        pendingBet: res.pendingBet,
        winningTeam: res.winningTeam
      });
      this.syncGameStateToClients();
    }
  }

  // Desistir da mão (a partir da 2ª vasa)
  handlePlayerConcede() {
    if (this.isDealing) return;
    if (!this.engine || this.engine.handOver || this.engine.gameOver) return;
    if (this.engine.currentRound === 0) {
      this.showToast('Você só pode desistir a partir da segunda vasa!', 'warning');
      return;
    }
    if (this.engine.pendingBet) {
      this.showToast('Responda ao pedido de Truco antes de desistir!', 'warning');
      return;
    }

    if (this.isSinglePlayer || (this.network && this.network.isHost)) {
      this.executeConcedeHand(this.myPlayerIndex);
    } else {
      this.network.sendToHost({
        type: 'CLIENT_CONCEDE_HAND',
        playerIndex: this.myPlayerIndex
      });
    }
  }

  executeConcedeHand(playerIndex) {
    if (!this.engine || this.engine.handOver || this.engine.gameOver) return;
    const res = this.engine.concedeHand(playerIndex);
    if (res.error) {
      this.showToast(res.error, 'warning');
      return;
    }

    this.stopTurnTimer();
    if (this.btnFold) this.btnFold.style.display = 'none';
    if (this.btnTruco) this.btnTruco.style.display = 'none';
    if (this.btnCoverToggle) this.btnCoverToggle.style.display = 'none';

    const playerName = this.engine.players[playerIndex] ? this.engine.players[playerIndex].name : 'Jogador';
    const oppTeamName = res.winningTeam === 0 ? 'NÓS' : 'ELES';
    const pts = res.pointsWon;

    window.TrucoAudio.playCardSlide();
    this.sendSpeechBubble(playerIndex, 'Desisto!');
    this.triggerEventBanner('DESISTÊNCIA!', `${playerName} desistiu da mão. Equipe ${oppTeamName} leva +${pts} ponto${pts > 1 ? 's' : ''}!`);
    this.updateScoreboard();

    if (!this.isSinglePlayer && this.network && this.network.isHost) {
      this.network.broadcast({
        type: 'HAND_CONCEDED_EVENT',
        playerIndex: playerIndex,
        winningTeam: res.winningTeam,
        pointsWon: pts
      });
      this.syncGameStateToClients();
    }

    this.handleHandFinished({ winningTeam: res.winningTeam });
  }

  toggleMaoDeOnzePeek() {
    if (!this.maoDeOnzeModal) return;
    const isPeeking = this.maoDeOnzeModal.classList.toggle('is-peeking');
    const peekText = document.getElementById('m11PeekText');
    const peekIcon = document.getElementById('m11PeekIcon');
    if (peekText) peekText.textContent = isPeeking ? 'Expandir' : 'Espiar Mesa';
    if (peekIcon) peekIcon.textContent = isPeeking ? 'Expandir' : 'Espiar';
  }

  renderMaoDeOnzeModal() {
    if (!this.maoDeOnzeModal || !this.engine) return;

    // Reset modo espiar
    this.maoDeOnzeModal.classList.remove('is-peeking');
    const peekText = document.getElementById('m11PeekText');
    const peekIcon = document.getElementById('m11PeekIcon');
    if (peekText) peekText.textContent = 'Espiar Mesa';
    if (peekIcon) peekIcon.textContent = 'Espiar';

    const vira = this.engine.vira;
    const manilhaRank = this.engine.manilhaRank;

    // Renderiza a carta do Vira
    const viraSlot = document.getElementById('m11ViraCardSlot');
    if (viraSlot && vira) {
      viraSlot.innerHTML = '';
      const viraCardEl = this.createCardElement(vira);
      viraSlot.appendChild(viraCardEl);
    }

    // Atualiza dados informativos da Manilha
    const manilhaRankEl = document.getElementById('m11ManilhaRank');
    const manilhaStrongEl = document.getElementById('m11ManilhaStrong');

    if (manilhaRankEl) manilhaRankEl.textContent = manilhaRank || '—';
    if (manilhaStrongEl) manilhaStrongEl.textContent = manilhaRank || '—';

    // Renderiza as cartas da mão do jogador
    const myPlayer = (this.engine.players && this.engine.players[this.myPlayerIndex]) ? this.engine.players[this.myPlayerIndex] : null;
    const handCardsContainer = document.getElementById('m11HandCards');
    const handSummaryEl = document.getElementById('m11HandSummary');

    if (handCardsContainer && myPlayer && myPlayer.hand) {
      handCardsContainer.innerHTML = '';
      let manilhaCount = 0;

      myPlayer.hand.forEach(card => {
        const cardEl = this.createCardElement(card);
        const info = TrucoDeck.getManilhaInfo(card, vira);
        if (info) manilhaCount++;
        handCardsContainer.appendChild(cardEl);
      });

      if (handSummaryEl) {
        if (manilhaCount > 0) {
          handSummaryEl.textContent = manilhaCount === 1 ? '1 Manilha na mão!' : `${manilhaCount} Manilhas na mão!`;
          handSummaryEl.className = 'm11-badge-status has-manilha';
        } else {
          handSummaryEl.textContent = 'Nenhuma manilha';
          handSummaryEl.className = 'm11-badge-status no-manilha';
        }
      }
    }

    // Se jogo em duplas (4 jogadores), exibe as cartas do parceiro de equipe
    const partnerSection = document.getElementById('m11PartnerSection');
    if (partnerSection) {
      if (this.engine.numPlayers === 4) {
        const partnerIdx = (this.myPlayerIndex + 2) % 4;
        const partner = this.engine.players[partnerIdx];
        if (partner && partner.hand && partner.hand.length > 0) {
          partnerSection.style.display = 'block';
          const partnerCardsEl = document.getElementById('m11PartnerCards');
          const partnerLabelEl = document.getElementById('m11PartnerLabel');
          const partnerSummaryEl = document.getElementById('m11PartnerSummary');

          if (partnerLabelEl) partnerLabelEl.textContent = `CARTAS DO PARCEIRO (${partner.name}):`;
          if (partnerCardsEl) {
            partnerCardsEl.innerHTML = '';
            let pManilhas = 0;
            partner.hand.forEach(card => {
              const cardEl = this.createCardElement(card);
              const info = TrucoDeck.getManilhaInfo(card, vira);
              if (info) pManilhas++;
              partnerCardsEl.appendChild(cardEl);
            });

            if (partnerSummaryEl) {
              if (pManilhas > 0) {
                partnerSummaryEl.textContent = pManilhas === 1 ? '1 Manilha' : `${pManilhas} Manilhas`;
                partnerSummaryEl.className = 'm11-badge-status has-manilha';
              } else {
                partnerSummaryEl.textContent = 'Sem manilhas';
                partnerSummaryEl.className = 'm11-badge-status no-manilha';
              }
            }
          }
        } else {
          partnerSection.style.display = 'none';
        }
      } else {
        partnerSection.style.display = 'none';
      }
    }
  }

  handleMaoDeOnzeDecision(play, playerIndex = this.myPlayerIndex) {
    if (this.maoDeOnzeModal) {
      this.maoDeOnzeModal.classList.remove('is-peeking');
    }
    this.closeModals();
    if (!this.engine) return;

    if (this.isSinglePlayer || (this.network && this.network.isHost)) {
      const res = this.engine.decideMaoDeOnze(playerIndex, play);
      if (res.error) {
        this.showToast(res.error, 'warning');
        return;
      }

      if (!play) {
        this.sendSpeechBubble(playerIndex, 'Vamos fugir!');
        this.handleHandFinished({ winningTeam: res.winningTeam });
      } else {
        this.sendSpeechBubble(playerIndex, 'Vamos pro jogo!');
        this.triggerEventBanner('MÃO DE ONZE ACEITA', 'A rodada está valendo 3 pontos!');
        this.updateScoreboard();
        this.checkNextTurnAction();
      }

      if (!this.isSinglePlayer && this.network && this.network.isHost) {
        this.network.broadcast({
          type: 'MAO_DE_ONZE_EVENT',
          playerIndex: playerIndex,
          play: play,
          winningTeam: res.winningTeam
        });
        this.syncGameStateToClients();
      }
    } else {
      this.network.sendToHost({
        type: 'CLIENT_MAO_DE_ONZE',
        play: play
      });
    }
  }

  // ==========================================
  // INTELIGÊNCIA DOS BOTS
  // ==========================================

  checkNextTurnAction() {
    if (this.isDealing) return;
    if (!this.engine || this.engine.handOver || this.engine.gameOver) return;

    const currentIdx = this.engine.currentTurnIndex;
    const player = this.engine.players ? this.engine.players[currentIdx] : null;
    if (!player) return;

    this.stopTurnTimer();

    if (player.isBot) {
      const bot = this.bots[currentIdx];
      if (!bot) return;

      setTimeout(() => {
        if (this.isDealing) return;
        if (bot.shouldRequestTruco()) {
          const betRes = this.engine.requestBet(currentIdx);
          if (!betRes.error) {
            window.TrucoAudio.playTableThump();
            this.table.classList.add('thump-active');
            setTimeout(() => this.table.classList.remove('thump-active'), 400);

            const label = betRes.pendingBet.targetLabel;
            this.sendSpeechBubble(currentIdx, `${label.toUpperCase()}!`);
            this.triggerEventBanner(`${label.toUpperCase()}!`, `${player.name} pediu ${label}!`);
            this.showBetResponseUI(betRes.pendingBet);

            if (!this.isSinglePlayer && this.network && this.network.isHost) {
              this.network.broadcast({
                type: 'BET_REQUEST_EVENT',
                playerIndex: currentIdx,
                pendingBet: betRes.pendingBet
              });
              this.syncGameStateToClients();
            }
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

            if (!this.isSinglePlayer && this.network && this.network.isHost) {
              this.network.broadcast({
                type: 'CARD_PLAYED_EVENT',
                played: res.played,
                vasaComplete: res.vasaComplete,
                vasaResult: res.vasaResult,
                nextTurnIndex: res.nextTurnIndex
              });
              this.syncGameStateToClients();
            }

            if (res.vasaComplete) {
              this.handleVasaComplete(res.vasaResult);
            } else {
              this.checkNextTurnAction();
            }
          }
        }
      }, 900 + Math.random() * 400);
    } else if (currentIdx === this.myPlayerIndex) {
      // Vez do jogador humano local — ativa o timer
      if (!this.engine.pendingBet && !this.engine.handOver && !this.engine.gameOver) {
        this.startTurnTimer();
      }
    }
  }

  // ==========================================
  // TIMER DE VEZ (30 segundos)
  // ==========================================

  startTurnTimer() {
    this.stopTurnTimer();
    if (this.isDealing) return;
    if (!this.turnOverlay) return;

    this._turnTimerRemaining = 30;
    this.turnOverlay.style.display = 'flex';
    this._updateTimerArc(30);
    this.turnCountdown.textContent = '30';

    this._turnTimerInterval = setInterval(() => {
      this._turnTimerRemaining--;
      const remaining = this._turnTimerRemaining;

      this.turnCountdown.textContent = remaining;
      this._updateTimerArc(remaining);

      if (remaining <= 10) {
        this.timerArc.classList.add('urgent');
      }

      if (remaining <= 0) {
        this.stopTurnTimer();
        this._autoPlayRandomCard();
      }
    }, 1000);
  }

  stopTurnTimer() {
    if (this._turnTimerInterval) {
      clearInterval(this._turnTimerInterval);
      this._turnTimerInterval = null;
    }
    if (this.turnOverlay) {
      this.turnOverlay.style.display = 'none';
    }
    if (this.timerArc) {
      this.timerArc.classList.remove('urgent');
    }
  }

  _updateTimerArc(remaining) {
    if (!this.timerArc) return;
    const fraction = remaining / 30;
    const offset = this._timerCircumference * (1 - fraction);
    this.timerArc.style.strokeDashoffset = offset;
  }

  _autoPlayRandomCard() {
    if (!this.engine) return;
    if (this.engine.currentTurnIndex !== this.myPlayerIndex) return;
    const myPlayer = this.engine.players[this.myPlayerIndex];
    if (!myPlayer || !myPlayer.hand || myPlayer.hand.length === 0) return;

    const randomCard = myPlayer.hand[Math.floor(Math.random() * myPlayer.hand.length)];
    this.showToast('Tempo esgotado! Carta jogada automaticamente.', 'warning');
    this.handlePlayCard(randomCard.id);
  }

  checkBotBetResponse() {
    if (!this.engine || !this.engine.pendingBet) return;

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
      this.executeBetResponse(botIdx, action);
    }, 1100);
  }

  checkBotMaoDeOnzeDecision(team) {
    if (!this.engine) return;
    const botIdx = this.engine.players.findIndex(p => p.team === team && p.isBot);
    if (botIdx === -1) return;

    const bot = this.bots[botIdx];
    setTimeout(() => {
      const willPlay = bot.decideMaoDeOnze();
      this.handleMaoDeOnzeDecision(willPlay, botIdx);
    }, 1300);
  }

  // ==========================================
  // MULTIPLAYER E MENSAGENS P2P
  // ==========================================

  handleNetworkPlayerJoined(peer) {
    if (!this.engine) return;
    let replacedIndex = -1;

    // 1. Procura slot 'Aguardando'
    for (let i = 1; i < this.engine.numPlayers; i++) {
      if (this.engine.players[i].name.startsWith('Aguardando')) {
        replacedIndex = i;
        break;
      }
    }

    // 2. Se não houver, procura slot de bot
    if (replacedIndex === -1) {
      for (let i = 1; i < this.engine.numPlayers; i++) {
        if (this.engine.players[i].isBot) {
          replacedIndex = i;
          break;
        }
      }
    }

    if (replacedIndex !== -1) {
      this.engine.players[replacedIndex].name = peer.name;
      this.engine.players[replacedIndex].id = peer.peerId;
      this.engine.players[replacedIndex].isBot = false;
      this.bots[replacedIndex] = null;
    }

    const hasWaitingSlots = this.engine.players.some(p => p.name.startsWith('Aguardando'));
    if (!this.engine.vira && !hasWaitingSlots) {
      this.startRoundHand({ animate: true, isFirstRound: true });
    } else {
      this.renderSeats();
      this.syncGameStateToClients();
    }

    const joinText = `${peer.name} entrou na mesa!`;
    this.showToast(joinText, 'success');
    this.network.broadcast({
      type: 'TOAST',
      message: joinText,
      toastType: 'success'
    });
  }

  handleNetworkPlayerLeft(peerId) {
    if (!this.engine) return;
    const idx = this.engine.players.findIndex(p => p.id === peerId);
    if (idx !== -1) {
      const pName = this.engine.players[idx].name;
      this.engine.players[idx].name = `Bot ${idx}`;
      this.engine.players[idx].isBot = true;
      this.bots[idx] = new TrucoBot(idx, this.engine);
      this.renderSeats();
      this.syncGameStateToClients();

      const disconnectText = `${pName} se desconectou. Um Bot assumiu a vaga.`;
      this.showToast(disconnectText, 'warning');
      this.network.broadcast({
        type: 'TOAST',
        message: disconnectText,
        toastType: 'warning'
      });

      if (this.engine.currentTurnIndex === idx) {
        this.checkNextTurnAction();
      }
    }
  }

  handleNetworkMessage(data, fromPeerId = null) {
    if (!data || !data.type) return;

    if (data.type === 'TOAST') {
      this.showToast(data.message, data.toastType || 'info');
    } else if (data.type === 'CHAT') {
      this.sendSpeechBubble(data.playerIndex, data.text);
      window.TrucoAudio.playNotification();
      if (this.network && this.network.isHost) {
        this.network.broadcast(data);
      }
    } else if (data.type === 'CLIENT_PLAY_CARD') {
      if (!this.network || !this.network.isHost || !this.engine) return;
      const fromIdx = this.engine.players.findIndex(p => p.id === fromPeerId);
      if (fromIdx === -1 || fromIdx !== this.engine.currentTurnIndex) return;

      const res = this.engine.playCard(fromIdx, data.cardId, data.isCovered);
      if (res.error) {
        this.network.sendToPeer(fromPeerId, { type: 'ACTION_ERROR', message: res.error });
        return;
      }

      window.TrucoAudio.playCardSlide();
      this.renderCardOnTable(res.played);
      this.renderMyHand();
      this.updateDealerAndTurnHighlights();
      this.updateActionButtons();

      this.network.broadcast({
        type: 'CARD_PLAYED_EVENT',
        played: res.played,
        vasaComplete: res.vasaComplete,
        vasaResult: res.vasaResult,
        nextTurnIndex: res.nextTurnIndex
      });
      this.syncGameStateToClients();

      if (res.vasaComplete) {
        this.handleVasaComplete(res.vasaResult);
      } else {
        this.checkNextTurnAction();
      }
    } else if (data.type === 'CARD_PLAYED_EVENT') {
      window.TrucoAudio.playCardSlide();

      // Renderiza a carta na mesa. Se foi a minha própria carta (já joguei e
      // renderizei localmente via handlePlayCard), não repete para não duplicar.
      // Como cliente nunca executa playCard localmente, sempre renderiza.
      this.renderCardOnTable(data.played);
      // Sinaliza para o STATE_SYNC seguinte não recriar as cartas da mesa
      this._skipTableRender = true;

      // Atualiza a mão: remove a carta jogada do array local
      if (data.played.playerIndex === this.myPlayerIndex) {
        const myHand = this.engine.players[this.myPlayerIndex].hand;
        const cardIdx = myHand.findIndex(c => c.id === data.played.card.id);
        if (cardIdx !== -1) myHand.splice(cardIdx, 1);
      } else {
        const otherPlayer = this.engine.players[data.played.playerIndex];
        if (otherPlayer && otherPlayer.hand && otherPlayer.hand.length > 0) {
          otherPlayer.hand.pop();
        }
      }

      // Atualiza apenas os mini-cards dos assentos (não recriar as cartas do próprio jogador)
      for (let i = 0; i < this.engine.numPlayers; i++) {
        if (i !== this.myPlayerIndex) {
          const backContainer = document.getElementById(`seatBacks-${i}`);
          if (backContainer) {
            const count = this.engine.players[i].hand ? this.engine.players[i].hand.length : 0;
            backContainer.innerHTML = '';
            for (let c = 0; c < count; c++) {
              const mini = document.createElement('div');
              mini.className = 'mini-card';
              backContainer.appendChild(mini);
            }
          }
        }
      }
      this.updateDealerAndTurnHighlights();
      this.updateActionButtons();

      if (data.vasaComplete) {
        this.handleVasaComplete(data.vasaResult);
      } else {
        this.engine.currentTurnIndex = data.nextTurnIndex;
        this.updateDealerAndTurnHighlights();
        this.updateActionButtons();
        // Dispara timer se agora for a vez do cliente
        if (data.nextTurnIndex === this.myPlayerIndex && !this.engine.pendingBet && !this.engine.handOver) {
          this.startTurnTimer();
        }
      }
    } else if (data.type === 'CLIENT_REQUEST_BET') {
      if (!this.network || !this.network.isHost || !this.engine) return;
      const fromIdx = this.engine.players.findIndex(p => p.id === fromPeerId);
      if (fromIdx === -1) return;

      const res = this.engine.requestBet(fromIdx);
      if (res.error) {
        this.network.sendToPeer(fromPeerId, { type: 'ACTION_ERROR', message: res.error });
        return;
      }

      window.TrucoAudio.playTableThump();
      this.table.classList.add('thump-active');
      setTimeout(() => this.table.classList.remove('thump-active'), 400);

      const label = res.pendingBet.targetLabel;
      this.sendSpeechBubble(fromIdx, `${label.toUpperCase()}!`);
      this.triggerEventBanner(`${label.toUpperCase()}!`, `${this.engine.players[fromIdx].name} pediu ${label}!`);
      this.updateActionButtons();
      this.showBetResponseUI(res.pendingBet);

      this.network.broadcast({
        type: 'BET_REQUEST_EVENT',
        playerIndex: fromIdx,
        pendingBet: res.pendingBet
      });
      this.syncGameStateToClients();
      this.checkBotBetResponse();
    } else if (data.type === 'BET_REQUEST_EVENT') {
      window.TrucoAudio.playTableThump();
      this.table.classList.add('thump-active');
      setTimeout(() => this.table.classList.remove('thump-active'), 400);

      const pName = this.engine.players[data.playerIndex] ? this.engine.players[data.playerIndex].name : 'Jogador';
      const label = data.pendingBet.targetLabel;
      this.sendSpeechBubble(data.playerIndex, `${label.toUpperCase()}!`);
      this.triggerEventBanner(`${label.toUpperCase()}!`, `${pName} pediu ${label}!`);
      this.engine.pendingBet = data.pendingBet;
      this.updateActionButtons();
      this.showBetResponseUI(data.pendingBet);
    } else if (data.type === 'CLIENT_RESPOND_BET') {
      if (!this.network || !this.network.isHost || !this.engine) return;
      const fromIdx = this.engine.players.findIndex(p => p.id === fromPeerId);
      if (fromIdx === -1) return;
      this.executeBetResponse(fromIdx, data.action);
    } else if (data.type === 'BET_RESPONSE_EVENT') {
      this.betResponseBar.style.display = 'none';
      const pName = this.engine.players[data.playerIndex] ? this.engine.players[data.playerIndex].name : 'Jogador';

      if (data.action === 'refuse') {
        this.sendSpeechBubble(data.playerIndex, 'Corro!');
        this.triggerEventBanner('FUGIU!', `${pName} correu do pedido de aposta.`);
        this.handleHandFinished({ winningTeam: data.winningTeam });
      } else if (data.action === 'accept') {
        window.TrucoAudio.playTableThump();
        this.sendSpeechBubble(data.playerIndex, 'Cai pra dentro!');
        this.triggerEventBanner('ACEITO!', `Mão agora vale ${data.newStake} pontos!`);
        this.engine.currentStake = data.newStake;
        this.engine.pendingBet = null;
        this.updateScoreboard();
        this.updateActionButtons();
      } else if (data.action === 'raise') {
        window.TrucoAudio.playTableThump();
        this.table.classList.add('thump-active');
        setTimeout(() => this.table.classList.remove('thump-active'), 400);

        const label = data.pendingBet.targetLabel;
        this.sendSpeechBubble(data.playerIndex, `${label.toUpperCase()}!`);
        this.triggerEventBanner(`${label.toUpperCase()}!`, `${pName} aumentou para ${label}!`);
        this.engine.pendingBet = data.pendingBet;
        this.updateScoreboard();
        this.updateActionButtons();
        this.showBetResponseUI(data.pendingBet);
      }
    } else if (data.type === 'CLIENT_MAO_DE_ONZE') {
      if (!this.network || !this.network.isHost || !this.engine) return;
      const fromIdx = this.engine.players.findIndex(p => p.id === fromPeerId);
      if (fromIdx === -1) return;
      this.handleMaoDeOnzeDecision(data.play, fromIdx);
    } else if (data.type === 'MAO_DE_ONZE_EVENT') {
      const pName = this.engine.players[data.playerIndex] ? this.engine.players[data.playerIndex].name : 'Equipe';
      if (!data.play) {
        this.sendSpeechBubble(data.playerIndex, 'Vamos fugir!');
        this.handleHandFinished({ winningTeam: data.winningTeam });
      } else {
        this.sendSpeechBubble(data.playerIndex, 'Vamos pro jogo!');
        this.triggerEventBanner('MÃO DE ONZE ACEITA', `${pName} decidiu encarar a mão!`);
        this.updateScoreboard();
        this.updateActionButtons();
      }
    } else if (data.type === 'CLIENT_CONCEDE_HAND') {
      if (!this.network || !this.network.isHost || !this.engine) return;
      const fromIdx = this.engine.players.findIndex(p => p.id === fromPeerId);
      if (fromIdx === -1) return;
      this.executeConcedeHand(fromIdx);
    } else if (data.type === 'HAND_CONCEDED_EVENT') {
      const pName = this.engine.players[data.playerIndex] ? this.engine.players[data.playerIndex].name : 'Jogador';
      const oppTeamName = data.winningTeam === 0 ? 'NÓS' : 'ELES';
      const pts = data.pointsWon;
      this.sendSpeechBubble(data.playerIndex, 'Desisto!');
      this.triggerEventBanner('DESISTÊNCIA!', `${pName} desistiu da mão. Equipe ${oppTeamName} leva +${pts} ponto${pts > 1 ? 's' : ''}!`);
      this.handleHandFinished({ winningTeam: data.winningTeam });
    } else if (data.type === 'ACTION_ERROR') {
      this.showToast(data.message, 'warning');
    } else if (data.type === 'REMATCH_START') {
      this.closeModals();
      if (data.seriesWins) {
        this.seriesWins = [...data.seriesWins];
      }
      this.updateSeriesHUD();
      this.showToast('O anfitrião iniciou a revanche!', 'success');
    } else if (data.type === 'REQUEST_REMATCH') {
      if (this.network && this.network.isHost) {
        const peer = this.network.peers?.get?.(fromPeerId);
        const name = peer ? peer.name : 'Um jogador';
        this.showToast(`${name} pediu revanche!`, 'info');
        this.addChatMessage('system', '', `${name} pediu revanche!`);
      }
    } else if (data.type === 'ROUND_COLLECT_SHUFFLE_EVENT') {
      this._pendingDealAnimation = true;
      if (data.isFirstRound) {
        this.animateShuffleDeck();
      } else {
        this.animateCollectCards(() => {
          this.animateShuffleDeck();
        });
      }
    } else if (data.type === 'ROUND_DEAL_START') {
      this._pendingDealAnimation = true;
    } else if (data.type === 'STATE_SYNC') {
      if (!this.engine) {
        this.engine = new TrucoEngine({ numPlayers: data.numPlayers });
      }

      this.engine.numPlayers = data.numPlayers;
      this.myPlayerIndex = data.assignedIndex;
      this.engine.scores = [...data.scores];
      this.engine.currentStake = data.currentStake;
      this.engine.vira = data.vira;
      this.engine.manilhaRank = data.manilhaRank;
      this.engine.dealerIndex = data.dealerIndex;
      this.engine.currentTurnIndex = data.currentTurnIndex;
      this.engine.handStarterIndex = data.handStarterIndex;
      this.engine.currentRound = data.currentRound || 0;
      this.engine.roundWinners = [...(data.roundWinners || [])];
      this.engine.roundCards = data.roundCards || [];
      this.engine.pendingBet = data.pendingBet || null;
      this.engine.lastBettorTeam = data.lastBettorTeam;
      this.engine.isMaoDeOnze = !!data.isMaoDeOnze;
      this.engine.maoDeOnzeTeam = data.maoDeOnzeTeam;
      this.engine.isMaoDeFerro = !!data.isMaoDeFerro;
      this.engine.handOver = !!data.handOver;
      this.engine.gameOver = !!data.gameOver;
      this.engine.winningTeam = data.winningTeam;

      if (data.seriesWins) {
        this.seriesWins = [...data.seriesWins];
      }

      if (data.players) {
        this.engine.players = data.players.map(p => ({
          index: p.index,
          id: p.id,
          name: p.name,
          team: p.team,
          isBot: p.isBot,
          hand: (p.index === this.myPlayerIndex) ? (data.myHand || []) : new Array(p.cardCount || 0).fill({})
        }));
      }

      if (this._pendingDealAnimation) {
        this._pendingDealAnimation = false;
        this._skipTableRender = false;
        this.updateScoreboard();
        this.renderSeats();
        this.animateDealCards(() => {
          this.renderViraCard();
          this.renderMyHand();
          this.renderTableCards(this.engine.roundCards);
          this.updateDealerAndTurnHighlights();
          this.updateActionButtons();
        });
      } else {
        this.updateScoreboard();
        this.renderSeats();
        this.renderViraCard();
        this.renderMyHand();
        // Só recriar a mesa se não acabamos de processar um CARD_PLAYED_EVENT ou durante fade out da vasa
        if (!this._skipTableRender && !this.isFadingTrickCards) {
          this.renderTableCards(this.engine.roundCards);
        }
        this._skipTableRender = false;
        this.updateDealerAndTurnHighlights();
        this.updateActionButtons();
      }

      if (this.engine.pendingBet) {
        this.showBetResponseUI(this.engine.pendingBet);
      } else {
        this.betResponseBar.style.display = 'none';
      }

      if (this.engine.isMaoDeOnze && !this.engine.handOver && this.engine.currentStake === 1) {
        const isMyTeam = (this.engine.players[this.myPlayerIndex].team === this.engine.maoDeOnzeTeam);
        if (isMyTeam && !this.maoDeOnzeModal.classList.contains('active')) {
          this.renderMaoDeOnzeModal();
          this.openModal(this.maoDeOnzeModal);
        }
      }

      // Para o cliente P2P: ativa o timer se for a vez dele e a mão não acabou
      if (!this.engine.handOver && !this.engine.gameOver && !this.engine.pendingBet &&
        !this.isDealing && this.engine.currentTurnIndex === this.myPlayerIndex) {
        this.startTurnTimer();
      } else {
        this.stopTurnTimer();
      }

      if (this.engine.gameOver) {
        this.stopTurnTimer();
        setTimeout(() => {
          this.showGameOverModal();
        }, 1500);
      }
    }
  }

  syncGameStateToClients() {
    if (!this.network || !this.network.isHost || !this.engine) return;

    this.network.connections.forEach((conn, peerId) => {
      const pIdx = this.engine.players.findIndex(p => p.id === peerId);
      if (pIdx !== -1 && conn.open) {
        conn.send({
          type: 'STATE_SYNC',
          assignedIndex: pIdx,
          numPlayers: this.engine.numPlayers,
          scores: [...this.engine.scores],
          currentStake: this.engine.currentStake,
          vira: this.engine.vira,
          manilhaRank: this.engine.manilhaRank,
          dealerIndex: this.engine.dealerIndex,
          currentTurnIndex: this.engine.currentTurnIndex,
          handStarterIndex: this.engine.handStarterIndex,
          currentRound: this.engine.currentRound,
          roundWinners: [...this.engine.roundWinners],
          roundCards: this.engine.roundCards || [],
          players: this.engine.players.map(p => ({
            index: p.index,
            id: p.id,
            name: p.name,
            team: p.team,
            isBot: p.isBot,
            cardCount: (p.hand ? p.hand.length : 0)
          })),
          myHand: (this.engine.players[pIdx] && this.engine.players[pIdx].hand) ? [...this.engine.players[pIdx].hand] : [],
          pendingBet: this.engine.pendingBet,
          lastBettorTeam: this.engine.lastBettorTeam,
          isMaoDeOnze: this.engine.isMaoDeOnze,
          maoDeOnzeTeam: this.engine.maoDeOnzeTeam,
          isMaoDeFerro: this.engine.isMaoDeFerro,
          handOver: this.engine.handOver,
          gameOver: this.engine.gameOver,
          winningTeam: this.engine.winningTeam,
          seriesWins: [...this.seriesWins]
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

  // ==========================================
  // CHAT DE TEXTO
  // ==========================================

  toggleChatPanel() {
    if (this._chatOpen) {
      this.closeChatPanel();
    } else {
      this.openChatPanel();
    }
  }

  openChatPanel() {
    this._chatOpen = true;
    this.chatPanel.classList.add('is-open');
    this._chatUnread = 0;
    this.chatUnreadBadge.style.display = 'none';
    // Scroll para baixo
    setTimeout(() => {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      this.chatInput.focus();
    }, 260);
  }

  closeChatPanel() {
    this._chatOpen = false;
    this.chatPanel.classList.remove('is-open');
  }

  /**
   * Adiciona uma mensagem no painel de chat.
   * @param {'mine'|'other'|'system'} side  - quem enviou
   * @param {string} author                 - nome do jogador
   * @param {string} text                   - conteúdo
   */
  addChatMessage(side, author, text) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${side}`;

    if (side !== 'system') {
      const authorEl = document.createElement('div');
      authorEl.className = 'chat-msg-author';
      authorEl.textContent = author;
      msg.appendChild(authorEl);
    }

    const bubble = document.createElement('div');
    bubble.className = 'chat-msg-bubble';
    bubble.textContent = text;
    msg.appendChild(bubble);

    this.chatMessages.appendChild(msg);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

    // Badge de não lida quando painel está fechado
    if (!this._chatOpen && side !== 'system') {
      this._chatUnread++;
      this.chatUnreadBadge.style.display = 'flex';
      this.chatUnreadBadge.textContent = this._chatUnread > 9 ? '9+' : this._chatUnread;
    }
  }

  handleChatSend() {
    if (!this.chatInput) return;
    const text = this.chatInput.value.trim();
    if (!text) return;
    this.chatInput.value = '';

    const myName = (this.engine && this.engine.players && this.engine.players[this.myPlayerIndex])
      ? this.engine.players[this.myPlayerIndex].name
      : 'Você';

    this.addChatMessage('mine', myName, text);
    this.sendSpeechBubble(this.myPlayerIndex, text);

    // Multiplayer: broadcast
    if (!this.isSinglePlayer && this.network) {
      const msg = { type: 'CHAT_TEXT', playerIndex: this.myPlayerIndex, playerName: myName, text };
      if (this.network.isHost) {
        this.network.broadcast(msg);
      } else {
        this.network.sendToHost(msg);
      }
    } else if (this.isSinglePlayer) {
      // Bots reagem com chance aleatória
      this._botChatReaction();
    }
  }

  /** Bot responde ao chat do jogador com uma das frases aleatórias */
  _botChatReaction() {
    if (!this.engine || !this.bots) return;
    const botResponses = [
      'Haha, tá bom!', 'Cala boca e joga!', 'Foco na partida!',
      'Boa!', 'Tô de olho em você...', 'Vai querer chorar depois!'
    ];
    // Escolhe um bot aleatório com 40% de chance
    if (Math.random() > 0.4) return;
    const botIndices = Object.keys(this.bots).filter(i => this.bots[i]);
    if (botIndices.length === 0) return;
    const idx = parseInt(botIndices[Math.floor(Math.random() * botIndices.length)]);
    const botName = this.engine.players[idx] ? this.engine.players[idx].name : `Bot ${idx}`;
    const text = botResponses[Math.floor(Math.random() * botResponses.length)];
    setTimeout(() => {
      this.addChatMessage('other', botName, text);
      this.sendSpeechBubble(idx, text);
    }, 800 + Math.random() * 1200);
  }

  /** Bot manda mensagem de chat num evento de jogo (truco, vasa, etc) */
  _botEventChat(botIndex, text) {
    if (!this.engine || !this.engine.players[botIndex]) return;
    const botName = this.engine.players[botIndex].name;
    setTimeout(() => {
      this.addChatMessage('other', botName, text);
    }, 600);
  }

  // ==========================================
  // PLACAR DE SÉRIE E REVANCHE
  // ==========================================

  updateSeriesHUD() {
    if (!this.seriesBadge0 || !this.seriesBadge1) return;
    const myPlayer = (this.engine && this.engine.players && this.engine.players[this.myPlayerIndex]) ? this.engine.players[this.myPlayerIndex] : null;
    const myTeam = myPlayer ? myPlayer.team : 0;
    const oppTeam = 1 - myTeam;

    const totalWins = (this.seriesWins[0] || 0) + (this.seriesWins[1] || 0);
    if (totalWins > 0) {
      this.seriesBadge0.style.display = 'inline-block';
      this.seriesBadge0.textContent = `${this.seriesWins[myTeam] || 0}`;
      this.seriesBadge1.style.display = 'inline-block';
      this.seriesBadge1.textContent = `${this.seriesWins[oppTeam] || 0}`;
    } else {
      this.seriesBadge0.style.display = 'none';
      this.seriesBadge1.style.display = 'none';
    }
  }

  showGameOverModal() {
    if (!this.engine) return;
    const myPlayer = (this.engine.players && this.engine.players[this.myPlayerIndex]) ? this.engine.players[this.myPlayerIndex] : null;
    const myTeam = myPlayer ? myPlayer.team : 0;
    const oppTeam = 1 - myTeam;
    const isWinner = (this.engine.winningTeam === myTeam);

    const winIcon = document.getElementById('gameOverIcon');
    const winTitle = document.getElementById('gameOverTitle');
    const winSubtitle = document.getElementById('gameOverSubtitle');
    const scoreNos = document.getElementById('gameOverScoreNos');
    const scoreEles = document.getElementById('gameOverScoreEles');
    const winsNos = document.getElementById('seriesWinsNos');
    const winsEles = document.getElementById('seriesWinsEles');
    const modalWindow = this.gameOverModal?.querySelector('.game-over-window');

    if (winIcon) winIcon.textContent = isWinner ? 'VITÓRIA' : 'DERROTA';
    if (winTitle) {
      winTitle.textContent = isWinner ? 'VITÓRIA!' : 'DERROTA!';
      winTitle.className = isWinner ? 'modal-title victory' : 'modal-title defeat';
    }
    if (winSubtitle) {
      winSubtitle.textContent = isWinner ? 'Parabéns! Sua equipe fechou os 12 pontos!' : 'A equipe adversária fechou os 12 pontos.';
    }
    if (modalWindow) {
      modalWindow.classList.remove('victory', 'defeat');
      modalWindow.classList.add(isWinner ? 'victory' : 'defeat');
    }

    if (scoreNos) scoreNos.textContent = (this.engine.scores && this.engine.scores[myTeam] !== undefined) ? this.engine.scores[myTeam] : 0;
    if (scoreEles) scoreEles.textContent = (this.engine.scores && this.engine.scores[oppTeam] !== undefined) ? this.engine.scores[oppTeam] : 0;
    if (winsNos) winsNos.textContent = this.seriesWins[myTeam] || 0;
    if (winsEles) winsEles.textContent = this.seriesWins[oppTeam] || 0;

    if (isWinner) {
      window.TrucoAudio?.playWinChime?.();
    }

    this.openModal(this.gameOverModal);
  }

  handlePlayAgain() {
    this.closeModals();

    if (this.isSinglePlayer || (this.network && this.network.isHost)) {
      if (this.trickFadeTimer) {
        clearTimeout(this.trickFadeTimer);
        this.trickFadeTimer = null;
      }
      this.isFadingTrickCards = false;
      this.engine.resetMatch();
      this.trickDropzone.innerHTML = '<span class="trick-tabletop-label">Área de Vasa</span>';
      this.updateScoreboard();
      this.updateSeriesHUD();

      const myPlayer = (this.engine.players && this.engine.players[this.myPlayerIndex]) ? this.engine.players[this.myPlayerIndex] : null;
      const myTeam = myPlayer ? myPlayer.team : 0;
      const oppTeam = 1 - myTeam;

      this.triggerEventBanner('REVANCHE!', `Série: Nós ${this.seriesWins[myTeam]} x ${this.seriesWins[oppTeam]} Eles`);
      this.addChatMessage('system', '', `Revanche iniciada! Placar geral: Nós ${this.seriesWins[myTeam]} x ${this.seriesWins[oppTeam]} Eles`);

      // Bots reagem à revanche
      if (this.isSinglePlayer) {
        const rematchTaunts = [
          'Agora o bicho vai pegar!',
          'Dessa vez eu não perdoo!',
          'Bora pra revanche, não arrego não!',
          'Sorte de principiante, quero ver agora!',
          'Tô pronto pro troco!'
        ];
        const botIndices = Object.keys(this.bots).filter(i => this.bots[i]);
        if (botIndices.length > 0) {
          const randBot = parseInt(botIndices[Math.floor(Math.random() * botIndices.length)]);
          const botName = this.engine.players[randBot] ? this.engine.players[randBot].name : 'Bot';
          const taunt = rematchTaunts[Math.floor(Math.random() * rematchTaunts.length)];
          setTimeout(() => {
            this.addChatMessage('other', botName, taunt);
            this.sendSpeechBubble(randBot, taunt);
          }, 900);
        }
      }

      // Se multiplayer host, sincroniza com peers
      if (this.network && this.network.isHost) {
        this.network.broadcast({
          type: 'REMATCH_START',
          seriesWins: [...this.seriesWins]
        });
      }

      this.startRoundHand({ animate: true, isFirstRound: true });
    } else if (this.network && !this.network.isHost) {
      this.network.sendToHost({
        type: 'REQUEST_REMATCH'
      });
      this.showToast('Pedido de revanche enviado ao anfitrião da sala!', 'info');
    }
  }

  handleReturnToLobby() {
    this.closeModals();
    this.stopTurnTimer();

    if (this.trickFadeTimer) {
      clearTimeout(this.trickFadeTimer);
      this.trickFadeTimer = null;
    }
    this.isFadingTrickCards = false;

    // Zera contagem da série ao voltar para o menu
    this.seriesWins = [0, 0];
    this.updateSeriesHUD();

    if (this.network) {
      try { this.network.disconnect(); } catch (e) { }
      this.network = null;
    }

    this.roomBadge.style.display = 'none';
    this.table.className = 'truco-arena layout-4';
    this.seatsContainer.innerHTML = '';
    this.trickDropzone.innerHTML = '<span class="trick-tabletop-label">Área de Vasa</span>';
    this.viraContainer.innerHTML = '';
    this.updateTopRightManilhasHUD(null);
    this.myHandElement.innerHTML = '';
    this.scoreTeam0.textContent = '0';
    this.scoreTeam1.textContent = '0';
    this.trickDots.forEach(d => d.className = 'trick-pip');

    this.openModal(this.lobbyModal);
    this.showToast('Retornou ao menu principal.');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new TrucoApp();
  // Abre o lobby por padrão ao carregar
  document.getElementById('lobbyModal')?.classList.add('active');
});
