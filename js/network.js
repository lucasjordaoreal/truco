// d:\truco\js\network.js
// Camada de comunicação P2P WebRTC serverless utilizando PeerJS

class TrucoNetwork {
  constructor(callbacks = {}) {
    this.peer = null;
    this.myPeerId = null;
    this.isHost = false;
    this.roomId = null;
    this.roomPassword = null;
    this.connections = new Map(); // peerId -> DataConnection
    this.hostConnection = null; // Para clientes se comunicarem com o Host
    this.callbacks = callbacks;
    this.clientInfo = {
      name: 'Jogador',
      id: null
    };
  }

  // Gera um ID padronizado e limpo para a sala
  static generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Inicializa o nó PeerJS
  initPeer(preferredId = null) {
    return new Promise((resolve, reject) => {
      // Usa a nuvem gratuita e pública de STUN/turn do PeerJS
      const peerOptions = {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      };

      this.peer = preferredId ? new Peer(preferredId, peerOptions) : new Peer(peerOptions);

      this.peer.on('open', (id) => {
        this.myPeerId = id;
        this.clientInfo.id = id;
        resolve(id);
      });

      this.peer.on('error', (err) => {
        console.error('Erro na conexão P2P:', err);
        if (this.callbacks.onError) this.callbacks.onError(err);
        reject(err);
      });

      // Se for Host, escuta conexões de novos jogadores
      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });
    });
  }

  // Cria uma nova sala como Host
  async createRoom(roomId, password = '', playerName = 'Host') {
    this.isHost = true;
    this.roomId = roomId.toUpperCase();
    this.roomPassword = password;
    this.clientInfo.name = playerName;

    const hostPeerId = `truco-paulista-${this.roomId}`;
    await this.initPeer(hostPeerId);
    return {
      roomId: this.roomId,
      peerId: this.myPeerId
    };
  }

  // Entra em uma sala existente como Cliente
  async joinRoom(roomId, password = '', playerName = 'Visitante') {
    this.isHost = false;
    this.roomId = roomId.toUpperCase();
    this.roomPassword = password;
    this.clientInfo.name = playerName;

    await this.initPeer();
    const targetHostPeerId = `truco-paulista-${this.roomId}`;

    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(targetHostPeerId, {
        reliable: true,
        metadata: {
          name: playerName,
          password: password
        }
      });

      conn.on('open', () => {
        this.hostConnection = conn;
        // Envia handshake inicial de apresentação
        conn.send({
          type: 'HANDSHAKE',
          name: playerName,
          password: password
        });
      });

      conn.on('data', (data) => {
        if (data.type === 'HANDSHAKE_RESPONSE') {
          if (data.success) {
            resolve(data);
          } else {
            reject(new Error(data.message || 'Falha ao entrar na sala'));
          }
        }
        this.handleMessage(data);
      });

      conn.on('close', () => {
        if (this.callbacks.onDisconnect) this.callbacks.onDisconnect('Conexão com o Host perdida.');
      });

      conn.on('error', (err) => {
        reject(err);
      });

      setTimeout(() => {
        if (!this.hostConnection || !this.hostConnection.open) {
          reject(new Error('Tempo esgotado ao tentar conectar com o Host da sala. Verifique o código.'));
        }
      }, 10000);
    });
  }

  // Gerenciamento de conexões recebidas pelo Host
  handleIncomingConnection(conn) {
    if (!this.isHost) return;

    conn.on('open', () => {
      // Aguarda handshake de autenticação
    });

    conn.on('data', (data) => {
      if (data.type === 'HANDSHAKE') {
        // Validação de senha da sala
        if (this.roomPassword && data.password !== this.roomPassword) {
          conn.send({
            type: 'HANDSHAKE_RESPONSE',
            success: false,
            message: 'Senha incorreta para esta sala.'
          });
          setTimeout(() => conn.close(), 1000);
          return;
        }

        // Verifica capacidade e adiciona conexão
        this.connections.set(conn.peer, conn);
        conn.send({
          type: 'HANDSHAKE_RESPONSE',
          success: true,
          assignedPeerId: conn.peer
        });

        if (this.callbacks.onPlayerJoined) {
          this.callbacks.onPlayerJoined({
            peerId: conn.peer,
            name: data.name || 'Jogador Conectado'
          });
        }
        return;
      }

      this.handleMessage(data, conn.peer);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.callbacks.onPlayerLeft) {
        this.callbacks.onPlayerLeft(conn.peer);
      }
    });
  }

  // Envia mensagem para todos (Broadcast pelo Host)
  broadcast(message) {
    if (!this.isHost) return;
    for (const [peerId, conn] of this.connections.entries()) {
      if (conn.open) {
        conn.send(message);
      }
    }
  }

  // Envia mensagem para um peer específico (pelo Host)
  sendToPeer(peerId, message) {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      conn.send(message);
    }
  }

  // Envia ação do Cliente para o Host
  sendToHost(message) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(message);
    }
  }

  // Roteador central de mensagens recebidas
  handleMessage(data, fromPeerId = null) {
    if (this.callbacks.onMessage) {
      this.callbacks.onMessage(data, fromPeerId);
    }
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
