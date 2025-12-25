// =====================================================
// TANKS ARENA - Network Manager
// Socket.IO client for multiplayer communication
// =====================================================

class NetworkManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.roomId = null;
        this.playerId = null;
        this.isAdmin = false;

        // Callbacks
        this.onConnect = null;
        this.onDisconnect = null;
        this.onRoomList = null;
        this.onRoomCreated = null;
        this.onRoomJoined = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onChatMessage = null; // New
        this.onSessionExpired = null; // New
        this.onGameStarted = null;
        this.onPlayerMoved = null;
        this.onPlayerAimed = null;
        this.onWeaponSelected = null;
        this.onProjectileFired = null;
        this.onExplosion = null;
        this.onPlayerEliminated = null;
        this.onTurnChanged = null;
        this.onRoundEnded = null;
        this.onRoundStarted = null;
        this.onPurchaseSuccess = null;
        this.onError = null;
        this.onServerStatus = null;
    }

    connect() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.connected = true;
            this.playerId = this.socket.id;

            // Reconnect attempt
            const token = localStorage.getItem('tanks_session_token');
            if (token) {
                this.socket.emit('reconnect', token);
            }

            if (this.onConnect) this.onConnect();
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.connected = false;
            if (this.onDisconnect) this.onDisconnect();
        });

        this.socket.on('serverStatus', (data) => {
            if (this.onServerStatus) this.onServerStatus(data);
        });

        this.socket.on('roomList', (rooms) => {
            if (this.onRoomList) this.onRoomList(rooms);
        });

        this.socket.on('roomCreated', (data) => {
            this.roomId = data.room.id;
            this.isAdmin = true;
            if (data.token) localStorage.setItem('tanks_session_token', data.token);
            if (this.onRoomCreated) this.onRoomCreated(data);
        });

        this.socket.on('roomJoined', (data) => {
            this.roomId = data.room.id;
            this.isAdmin = false;
            if (data.token) localStorage.setItem('tanks_session_token', data.token);
            if (this.onRoomJoined) this.onRoomJoined(data);
        });

        this.socket.on('playerJoined', (data) => {
            if (this.onPlayerJoined) this.onPlayerJoined(data);
        });

        this.socket.on('playerLeft', (data) => {
            if (data.newAdmin === this.playerId) {
                this.isAdmin = true;
            }
            if (this.onPlayerLeft) this.onPlayerLeft(data);
        });

        this.socket.on('gameStarted', (data) => {
            if (this.onGameStarted) this.onGameStarted(data);
        });

        this.socket.on('playerMoved', (data) => {
            if (this.onPlayerMoved) this.onPlayerMoved(data);
        });

        this.socket.on('playerAimed', (data) => {
            if (this.onPlayerAimed) this.onPlayerAimed(data);
        });

        this.socket.on('weaponSelected', (data) => {
            if (this.onWeaponSelected) this.onWeaponSelected(data);
        });

        this.socket.on('projectileFired', (data) => {
            if (this.onProjectileFired) this.onProjectileFired(data);
        });

        this.socket.on('explosion', (data) => {
            if (this.onExplosion) this.onExplosion(data);
        });

        this.socket.on('playerEliminated', (data) => {
            if (this.onPlayerEliminated) this.onPlayerEliminated(data);
        });

        this.socket.on('turnChanged', (data) => {
            if (this.onTurnChanged) this.onTurnChanged(data);
        });

        this.socket.on('roundEnded', (data) => {
            if (this.onRoundEnded) this.onRoundEnded(data);
        });

        this.socket.on('roundStarted', (data) => {
            if (this.onRoundStarted) this.onRoundStarted(data);
        });

        this.socket.on('purchaseSuccess', (data) => {
            if (this.onPurchaseSuccess) this.onPurchaseSuccess(data);
        });

        this.socket.on('weaponUpdate', (data) => {
            if (this.onWeaponUpdate) this.onWeaponUpdate(data);
        });

        this.socket.on('moneyUpdate', (data) => {
            if (this.onMoneyUpdate) this.onMoneyUpdate(data);
        });

        this.socket.on('error', (data) => {
            if (this.onError) this.onError(data);
        });
    }

    createRoom(roomName, playerName, terrain, maxPlayers, color) {
        if (!this.connected) return;
        this.socket.emit('createRoom', { roomName, playerName, terrain, maxPlayers, color });
    }

    joinRoom(roomId, playerName, color) {
        if (!this.connected) return;
        this.socket.emit('joinRoom', { roomId, playerName, color });
    }

    leaveRoom() {
        if (!this.connected) return;
        this.socket.emit('leaveRoom');
        this.roomId = null;
        this.isAdmin = false;
    }

    startGame() {
        if (!this.connected || !this.isAdmin) return;
        this.socket.emit('startGame');
    }

    move(direction) {
        if (!this.connected) return;
        this.socket.emit('move', { direction });
    }

    aim(angle, power) {
        if (!this.connected) return;
        this.socket.emit('aim', { angle, power });
    }

    selectWeapon(weaponId) {
        if (!this.connected) return;
        this.socket.emit('selectWeapon', weaponId);
    }

    fire() {
        if (!this.connected) return;
        this.socket.emit('fire');
    }

    sendProjectileHit(hitX, hitY, weapon) {
        if (!this.connected) return;
        this.socket.emit('projectileHit', { hitX, hitY, weapon });
    }

    purchase(type, itemId) {
        if (!this.connected) return;
        this.socket.emit('purchase', { type, itemId });
    }

    ready() {
        if (!this.connected) return;
        this.socket.emit('ready');
    }
}

// Export
window.NetworkManager = NetworkManager;
