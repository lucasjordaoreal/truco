// d:\truco\js\app.js
// Controlador principal de interface e fluxo do jogo Truco Paulista

const CHAT_BOT_NAMES = ['Chico Bento', 'Zeca Mão de Onze', 'Pedrão do Zap', 'Tião Carreiro', 'Tonho'];
const CHAT_BOT_ALIASES = [[], ['chico'], ['zeca', 'ze'], ['pedrao', 'pedro'], ['tiao'], ['tonho']];

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
    this.localPlayerName = 'Você';

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
    document.getElementById('btnOpenChat')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleChatPanel();
    });

    document.getElementById('btnCloseChat')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeChatPanel();
    });

    document.getElementById('btnChatSend')?.addEventListener('click', () => {
      this.handleChatSend();
    });

    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.handleChatSend(); }
    });

    // Chips de mensagens rápidas
    document.querySelectorAll('.chat-quick-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const msg = chip.getAttribute('data-msg');
        if (msg) {
          this.sendChatMessageDirect(msg);
        }
      });
    });

    // Fechar chat ao clicar fora ou pressionar Escape
    document.addEventListener('click', (e) => {
      if (this._chatOpen && this.chatPanel && !this.chatPanel.contains(e.target) && !e.target.closest('#btnOpenChat')) {
        this.closeChatPanel();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._chatOpen) {
        this.closeChatPanel();
      }
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
      window.TrucoAudio.setMuted(!window.TrucoAudio.muted);
      e.currentTarget.textContent = window.TrucoAudio.muted ? 'MUDO' : 'SOM';
      this.showToast(window.TrucoAudio.muted ? 'Sons desativados' : 'Sons ativados');
    });

    document.getElementById('btnToggleMusic')?.addEventListener('click', (e) => {
      window.TrucoMusic.setMuted(!window.TrucoMusic.muted);
      e.currentTarget.textContent = window.TrucoMusic.muted ? 'MÚSICA OFF' : 'MÚSICA ON';
      this.showToast(window.TrucoMusic.muted ? 'Música desativada' : 'Música ativada');
    });

    const sfxVolume = document.getElementById('sfxVolume');
    const musicVolume = document.getElementById('musicVolume');
    const savedSfxVolume = Number(localStorage.getItem('trucoSfxVolume'));
    const savedMusicVolume = Number(localStorage.getItem('trucoMusicVolume'));
    if (Number.isFinite(savedSfxVolume)) {
      sfxVolume.value = savedSfxVolume;
      window.TrucoAudio.setVolume(savedSfxVolume);
    }
    if (Number.isFinite(savedMusicVolume)) {
      musicVolume.value = savedMusicVolume;
      window.TrucoMusic.setVolume(savedMusicVolume);
    }
    sfxVolume?.addEventListener('input', (e) => {
      const volume = Number(e.currentTarget.value);
      window.TrucoAudio.setVolume(volume);
      localStorage.setItem('trucoSfxVolume', String(volume));
    });
    musicVolume?.addEventListener('input', (e) => {
      const volume = Number(e.currentTarget.value);
      window.TrucoMusic.setVolume(volume);
      localStorage.setItem('trucoMusicVolume', String(volume));
    });

    const startMusicFromInteraction = () => {
      window.TrucoMusic?.start?.();
    };
    document.addEventListener('pointerdown', startMusicFromInteraction);
    document.addEventListener('keydown', startMusicFromInteraction);
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
    if (peekIcon) peekIcon.textContent = '\u25c9';
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
    this.localPlayerName = playerName;
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

    for (let i = 1; i < numPlayers; i++) {
      playerConfigs.push({
        id: `bot_${i}`,
        name: CHAT_BOT_NAMES[i - 1] || `Bot ${i}`,
        isBot: true
      });
    }

    this.addChatMessage('system', '', `Partida iniciada — ${numPlayers} jogadores`);
    this.setupEngineAndBots(numPlayers, playerConfigs);
  }

  async handleCreateRoom() {
    const playerName = document.getElementById('createPlayerName').value.trim() || 'Criador';
    this.localPlayerName = playerName;
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
          name: this.roomConfig.fillBots ? (CHAT_BOT_NAMES[i - 1] || `Bot ${i}`) : 'Aguardando...',
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
    this.localPlayerName = playerName;

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
      // Diferenciar 1v1 de 2v2+ na mensagem de derrota
      const is1v1 = this.engine.numPlayers === 2;
      if (is1v1) {
        this.triggerEventBanner('DERROTA NA MÃO', `Adversário marcou +${points} ponto.`);
      } else {
        this.triggerEventBanner('DERROTA NA MÃO', `Adversários marcaram +${points} ponto.`);
      }
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
    if (peekIcon) peekIcon.textContent = isPeeking ? '\u25c0' : '\u25c9';
  }

  renderMaoDeOnzeModal() {
    if (!this.maoDeOnzeModal || !this.engine) return;

    // Reset modo espiar
    this.maoDeOnzeModal.classList.remove('is-peeking');
    const peekText = document.getElementById('m11PeekText');
    const peekIcon = document.getElementById('m11PeekIcon');
    if (peekText) peekText.textContent = 'Espiar Mesa';
    if (peekIcon) peekIcon.textContent = '\u25c9';

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

    if (this.engine.isMaoDeOnze && this.engine.maoDeOnzeDecisionPending) {
      const localPlayer = this.engine.players[this.myPlayerIndex];
      const localTeamCanDecide = localPlayer && !localPlayer.isBot && localPlayer.team === this.engine.maoDeOnzeTeam;
      if (localTeamCanDecide) {
        this.startTurnTimer();
      } else {
        this.stopTurnTimer();
      }
      return;
    }

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

      if (remaining > 0 && remaining <= 10) {
        window.TrucoAudio?.playCountdownTick?.(remaining);
      }

      if (remaining <= 0) {
        window.TrucoAudio?.playTimeoutWarning?.();
        this.stopTurnTimer();

        if (this.engine?.isMaoDeOnze && this.engine.maoDeOnzeDecisionPending && this.maoDeOnzeModal?.classList.contains('active')) {
          this.showToast('Tempo esgotado! Mão de onze aceita por 3 pontos.', 'warning');
          this.handleMaoDeOnzeDecision(true);
        } else {
          this._autoPlayRandomCard();
        }
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
    this.addChatMessage('system', '', joinText);
    this.network.broadcast({
      type: 'TOAST',
      message: joinText,
      toastType: 'success'
    });
    this.network.broadcast({
      type: 'CHAT_SYSTEM',
      text: joinText
    });
  }

  handleNetworkPlayerLeft(peerId) {
    if (!this.engine) return;
    const idx = this.engine.players.findIndex(p => p.id === peerId);
    if (idx !== -1) {
      const pName = this.engine.players[idx].name;
      this.engine.players[idx].name = CHAT_BOT_NAMES[idx - 1] || `Bot ${idx}`;
      this.engine.players[idx].isBot = true;
      this.bots[idx] = new TrucoBot(idx, this.engine);
      this.renderSeats();
      this.syncGameStateToClients();

      const disconnectText = `${pName} se desconectou. Um Bot assumiu a vaga.`;
      this.showToast(disconnectText, 'warning');
      this.addChatMessage('system', '', disconnectText);
      this.network.broadcast({
        type: 'TOAST',
        message: disconnectText,
        toastType: 'warning'
      });
      this.network.broadcast({
        type: 'CHAT_SYSTEM',
        text: disconnectText
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
    } else if (data.type === 'CHAT_SYSTEM') {
      this.addChatMessage('system', '', data.text);
    } else if (data.type === 'CHAT_TEXT' || data.type === 'CHAT') {
      let playerIdx = data.playerIndex;
      let pName = data.playerName;

      // Se for o Host recebendo de um cliente conectado, valida/corrige o índice pelo peerId
      if (this.network && this.network.isHost && fromPeerId && this.engine && this.engine.players) {
        const foundIdx = this.engine.players.findIndex(p => p.id === fromPeerId);
        if (foundIdx !== -1) {
          playerIdx = foundIdx;
          pName = this.engine.players[foundIdx].name;
          data.playerIndex = playerIdx;
          data.playerName = pName;
        }
      }

      // Se a mensagem partiu de nós mesmos (eco de broadcast), descarta
      if (data.peerId && this.network && data.peerId === this.network.myPeerId) {
        return;
      }
      if (playerIdx !== undefined && playerIdx !== null && playerIdx === this.myPlayerIndex && (!this.network || !this.network.isHost)) {
        return;
      }

      const author = pName || (this.engine?.players?.[playerIdx]?.name) || 'Jogador';
      this.addChatMessage('other', author, data.text, playerIdx);

      if (playerIdx !== undefined && playerIdx !== null && playerIdx >= 0) {
        this.sendSpeechBubble(playerIdx, data.text);
      }
      window.TrucoAudio?.playNotification?.();

      // Se formos o Host, repassa para todos os outros clientes conectados (exceto quem enviou)
      if (this.network && this.network.isHost) {
        this.network.broadcast(data, fromPeerId);
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
      this.engine.maoDeOnzeDecisionPending = data.maoDeOnzeDecisionPending !== false;
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

      if (this.engine.isMaoDeOnze && this.engine.maoDeOnzeDecisionPending && !this.engine.handOver) {
        const isMyTeam = (this.engine.players[this.myPlayerIndex].team === this.engine.maoDeOnzeTeam);
        if (isMyTeam && !this.maoDeOnzeModal.classList.contains('active')) {
          this.renderMaoDeOnzeModal();
          this.openModal(this.maoDeOnzeModal);
        }
      }

      // Para o cliente P2P: ativa o timer se for a vez dele e a mão não acabou
      const localMaoDeOnzeDecision = this.engine.isMaoDeOnze &&
        this.engine.maoDeOnzeDecisionPending &&
        this.engine.players[this.myPlayerIndex] &&
        this.engine.players[this.myPlayerIndex].team === this.engine.maoDeOnzeTeam &&
        !this.engine.players[this.myPlayerIndex].isBot;
      if (!this.engine.handOver && !this.engine.gameOver && !this.engine.pendingBet &&
        !this.isDealing && (this.engine.currentTurnIndex === this.myPlayerIndex || localMaoDeOnzeDecision)) {
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
          maoDeOnzeDecisionPending: this.engine.maoDeOnzeDecisionPending,
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
    document.getElementById('btnOpenChat')?.classList.add('is-active');
    this._chatUnread = 0;
    this.chatUnreadBadge.style.display = 'none';
    this.chatUnreadBadge.textContent = '0';
    // Scroll para baixo
    setTimeout(() => {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      this.chatInput?.focus();
    }, 220);
  }

  closeChatPanel() {
    this._chatOpen = false;
    this.chatPanel.classList.remove('is-open');
    document.getElementById('btnOpenChat')?.classList.remove('is-active');
  }

  /**
   * Adiciona uma mensagem no painel de chat.
   * @param {'mine'|'other'|'system'} side  - quem enviou
   * @param {string} author                 - nome do jogador
   * @param {string} text                   - conteúdo
   * @param {number|null} playerIndex       - índice do jogador (opcional)
   */
  addChatMessage(side, author, text, playerIndex = null, options = {}) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${side}`;

    if (side !== 'system') {
      const authorEl = document.createElement('div');
      authorEl.className = 'chat-msg-author';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'chat-msg-name';
      nameSpan.textContent = author;
      authorEl.appendChild(nameSpan);

      // Identifica parceiro ou adversário em mesas com 4 jogadores
      if (this.engine && this.engine.players && playerIndex !== null && playerIndex !== undefined) {
        const player = this.engine.players[playerIndex];
        const myPlayer = (this.engine.players && this.myPlayerIndex !== undefined) ? this.engine.players[this.myPlayerIndex] : null;
        if (player && myPlayer && this.engine.numPlayers === 4 && side !== 'mine') {
          const tagSpan = document.createElement('span');
          if (player.team === myPlayer.team) {
            tagSpan.className = 'chat-msg-tag partner';
            tagSpan.textContent = 'Parceiro';
            authorEl.appendChild(tagSpan);
          } else {
            tagSpan.className = 'chat-msg-tag opponent';
            tagSpan.textContent = 'Adversário';
            authorEl.appendChild(tagSpan);
          }
        }
      }

      // Horário da mensagem
      const timeSpan = document.createElement('span');
      timeSpan.className = 'chat-msg-time';
      const now = new Date();
      timeSpan.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      authorEl.appendChild(timeSpan);

      msg.appendChild(authorEl);
    }

    const bubble = document.createElement('div');
    bubble.className = 'chat-msg-bubble';
    const shouldAnimate = !options.typing && (options.animate ?? side === 'other');
    if (options.typing) {
      bubble.classList.add('chat-typing-bubble');
      bubble.innerHTML = '<span></span><span></span><span></span>';
    } else if (!shouldAnimate) {
      bubble.textContent = text;
    } else {
      bubble.textContent = '';
    }
    msg.appendChild(bubble);
    this.chatMessages.appendChild(msg);
    if (shouldAnimate) this._typeChatText(bubble, text);
    requestAnimationFrame(() => {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    });

    // Badge de não lida quando painel está fechado
    if (!options.skipUnread && !this._chatOpen && side !== 'system') {
      this._chatUnread++;
      this.chatUnreadBadge.style.display = 'flex';
      this.chatUnreadBadge.textContent = this._chatUnread > 9 ? '9+' : this._chatUnread;
    }

    return msg;
  }

  _typeChatText(element, text) {
    let position = 0;
    const writeNextCharacter = () => {
      if (!element.isConnected) return;
      element.textContent = text.slice(0, position++);
      if (position <= text.length) {
        setTimeout(writeNextCharacter, 18);
      }
    };
    writeNextCharacter();
  }

  showChatTyping(author, playerIndex = null) {
    return this.addChatMessage('other', author, '', playerIndex, {
      typing: true,
      skipUnread: true,
      animate: false
    });
  }

  /**
   * Envia uma mensagem de chat diretamente (por texto digitado ou chip rápido).
   * @param {string} text - Mensagem a ser enviada
   * @param {string} author - Autor da mensagem
   */
  sendChatMessageDirect(text, author = 'Jogador') {
    if (author.trim().toLowerCase() === 'ia') return;
    if (!text || !text.trim()) return;
    text = text.trim();

    const myName = (this.engine && this.engine.players && this.engine.players[this.myPlayerIndex] && !this.engine.players[this.myPlayerIndex].isBot)
      ? this.engine.players[this.myPlayerIndex].name
      : (this.localPlayerName || this.network?.clientInfo?.name || 'Você');

    this.addChatMessage('mine', myName, text, this.myPlayerIndex);
    if (this.myPlayerIndex !== undefined && this.myPlayerIndex !== null && this.myPlayerIndex >= 0) {
      this.sendSpeechBubble(this.myPlayerIndex, text);
    }

    // Multiplayer: broadcast para todos (Host) ou envio ao Host (Cliente)
    if (!this.isSinglePlayer && this.network) {
      const msg = {
        type: 'CHAT_TEXT',
        playerIndex: this.myPlayerIndex,
        playerName: myName,
        peerId: this.network.myPeerId,
        text
      };
      if (this.network.isHost) {
        this.network.broadcast(msg);
      } else {
        this.network.sendToHost(msg);
      }
    }

    // Inicia uma conversa curta entre os bots-IA da mesa.
    const botIndex = this._getAiChatBotIndex(text);
    this._startAiChatConversation(text, botIndex, 0, [], myName);
  }

  _startAiChatConversation(message, botIndex, turn = 0, previousBotIndices = [], sourceAuthor = 'Jogador') {
    if (botIndex === null || turn >= 3) return;

    const botName = this.engine?.players?.[botIndex]?.name || CHAT_BOT_NAMES[0];
    const typingMessage = this.showChatTyping(botName, botIndex);
    const thinkingDelay = 900 + Math.min(message.length * 18, 1200);
    setTimeout(() => this.solicitarRespostaGemini(message, botIndex, sourceAuthor).then((response) => {
      typingMessage.remove();
      if (!response) {
        // Mantém a reação local caso a API esteja indisponível no modo solo.
        if (turn === 0 && this.isSinglePlayer) this._botChatReaction(message);
        return;
      }

      this.addChatMessage('other', response.botName, response.text, response.botIndex);
      if (response.botIndex !== null) this.sendSpeechBubble(response.botIndex, response.text);
      window.TrucoAudio?.playNotification?.();

      const nextBotIndex = this._getAiChatBotIndex(
        response.text,
        [...previousBotIndices, botIndex],
        this.engine?.players?.[botIndex]?.team
      );
      if (nextBotIndex !== null && turn < 1 && this._shouldContinueAiConversation(response.text, botIndex)) {
        const readingPause = 1800 + Math.min(response.text.length * 16, 1800);
        setTimeout(() => {
          this._startAiChatConversation(response.text, nextBotIndex, turn + 1, [...previousBotIndices, botIndex], response.botName);
        }, readingPause);
      }
    }), thinkingDelay);
  }

  /**
   * Solicita uma resposta curta da IA para uma mensagem do jogador.
   * Retorna null quando a API falha, permitindo que o chat continue funcionando.
   * @param {string} mensagemUsuario - Mensagem enviada pelo jogador humano
   * @param {number|null} botIndex - Índice do bot que responderá
  * @param {string} autorMensagem - Nome de quem iniciou a fala
   * @returns {Promise<{text: string, botName: string, botIndex: number|null}|null>} Resposta formatada ou null
   */
  async solicitarRespostaGemini(mensagemUsuario, botIndex = null, autorMensagem = 'Jogador') {
    try {
      if (!window.TrucoConstants.GEMINI_API_ENDPOINT) return null;

      const gameContext = this._getChatGameContext();
      const botName = botIndex !== null && this.engine?.players?.[botIndex]
        ? this.engine.players[botIndex].name
        : CHAT_BOT_NAMES[0];
      const botTeam = botIndex !== null ? this.engine?.players?.[botIndex]?.team : null;
      const sourcePlayer = this.engine?.players?.find(player => player.name === autorMensagem);
      const sourceIsAlly = sourcePlayer && botTeam !== null && sourcePlayer.team === botTeam;
      const identityAliasText = botName === CHAT_BOT_NAMES[1]
        ? 'Zeca e Zé são a mesma pessoa; use Zeca Mão de Onze como nome exibido.'
        : '';
      const matchFormatText = this.engine?.numPlayers === 2
        ? 'Esta é uma partida 1v1. Você não tem parceiro: o jogador humano é seu único adversário e nunca deve ser tratado como aliado.'
        : `Esta é uma partida ${this.engine?.numPlayers || 4}P. Respeite as equipes: bots da sua equipe são aliados e os demais são adversários.`;
      const relationshipText = sourceIsAlly
        ? `${autorMensagem} é seu parceiro de equipe. Converse com cooperação e nunca ameace ou trate essa pessoa como adversário.`
        : `${autorMensagem} é adversário. Você pode provocar, mas continue jogando dentro do clima do truco.`;
      const contextText = gameContext
        ? `Contexto atual: placar ${gameContext.myScore} a ${gameContext.botScore}, vale ${gameContext.currentStake}, vasa ${gameContext.playerVasas} a ${gameContext.botVasas}.`
        : 'Contexto atual: partida de truco em andamento.';

      const response = await fetch(window.TrucoConstants.GEMINI_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Você é ${botName}, um jogador de truco brasileiro sentado à mesa nesta partida.
Fale com o mesmo linguajar informal, debochado e provocador dos bots do jogo, como uma conversa natural de mesa.
Seu nome é exatamente "${botName}"; nunca troque, abrevie ou invente variações como "Pedro". Sua personalidade deve combinar com esse apelido. Use expressões de truco e referências à rodada quando fizer sentido. Pode fazer trash talk leve e usar gírias, mas nunca explique que é uma IA, nunca saia do personagem e nunca invente regras.
${identityAliasText}
${matchFormatText}
Se a mensagem mencionar dois bots, o primeiro nome citado é quem foi chamado para falar; o segundo é apenas o personagem da conversa. Nunca trate o nome de outro bot como se fosse o nome do jogador humano.
${relationshipText}
Responda com uma única frase curta, idealmente entre 6 e 15 palavras, sem listas, discurso ou prefácio.
${contextText}

Mensagem de ${autorMensagem}: ${mensagemUsuario}`
            }]
          }],
          generationConfig: {
            maxOutputTokens: 60,
            temperature: 0.9
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini respondeu com HTTP ${response.status}`);
      }

      const data = await response.json();

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new Error('Resposta vazia da Gemini');
      return { text, botName, botIndex };
    } catch (error) {
      console.error('Não foi possível obter resposta da Gemini:', error);
      return null;
    }
  }

  _shouldContinueAiConversation(text, currentBotIndex) {
    const normalizedText = (text || '').toLowerCase();
    const otherBotMentioned = (this.engine?.players || []).some((player, index) => {
      if (!player?.isBot || index === currentBotIndex) return false;
      const aliases = [
        player.name.toLowerCase().split(/\s+/)[0],
        ...(CHAT_BOT_ALIASES[index] || [])
      ];
      return aliases.some(alias => normalizedText.includes(alias));
    });
    const invitation = /[?!]|\b(fala|responde|responda|e voce|vem|aceita|duvida|quero ver)\b/i.test(text || '');
    return otherBotMentioned || invitation;
  }

  _getAiChatBotIndex(message, excludedIndices = [], preferredTeam = null) {
    const players = this.engine?.players || [];
    const botIndices = players
      .map((player, index) => player?.isBot ? index : null)
      .filter(index => index !== null && !excludedIndices.includes(index));
    if (botIndices.length === 0) return null;

    const normalize = (value) => (value || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizedMessage = normalize(message);
    const mentionedBot = botIndices
      .map(index => {
        const normalizedName = normalize(players[index].name);
        const aliases = [normalizedName, ...(CHAT_BOT_ALIASES[index] || [])];
        const positions = aliases
          .map(alias => normalizedMessage.indexOf(alias))
          .filter(position => position !== -1);
        const position = positions.length > 0 ? Math.min(...positions) : -1;
        return { index, position };
      })
      .filter(candidate => candidate.position !== -1)
      .sort((a, b) => a.position - b.position)[0];
    if (mentionedBot) return mentionedBot.index;

    const intent = this._detectChatIntent(message || '')[0] || 'generic';
    const myTeam = players[this.myPlayerIndex]?.team;
    const currentTurn = this.engine?.currentTurnIndex;
    const context = this._getChatGameContext();
    const allyIntents = new Set(['team_talk', 'praise', 'greeting', 'farewell']);
    const enemyIntents = new Set(['provocation', 'truco_talk', 'frustration', 'confidence']);
    const personaIntents = [
      ['greeting', 'generic', 'praise'],
      ['team_talk', 'score_talk', 'doubt'],
      ['truco_talk', 'card_talk', 'confidence'],
      ['provocation', 'frustration', 'laugh'],
      ['farewell', 'reaction', 'generic']
    ];

    return botIndices
      .map(index => {
        const bot = players[index];
        const isAlly = bot.team === myTeam;
        let score = personaIntents[index % personaIntents.length].includes(intent) ? 4 : 0;
        if (allyIntents.has(intent) && isAlly) score += 8;
        if (enemyIntents.has(intent) && !isAlly) score += 8;
        if (preferredTeam !== null && bot.team === preferredTeam) score += 10;
        if (index === currentTurn) score += 2;
        if (context && bot.team === 1 - myTeam && context.botScore > context.myScore) score += 1;
        return { index, score };
      })
      .sort((a, b) => b.score - a.score)[0].index;
  }

  handleChatSend() {
    if (!this.chatInput) return;
    const text = this.chatInput.value.trim();
    if (!text) return;
    this.chatInput.value = '';
    this.sendChatMessageDirect(text);
  }

  // =========================================================================
  // SISTEMA INTELIGENTE DE CHAT DOS BOTS
  // =========================================================================

  /**
   * Detecta a intenção da mensagem do jogador usando classificação por palavras-chave.
   * Retorna um array de intents ordenado por confiança.
   */
  _detectChatIntent(text) {
    const t = text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();

    const intentScores = new Map();
    const matchesTerm = (term) => {
      const normalizedTerm = term.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim();
      const pattern = normalizedTerm
        .split(/\s+/)
        .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('\\s+');
      return new RegExp(`(^|\\s)${pattern}(?=\\s|$)`).test(t);
    };
    const addIntent = (intent, words, weight = 1) => {
      const matches = words.filter(matchesTerm);
      if (matches.length > 0) {
        const phraseBonus = matches.reduce((total, word) => total + (word.includes(' ') ? 2 : 1), 0);
        intentScores.set(intent, phraseBonus * weight);
      }
    };

    // — Saudação
    const greetWords = ['oi', 'ola', 'eai', 'e ai', 'fala', 'salve', 'bom dia', 'boa tarde', 'boa noite', 'buenas', 'hey', 'hello', 'hi', 'ae', 'beleza', 'firmeza', 'suave', 'tranquilo', 'fala ai', 'como vai', 'tudo bem', 'tudo certo'];
    addIntent('greeting', greetWords);

    // — Provocação / Trash talk
    const provWords = ['ruim', 'fraco', 'lixo', 'noob', 'perdedor', 'cagao', 'cagou', 'medo', 'covarde', 'otario', 'trouxa', 'burro', 'idiota', 'bosta', 'merda', 'nada', 'nao sabe', 'aprende', 'volta pra', 'nao aguenta', 'frouxo', 'patético', 'ridiculo', 'mole', 'vai chorar', 'chora', 'chorao', 'chorando', 'arregou', 'arrega', 'corre', 'fugiu', 'pipoca', 'amarelou', 'medroso', 'perna bamba', 'perdeu mal'];
    addIntent('provocation', provWords, 1.2);

    // — Elogio / Boa jogada
    const praiseWords = ['boa', 'parabens', 'mandou bem', 'boa jogada', 'show', 'bonito', 'top', 'monstro', 'craque', 'mito', 'fera', 'brabo', 'braba', 'demais', 'daora', 'sensacional', 'incrivel', 'excelente', 'genial', 'lindo', 'jogou bem', 'bem jogado', 'boaa', 'nice', 'gostei', 'isso ai'];
    addIntent('praise', praiseWords);

    // — Truco / Aposta
    const trucoWords = ['truco', 'seis', 'nove', 'doze', 'trucão', 'trucao', 'pede truco', 'mete truco', 'manda truco', 'vale', 'aposta', 'aumenta', 'retruca'];
    addIntent('truco_talk', trucoWords, 1.3);

    // — Manilha / Carta específica
    const cardWords = ['manilha', 'zap', 'copeta', 'espadilha', 'picafumo', 'ouros', 'tres', '3', 'carta', 'mao', 'vira'];
    addIntent('card_talk', cardWords);

    // — Placar / Score
    const scoreWords = ['placar', 'pontos', 'ganhando', 'perdendo', 'empate', 'empatado', 'score', 'quanto', 'ponto', 'atras', 'na frente', 'vantagem'];
    addIntent('score_talk', scoreWords, 1.3);

    // — Dúvida / Incerteza
    const doubtWords = ['sera', 'nao sei', 'duvido', 'acho que', 'talvez', 'hmm', 'hm', 'eita', 'nossa', 'caramba', 'misericordia', 'jesus', 'meu deus', 'duvida', 'como', 'por que', 'porque'];
    addIntent('doubt', doubtWords);

    // — Pedido de ajuda / parceiro
    const teamWords = ['parceiro', 'parceira', 'dupla', 'time', 'equipe', 'ajuda', 'confia', 'comigo', 'junto', 'nosso', 'nossa', 'bora', 'vamo', 'vamos'];
    addIntent('team_talk', teamWords);

    // — Despedida / Fim
    const byeWords = ['tchau', 'flw', 'falou', 'ate mais', 'ate logo', 'fui', 'saindo', 'vou sair', 'bye', 'adeus', 'valeu', 'obrigado', 'obrigada', 'tmj', 'vlw'];
    addIntent('farewell', byeWords, 1.2);

    // — Risada
    const laughWords = ['haha', 'kkk', 'rsrs', 'lol', 'rir', 'huahua', 'hehe', 'ahahah', 'kkkkk', 'kkkk', 'rss', 'huehue', 'hue'];
    addIntent('laugh', laughWords);

    // — Reclamação / Frustração
    const frustrWords = ['droga', 'pqp', 'puts', 'cacete', 'caralho', 'inferno', 'desgraca', 'azar', 'que azar', 'impossivel', 'injusto', 'absurdo', 'que carta', 'nao acredito', 'roubado', 'roubando', 'hack'];
    addIntent('frustration', frustrWords, 1.2);

    // — Confiança / Arrogância
    const confWords = ['facil', 'tranquilo', 'moleza', 'barbada', 'ja ganhei', 'ja era', 'sem chance', 'impossivel perder', 'to on', 'to forte', 'minha vez'];
    addIntent('confidence', confWords, 1.1);

    // — Emoji / Reação pura
    if (t.replace(/\s/g, '').length <= 3 && /[!?]/.test(text)) intentScores.set('reaction', 1);

    const intents = [...intentScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([intent]) => intent);
    return intents.length > 0 ? intents : ['generic'];
  }

  /**
   * Monta o contexto do jogo para os bots responderem de forma inteligente.
   */
  _getChatGameContext() {
    if (!this.engine || !this.engine.players) return null;
    const e = this.engine;
    const myTeam = e.players[this.myPlayerIndex]?.team ?? 0;
    const oppTeam = 1 - myTeam;

    let botVasas = 0;
    let playerVasas = 0;
    for (const w of (e.roundWinners || [])) {
      if (w === oppTeam) botVasas++;
      else if (w === myTeam) playerVasas++;
    }

    return {
      myScore: e.scores[myTeam] || 0,       // pontuação do jogador humano
      botScore: e.scores[oppTeam] || 0,      // pontuação do time dos bots
      botVasas,
      playerVasas,
      currentRound: e.currentRound || 0,
      currentStake: e.currentStake || 1,
      handOver: !!e.handOver,
      gameOver: !!e.gameOver,
      isMaoDeOnze: !!e.isMaoDeOnze,
      isMaoDeFerro: !!e.isMaoDeFerro
    };
  }

  /**
   * Escolhe a resposta do bot com base no intent detectado e no estado do jogo.
   * SEM FILTRO — linguagem autêntica de mesa de truco brasileiro.
   * @param {string} intent - A intenção principal detectada
   * @param {object} ctx - Contexto do jogo
   * @param {number} botIndex - Índice do bot respondente
   * @param {string} sourceText - Mensagem original do jogador
   * @returns {string} Resposta do bot
   */
  _buildBotResponse(intent, ctx, botIndex, sourceText = '') {
    // Personalidades dos bots por índice (cicla entre 3 tipos)
    const persona = (botIndex % 3); // 0=debochado, 1=zoeiro, 2=agressivo/boca suja

    const responseSeed = this._getStableChatHash([
      sourceText,
      intent,
      botIndex,
      ctx?.myScore,
      ctx?.botScore,
      ctx?.currentStake,
      ctx?.currentRound
    ].join('|'));
    const pick = (arr) => arr[responseSeed % arr.length];

    // Helpers de contexto
    const botWinning = ctx && ctx.botScore > ctx.myScore;
    const botLosing = ctx && ctx.botScore < ctx.myScore;
    const bigLead = ctx && (ctx.botScore - ctx.myScore >= 5);
    const bigDeficit = ctx && (ctx.myScore - ctx.botScore >= 5);
    const closeGame = ctx && Math.abs(ctx.botScore - ctx.myScore) <= 2;
    const botWonVasa = ctx && ctx.botVasas > ctx.playerVasas;
    const highStake = ctx && ctx.currentStake >= 6;

    switch (intent) {
      case 'greeting':
        return pick([
          'E aí, cuzão! Bora jogar! 🃏',
          'Salve! Preparado pra tomar no cu? 😏',
          'Fala aí, otário! Vamos ver quem manda!',
          'Opa! Chegou a vítima! 😂',
          'Eai caralho! Senta aí e chora! 🔥',
          'Beleza? Aqui na mesa é na porrada! 💪',
          'Fala, porra! Bora meter a mão nesse baralho!',
          'E aí! Trouxe lenço? Vai precisar! 😭',
          'Oi, corno! Senta que lá vem pedrada! 🃏'
        ]);

      case 'provocation':
        if (botWinning) {
          return pick([
            'Fala mais, arrombado! O placar tá a meu favor! 😂',
            `Tá puto porque tô ganhando de ${ctx.botScore} a ${ctx.myScore}? Chupa! 🤣`,
            'Xinga mais, desgraçado! Cada xingo meu jogo melhora! 😏',
            'Tá bravinho? O placar tá aí pra quem quiser ver, otário! 📊',
            'Vai se fuder! Difícil é virar esse placar! 😂',
            'Cala a boca e joga, perdedor! Tá levando um sacode! 🤣',
            'Fala merda não, tá apanhando que nem cachorro! 💀'
          ]);
        }
        if (botLosing) {
          return pick([
            'Aproveita enquanto pode, filho da puta! A virada vem! 🔥',
            'Tá com essa moral toda agora? Vai tomar no cu! Espera eu pegar uma manilha! 😈',
            'Fala mais que eu guardo tudo pra enfiar na tua cara depois! 💪',
            'Ri agora, desgraçado! Daqui a pouco é tu chorando! 😤',
            'Cala essa boca! O jogo muda rápido, cuzão!',
            'Tá se achendo, né? Vai tomar no cu! Espera a virada! 🔥',
            'Fala, fala! Quando eu virar tu vai engolir cada palavra, arrombado!'
          ]);
        }
        return pick([
          'Opa, tá querendo guerra, filho da puta? Bora! 🔥',
          'Guarda essa energia pra chorar depois, cuzão! 😏',
          'Eita, o cara tá bravo! Vai tomar no cu! 😂',
          'Continua latindo que eu continuo ganhando vasa, otário! 🃏',
          'Quem fala demais joga de menos! Cala a boca e joga! 🤫',
          'Vai se fuder! Aqui é mesa de truco, não creche! 😤',
          'Fala merda não, porra! Joga essa carta logo!'
        ]);

      case 'praise':
        if (botWonVasa) {
          return pick([
            'Claro, porra! Eu sou foda! 😎',
            'Essa foi de cair o cu da bunda, né? Tem mais! 🎯',
            'Valeu! Sou brabo mesmo, caralho! 💪',
            'Obrigado! Agora abaixa a cabeça que lá vem mais! 😏'
          ]);
        }
        return pick([
          'Valeu, mas o jogo tá só começando, porra! 🃏',
          'Obrigado! Agora para de puxar saco e joga! 😏',
          'Boa! Mas não se empolga não que eu meto a porrada! 😄',
          'Elogio aceito! Mas o Zap ainda não apareceu pra te fuder! 👀',
          'Puxando saco não vai adiantar, otário! Joga! 😂'
        ]);

      case 'truco_talk':
        if (highStake) {
          return pick([
            `Vale ${ctx.currentStake} já! Quer mais? Tô dentro, caralho! 🔥`,
            'Nessa aposta alta, quem arrega é cuzão! 😤',
            'Eita, tá ficando sério! Mas eu não corro não, porra! 💪',
            'Alto demais? Pra mim tá perfeito! Bora pra cima, desgraça! 😈',
            'Tá cagando de medo? Aceita logo, covarde! 🔥'
          ]);
        }
        return pick([
          'Truco? Pode pedir, caralho! Eu aceito ou meto mais! 😏',
          'Quer truco? Cuidado com o que deseja, cuzão! 🃏',
          'Falar de truco é fácil, quero ver pedir quando eu tiver o Zap na mão! 😂',
          'Truco é pra quem tem culhão! Bora! 🔥',
          'Pede logo essa merda! Tô esperando! 💪',
          'Quer truco? Pede, porra! Tô louco pra aceitar e te fuder! 😈'
        ]);

      case 'card_talk':
        return pick([
          'Manilha? Tô guardando a minha pra enfiar no teu rabo! 😏',
          'Cuidado, o Zap pode tá aqui comigo, otário! 🤫',
          'Tô de olho na vira! Sei bem o que é manilha, diferente de tu! 👀',
          'Carta boa todo mundo tem. Mas jogar que nem gente é outro papo! 🎯',
          'Quem conta com manilha antes de ver, se fode! 😂',
          'A vira tá aí, faz as contas... se tu souber matemática, burro! 🧮',
          'Carta? Minha mão tá tão boa que dá vontade de te mostrar só pra te ver chorar! 🃏'
        ]);

      case 'score_talk':
        if (ctx) {
          if (botWinning && bigLead) {
            return pick([
              `Tô com ${ctx.botScore} a ${ctx.myScore}! Se fudeu, otário! 😏`,
              'Olha esse placar! Tá feio pra caralho pro teu lado! 📊',
              'Difícil virar agora! Vai chorar? 😂',
              `${ctx.botScore} a ${ctx.myScore}! Tá levando um baile, cuzão! 💀`
            ]);
          }
          if (botLosing && bigDeficit) {
            return pick([
              `Tá ${ctx.myScore} a ${ctx.botScore}, mas o jogo não acabou, porra! 💪`,
              'Calma, já vi virada maior que essa! Vai tomar no cu! 🔥',
              'Placar é só número, arrombado. Na mesa que se decide! 🃏',
              'Tá ganhando por enquanto! Mas prepara o cu que a virada vem! 😤'
            ]);
          }
          if (closeGame) {
            return pick([
              `Tá ${ctx.botScore} a ${ctx.myScore}! Jogo apertado pra caralho! 🔥`,
              'Emparelhado assim? Cada vasa vale ouro, porra! 💎',
              'Placar apertado! Agora o bicho vai pegar! 😤'
            ]);
          }
        }
        return pick([
          'Placar? Relaxa, o que importa é quem chega nos 12 primeiro, otário! 🏆',
          'Foco no jogo, porra! Placar a gente resolve na mesa! 🃏',
          'Para de olhar placar e joga, caralho! 😂'
        ]);

      case 'doubt':
        return pick([
          'Duvidou? Então toma na cara essa carta! 😏',
          'Tá na dúvida? Normal, contra mim é foda mesmo! 😂',
          'A dúvida é o primeiro passo pra se fuder! 🃏',
          'Fica na dúvida não! O resultado sai na mesa, cuzão! 💪',
          'Tá pensativo? Enquanto tu pensa, eu como teu cu no truco! 🎯',
          'Duvida? Duvida do caralho! Joga logo! 😤'
        ]);

      case 'team_talk':
        // Bot verifica se o jogador é parceiro ou adversário
        if (this.engine && this.engine.numPlayers >= 4) {
          const botTeam = this.engine.players[botIndex]?.team;
          const playerTeam = this.engine.players[this.myPlayerIndex]?.team;
          if (botTeam === playerTeam) {
            return pick([
              'Confia no pai, caralho! Tenho carta boa aqui! 🤝',
              'Parceiro, tô contigo! Bora fuder esses otários! 💪',
              'Deixa comigo, porra! A vasa é nossa! 🔥',
              'Confia! Quando eu pedir, aceita que é gol! 😏',
              'Tô junto! Manda brasa que eu seguro essa merda atrás! 🛡️',
              'Bora comer esses cuzão! Parceiro é parceiro! 💪'
            ]);
          }
        }
        return pick([
          'Time? Aqui é cada um por si e o Zap fode todos! 😂',
          'Bora ver quem é o time de verdade, otário! 🏆',
          'Equipe boa é equipe que ganha vasa, não que fica de conversinha! 💪',
          'Quer falar de time? Meu time vai comer o cu do teu! 🔥'
        ]);

      case 'farewell':
        return pick([
          'Já vai? Que isso, cagão! A gente tava só começando! 😄',
          'Tá fugindo, é? Covarde do caralho! 🃏',
          'Falou! Boa sorte na próxima... vai precisar, otário! 😂',
          'Vai embora? Vai chorar no cantinho? 😏',
          'Até mais! Foi bom te dar essa surra! 🏆',
          'Vai tarde! Volta quando aprender a jogar, cuzão! 💀',
          'Tchau, perdedor! Quando quiser apanhar de novo é só voltar! 😂'
        ]);

      case 'laugh':
        if (botLosing) {
          return pick([
            'Ri, ri, arrombado... mas eu ainda tô na mesa! 😤',
            'Essa risada vai virar choro! Espera só, filho da puta! 🔥',
            'Kkkkk pra tu! Na próxima tu vai chorar, desgraçado! 😏',
            'Ri agora! Quando eu virar tu vai enfiar essa risada no cu! 😤'
          ]);
        }
        return pick([
          'Kkkk tá rindo de quê, cuzão? 😂',
          'Ri enquanto pode, arrombado! 🤣',
          'Hahaha! Pelo menos tá se divertindo antes de perder! 😄',
          'Kkkkk a mesa tá animada! Mas o jogo é sério, porra! 🃏',
          'Kkkkk ri mesmo! Quando eu meter o Zap tu vai rir de nervoso! 😂'
        ]);

      case 'frustration':
        if (botWinning) {
          return pick([
            'Eita, tá puto! É o placar, né? 😂',
            'Calma, calma! Ainda dá tempo de perder mais, otário! 🤣',
            'Azar o caralho! É que eu jogo bem demais, aceita! 😏',
            'A culpa não é minha se o Zap me ama e te odeia! 🃏',
            'Tá nervoso? Vai tomar no cu! Quem manda sou eu! 💀',
            'Xingando a carta? Xinga tua mão merda, cuzão! 😂'
          ]);
        }
        return pick([
          'Epa, calma aí, porra! Jogo é jogo! 😄',
          'Azar acontece! Mas para de chorar e joga, caralho! 💪',
          'Sei como é... mas foco na mesa, cuzão! 🎯',
          'Xingar a carta não muda ela, burro! 😂',
          'Para de reclamar e joga essa merda, porra! 😤',
          'Tá reclamando? Então levanta da mesa, covarde! 🔥'
        ]);

      case 'confidence':
        if (botWinning) {
          return pick([
            'Fácil? Fácil o caralho! Olha o placar, otário! 😂',
            'Tranquilo pra quem? Tá tomando um sacode! 📊',
            'Essa confiança toda vai te custar caro, cuzão! 😈',
            'Fácil? Tu tá perdendo, burro do caralho! 💀'
          ]);
        }
        if (botLosing) {
          return pick([
            'Tá confiante agora, né? Vai tomar no cu! Espera a virada! 🔥',
            'Fácil é quando acaba, arrombado! Ainda não acabou! 💪',
            'Excesso de confiança é meu combustível, otário! 😏',
            'Fica aí se achendo! Quando eu virar tu vai cagar de medo! 😈'
          ]);
        }
        return pick([
          'Confiança é bom, excesso é burrice! 😏',
          'Fácil? Então pede truco pra ver se é fácil mesmo, cuzão! 🔥',
          'Todo mundo é valente antes do Zap aparecer pra comer teu cu! 🃏',
          'Tá se achendo o fodão? Joga logo, caralho! 😤'
        ]);

      case 'reaction':
        return pick([
          '👀', '🤔', '😏', '🖕', '💪', '🔥', '😂', '💀'
        ]);

      case 'generic':
      default: {
        // Resposta contextual genérica baseada no estado do jogo
        if (ctx && ctx.isMaoDeOnze) {
          return pick([
            'Mão de Onze! Agora é tudo ou nada, porra! 🔥',
            'Onze pontos! O bicho vai pegar, caralho! 😤',
            'Mão de onze! Hora de meter a porrada! 💪',
            'Onze! Quem cagar de medo perde! 🔥'
          ]);
        }
        if (ctx && ctx.isMaoDeFerro) {
          return pick([
            'Mão de Ferro! Às cegas e na coragem, porra! 🔥',
            '11 a 11! Não dá pra ver carta! É na fé e no cu dos outro! 😤',
            'Mão de Ferro! Quem se foder, se fudeu! 💀'
          ]);
        }
        if (ctx && highStake) {
          return pick([
            `Valendo ${ctx.currentStake}! Agora é sério, caralho! 🔥`,
            'Com essa aposta alta, cala a boca e joga! 🤫',
            'Eita, o negócio tá ficando caro! Cagou? 💰',
            `${ctx.currentStake} pontos na mesa! Quem arrega é cuzão! 🔥`
          ]);
        }
        // Frases de contexto genérico
        const genericPool = [
          'Cala a boca e joga! 🃏',
          'Vamos ver quem manda aqui, caralho! 💪',
          'Joga aí, tô esperando, porra! 😏',
          'Para de enrolar e joga essa merda! 🎯',
          'A mesa tá quente hoje! 🔥',
          'Conversa fiada do caralho! Quero ver na carta! 😂',
          'Tô te estudando, cuzão... cuidado! 👀',
          'Mais uma vasa e tu vai chorar! 🃏',
          'Na mesa que se resolve, otário! Bora jogar! 💪',
          'Hmm, interessante... mas joga logo, porra! 🤔',
          'Menos papo e mais carta, caralho! 😤',
          'Fala, fala! Na hora de jogar tu caga! 💀'
        ];

        if (persona === 0) {
          genericPool.push(
            'Relaxa, cuzão... jogo é jogo! 😌',
            'Cada um no seu tempo, mas tu tá lento demais, porra! ⏳'
          );
        } else if (persona === 1) {
          genericPool.push(
            'Kkkk aham, sei! 😂',
            'Boa! Agora cala a boca e joga! 🃏',
            'Eita caralho! 😅'
          );
        } else {
          genericPool.push(
            'Menos conversa, mais carta, filho da puta! 😤',
            'Na mesa, guerreiro! Ou tu é covarde? 🔥',
            'Vai jogar ou vai ficar aí batendo punheta? 💀'
          );
        }

        return pick(genericPool);
      }
    }
  }

  _getStableChatHash(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /**
   * Bot responde ao chat do jogador de forma inteligente.
   * Analisa a mensagem, detecta a intenção e responde com contexto do jogo.
   */
  _botChatReaction(playerMessage) {
    if (!this.engine || !this.bots) return;

    const botIndices = Object.keys(this.bots).filter(i => this.bots[i]);
    if (botIndices.length === 0) return;

    // Detecta a intenção da mensagem
    const intents = this._detectChatIntent(playerMessage || '');
    const primaryIntent = intents[0] || 'generic';

    // Contexto do jogo
    const ctx = this._getChatGameContext();

    // Sempre responde uma vez: o bot e a frase são definidos de forma determinística.
    const botChoice = this._getStableChatHash(playerMessage || 'mensagem') % botIndices.length;
    const respondingIdx = parseInt(botIndices[botChoice]);
    const botName = this.engine.players[respondingIdx] ? this.engine.players[respondingIdx].name : `Bot ${respondingIdx}`;
    const response = this._buildBotResponse(primaryIntent, ctx, respondingIdx, playerMessage);

    // Delay natural de digitação (600ms a 1800ms, mais longo para respostas maiores)
    const typingDelay = 600 + Math.min(response.length * 15, 1200);

    setTimeout(() => {
      this.addChatMessage('other', botName, response, respondingIdx);
      this.sendSpeechBubble(respondingIdx, response);
      window.TrucoAudio?.playNotification?.();
    }, typingDelay);
  }

  /** Bot manda mensagem de chat num evento de jogo (truco, vasa, etc) */
  _botEventChat(botIndex, text) {
    if (!this.engine || !this.engine.players[botIndex]) return;
    const botName = this.engine.players[botIndex].name;
    setTimeout(() => {
      this.addChatMessage('other', botName, text, botIndex);
      this.sendSpeechBubble(botIndex, text);
    }, 500);
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
