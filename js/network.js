// d:\truco\js\network.js
// Camada de comunicação P2P WebRTC — PeerJS + metered.ca TURN servers
//
// CONFIGURAÇÃO: defina sua chave API do metered.ca abaixo.
// Cadastro gratuito em https://www.metered.ca/ → Create App → copie a API KEY.
// Sem ela o jogo cai para STUN apenas (funciona na mesma rede, falha em NATs diferentes).

const METERED_API_KEY = ''; // ← Cole sua API KEY aqui após cadastro

// Servidores STUN públicos (fallback sem API key — funciona em redes simples)
const FALLBACK_ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:openrelay.metered.ca:80' },
  // TURN abertos do openrelay.metered.ca (sem API key, capacidade limitada)
  { urls: 'turn:openrelay.metered.ca:80',       username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443',      username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
];

class TrucoNetwork {
  constructor(callbacks = {}) {
    this.peer          = null;
    this.myPeerId      = null;
    this.isHost        = false;
    this.roomId        = null;
    this.roomPassword  = null;
    this.connections   = new Map(); // peerId → DataConnection
    this.hostConnection = null;
    this.callbacks     = callbacks;
    this.clientInfo    = { name: 'Jogador', id: null };
    this._iceServers   = null; // carregados uma vez via API ou fallback
  }

  // Gera ID de sala curto (5 chars)
  static generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  // Carrega lista de ICE servers: tenta API metered.ca, cai para FALLBACK
  async _loadIceServers() {
    if (this._iceServers) return this._iceServers;

    if (METERED_API_KEY) {
      try {
        const url = `https://lucasjordaoreal.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
          const servers = await res.json();
          if (Array.isArray(servers) && servers.length > 0) {
            console.log('[TrucoNet] ICE servers carregados via metered.ca:', servers.length);
            this._iceServers = servers;
            return this._iceServers;
          }
        }
      } catch (e) {
        console.warn('[TrucoNet] Falha ao carregar ICE via metered.ca, usando fallback:', e.message);
      }
    }

    console.log('[TrucoNet] Usando ICE servers de fallback (STUN + openrelay TURN).');
    this._iceServers = FALLBACK_ICE;
    return this._iceServers;
  }

  // Inicializa o nó PeerJS com ICE servers corretos
  async initPeer(preferredId = null) {
    const iceServers = await this._loadIceServers();

    return new Promise((resolve, reject) => {
      const peerOptions = {
        debug: 1,
        config: { iceServers }
      };

      this.peer = preferredId
        ? new Peer(preferredId, peerOptions)
        : new Peer(peerOptions);

      let resolved = false;

      this.peer.on('open', (id) => {
        this.myPeerId      = id;
        this.clientInfo.id = id;
        resolved = true;
        resolve(id);
      });

      this.peer.on('error', (err) => {
        console.error('[TrucoNet] Erro PeerJS:', err.type, err.message);
        if (this.callbacks.onError) this.callbacks.onError(err);
        if (!resolved) reject(err);
      });

      this.peer.on('disconnected', () => {
        // Tenta reconectar automaticamente ao servidor de sinalização
        console.warn('[TrucoNet] Desconectado do servidor de sinalização, tentando reconectar...');
        setTimeout(() => {
          if (this.peer && !this.peer.destroyed) {
            this.peer.reconnect();
          }
        }, 2000);
      });

      // Host escuta conexões de entrada
      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      // Timeout de 15s para abrir o peer
      setTimeout(() => {
        if (!resolved) {
          reject(new Error('Tempo esgotado ao conectar ao servidor de sinalização PeerJS. Verifique sua internet.'));
        }
      }, 15000);
    });
  }

  // Cria uma nova sala como Host
  async createRoom(roomId, password = '', playerName = 'Host') {
    this.isHost        = true;
    this.roomId        = roomId.toUpperCase();
    this.roomPassword  = password;
    this.clientInfo.name = playerName;

    const hostPeerId = `truco-paulista-${this.roomId}`;
    await this.initPeer(hostPeerId);
    return { roomId: this.roomId, peerId: this.myPeerId };
  }

  // Entra em uma sala existente como Cliente
  async joinRoom(roomId, password = '', playerName = 'Visitante') {
    this.isHost        = false;
    this.roomId        = roomId.toUpperCase();
    this.roomPassword  = password;
    this.clientInfo.name = playerName;

    await this.initPeer();
    const targetHostPeerId = `truco-paulista-${this.roomId}`;

    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(targetHostPeerId, {
        reliable: true,
        metadata: { name: playerName, password }
      });

      let handshakeDone = false;

      conn.on('open', () => {
        this.hostConnection = conn;
        conn.send({ type: 'HANDSHAKE', name: playerName, password });
      });

      conn.on('data', (data) => {
        if (data.type === 'HANDSHAKE_RESPONSE') {
          if (data.success) {
            handshakeDone = true;
            resolve(data);
          } else {
            reject(new Error(data.message || 'Falha ao entrar na sala'));
            conn.close();
            return;
          }
        }
        this.handleMessage(data);
      });

      conn.on('close', () => {
        if (this.callbacks.onDisconnect) this.callbacks.onDisconnect('Conexão com o Host perdida.');
      });

      conn.on('error', (err) => {
        if (!handshakeDone) reject(err);
      });

      // Timeout de 18s para a conexão com o host abrir
      setTimeout(() => {
        if (!handshakeDone) {
          reject(new Error(
            'Não foi possível conectar ao anfitrião. ' +
            'Verifique se o código da sala está correto e se o anfitrião ainda está online. ' +
            'Se o problema persistir, pode ser bloqueio de NAT/firewall — tente com uma chave TURN configurada.'
          ));
        }
      }, 18000);
    });
  }

  // Gerenciamento de conexões recebidas pelo Host
  handleIncomingConnection(conn) {
    if (!this.isHost) return;

    conn.on('data', (data) => {
      if (data.type === 'HANDSHAKE') {
        if (this.roomPassword && data.password !== this.roomPassword) {
          conn.send({ type: 'HANDSHAKE_RESPONSE', success: false, message: 'Senha incorreta.' });
          setTimeout(() => conn.close(), 1000);
          return;
        }

        this.connections.set(conn.peer, conn);
        conn.send({ type: 'HANDSHAKE_RESPONSE', success: true, assignedPeerId: conn.peer });

        if (this.callbacks.onPlayerJoined) {
          this.callbacks.onPlayerJoined({ peerId: conn.peer, name: data.name || 'Jogador' });
        }
        return;
      }
      this.handleMessage(data, conn.peer);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.callbacks.onPlayerLeft) this.callbacks.onPlayerLeft(conn.peer);
    });

    conn.on('error', (err) => {
      console.error('[TrucoNet] Erro na conexão com cliente:', err);
    });
  }

  // Broadcast para todos os clientes conectados (Host → todos)
  broadcast(message) {
    if (!this.isHost) return;
    for (const [, conn] of this.connections.entries()) {
      if (conn.open) conn.send(message);
    }
  }

  // Envia para um peer específico (Host)
  sendToPeer(peerId, message) {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) conn.send(message);
  }

  // Envia ação do Cliente para o Host
  sendToHost(message) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(message);
    }
  }

  // Roteador de mensagens
  handleMessage(data, fromPeerId = null) {
    if (this.callbacks.onMessage) this.callbacks.onMessage(data, fromPeerId);
  }

  disconnect() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connections.clear();
    this.hostConnection = null;
  }
}

window.TrucoNetwork = TrucoNetwork;
