// =====================================================
// TANKS ARENA - UI Manager
// Handles all UI interactions and updates
// =====================================================

class UIManager {
    constructor() {
        // Screens
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.waitingScreen = document.getElementById('waiting-room-screen');
        this.gameScreen = document.getElementById('game-screen');

        // Overlays
        this.marketScreen = document.getElementById('market-screen');
        this.victoryScreen = document.getElementById('victory-screen');

        // Toast/Notifications
        this.errorToast = document.getElementById('error-toast');
        this.eliminationNotification = document.getElementById('elimination-notification');

        // Lobby elements
        this.playerNameInput = document.getElementById('player-name');
        this.roomNameInput = document.getElementById('room-name');
        this.roomList = document.getElementById('room-list');
        this.createRoomBtn = document.getElementById('create-room-btn');

        // Terrain and count selection
        this.selectedTerrain = 'desert';
        this.selectedMaxPlayers = 2;

        // Waiting room elements
        this.waitingRoomTitle = document.getElementById('waiting-room-title');
        this.waitingTerrain = document.getElementById('waiting-terrain');
        this.waitingRound = document.getElementById('waiting-round');
        this.playersList = document.getElementById('players-list');
        this.startGameBtn = document.getElementById('start-game-btn');
        this.leaveRoomBtn = document.getElementById('leave-room-btn');
        this.waitingStatus = document.getElementById('waiting-status');

        // Game HUD elements
        this.healthBar = document.getElementById('health-bar');
        this.healthText = document.getElementById('health-text');
        this.fuelBar = document.getElementById('fuel-bar');
        this.fuelText = document.getElementById('fuel-text');
        this.moneyText = document.getElementById('money-text');
        this.roundText = document.getElementById('round-text');
        this.turnText = document.getElementById('turn-text');


        // Controls
        this.angleSlider = document.getElementById('angle-slider');
        this.angleValue = document.getElementById('angle-value');
        this.powerSlider = document.getElementById('power-slider');
        this.powerValue = document.getElementById('power-value');
        this.moveLeftBtn = document.getElementById('move-left-btn');
        this.moveRightBtn = document.getElementById('move-right-btn');
        this.fireBtn = document.getElementById('fire-btn');

        // Status bar
        this.statusDot = document.querySelector('.status-dot');
        this.serverStatusText = document.getElementById('server-status-text');
        this.playerCount = document.getElementById('player-count');

        // Market
        this.marketMoney = document.getElementById('market-money');
        this.readyBtn = document.getElementById('ready-btn');

        // Victory
        this.victoryText = document.getElementById('victory-text');
        this.victoryMessage = document.getElementById('victory-message');
        this.backToLobbyBtn = document.getElementById('back-to-lobby-btn');

        // Current state
        this.currentPlayer = null;
        this.currentRoom = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Terrain selection
        document.querySelectorAll('.terrain-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.terrain-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedTerrain = btn.dataset.terrain;
            });
        });

        // Player count selection
        document.querySelectorAll('.count-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedMaxPlayers = parseInt(btn.dataset.count);
            });
        });

        // Sliders
        this.angleSlider.addEventListener('input', () => {
            this.angleValue.textContent = this.angleSlider.value;
        });

        this.powerSlider.addEventListener('input', () => {
            this.powerValue.textContent = this.powerSlider.value;
        });

        // Weapon selection
        document.querySelectorAll('.weapon-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                document.querySelectorAll('.weapon-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Market items
        document.querySelectorAll('.market-item').forEach(item => {
            item.addEventListener('click', () => {
                // Handled in main.js
            });
        });
    }

    // Screen management
    showScreen(screenName) {
        [this.lobbyScreen, this.waitingScreen, this.gameScreen].forEach(screen => {
            screen.classList.remove('active');
        });

        switch (screenName) {
            case 'lobby':
                this.lobbyScreen.classList.add('active');
                break;
            case 'waiting':
                this.waitingScreen.classList.add('active');
                break;
            case 'game':
                this.gameScreen.classList.add('active');
                break;
        }
    }

    showOverlay(overlayName) {
        switch (overlayName) {
            case 'market':
                this.marketScreen.classList.add('active');
                break;
            case 'victory':
                this.victoryScreen.classList.add('active');
                break;
        }
    }

    hideOverlay(overlayName) {
        switch (overlayName) {
            case 'market':
                this.marketScreen.classList.remove('active');
                break;
            case 'victory':
                this.victoryScreen.classList.remove('active');
                break;
        }
    }

    // Server status
    updateServerStatus(online, playerCount) {
        if (online) {
            this.statusDot.classList.add('online');
            this.serverStatusText.textContent = 'Online';
        } else {
            this.statusDot.classList.remove('online');
            this.serverStatusText.textContent = 'Offline';
        }
        this.playerCount.textContent = `(${playerCount} oyuncu)`;
    }

    // Room list
    updateRoomList(rooms) {
        if (rooms.length === 0) {
            this.roomList.innerHTML = '<div class="no-rooms">Henüz oda yok...</div>';
            return;
        }

        const terrainEmojis = {
            desert: '🏜️',
            jungle: '🌴',
            mountain: '⛰️',
            snow: '❄️'
        };

        this.roomList.innerHTML = rooms.map(room => `
            <div class="room-item" data-room-id="${room.id}">
                <div class="room-info">
                    <span class="room-name">${this.escapeHtml(room.name)}</span>
                    <span class="room-meta">${terrainEmojis[room.terrain]} ${room.terrain} • ${room.gameState === 'waiting' ? 'Bekliyor' : 'Oyunda'}</span>
                </div>
                <span class="room-players">${room.playerCount}/${room.maxPlayers}</span>
            </div>
        `).join('');
    }

    // Waiting room
    updateWaitingRoom(room, players, isAdmin) {
        const terrainEmojis = {
            desert: '🏜️ Çöl',
            jungle: '🌴 Orman',
            mountain: '⛰️ Dağ',
            snow: '❄️ Kar'
        };

        this.waitingRoomTitle.textContent = `🎮 ${room.name}`;
        this.waitingTerrain.textContent = terrainEmojis[room.terrain];
        this.waitingRound.textContent = `Round ${room.round || 1}`;

        this.playersList.innerHTML = players.map(player => `
            <div class="player-item">
                <div class="player-color" style="background-color: ${player.color}"></div>
                <span class="player-name">${this.escapeHtml(player.name)}</span>
                ${player.id === room.adminId ? '<span class="player-badge">Admin</span>' : ''}
            </div>
        `).join('');

        this.startGameBtn.style.display = isAdmin ? 'inline-flex' : 'none';

        if (players.length < 2) {
            this.waitingStatus.textContent = 'En az 2 oyuncu gerekli...';
            this.startGameBtn.disabled = true;
        } else {
            this.waitingStatus.textContent = isAdmin ? 'Oyunu başlatabilirsin!' : 'Admin oyunu başlatacak...';
            this.startGameBtn.disabled = false;
        }
    }

    // Game HUD
    updateHUD(player) {
        if (!player) return;

        const healthPercent = (player.health / player.maxHealth) * 100;
        const fuelPercent = (player.fuel / player.maxFuel) * 100;

        this.healthBar.style.width = `${healthPercent}%`;
        this.healthText.textContent = player.health;

        this.fuelBar.style.width = `${fuelPercent}%`;
        this.fuelText.textContent = player.fuel;

        this.moneyText.textContent = player.money;

        // Show armor if player has any
        const armorDisplay = document.getElementById('armor-display');
        const armorText = document.getElementById('armor-text');
        if (player.armor > 0) {
            armorDisplay.style.display = 'flex';
            armorText.textContent = player.armor;
        } else {
            armorDisplay.style.display = 'none';
        }

        // Update weapon counts
        document.getElementById('triple-count').textContent = player.weapons?.triple?.count || 0;
        document.getElementById('atom-count').textContent = player.weapons?.atom?.count || 0;
        document.getElementById('splash-count').textContent = player.weapons?.splash?.count || 0;
        document.getElementById('sniper-count').textContent = player.weapons?.sniper?.count || 0;
        document.getElementById('cluster-count').textContent = player.weapons?.cluster?.count || 0;

        // Enable/disable weapon buttons
        document.querySelectorAll('.weapon-btn').forEach(btn => {
            const weapon = btn.dataset.weapon;
            if (weapon === 'normal') {
                btn.disabled = false;
            } else {
                const count = player.weapons?.[weapon]?.count || 0;
                btn.disabled = count <= 0;
            }
        });
    }

    updateTurn(isMyTurn, currentPlayerName, round) {
        if (isMyTurn) {
            this.turnText.textContent = '🎯 Senin Sıran!';
            this.turnText.style.color = '#f59e0b';
            this.enableControls(true);
        } else {
            this.turnText.textContent = `⏳ ${currentPlayerName} oynuyor...`;
            this.turnText.style.color = '#a0a0c0';
            this.enableControls(false);
        }

        // Round
        this.roundText.textContent = `Round ${round}`;
    }

    enableControls(enabled) {
        this.angleSlider.disabled = !enabled;
        this.powerSlider.disabled = !enabled;
        this.moveLeftBtn.disabled = !enabled;
        this.moveRightBtn.disabled = !enabled;
        this.fireBtn.disabled = !enabled;

        document.querySelectorAll('.weapon-btn').forEach(btn => {
            if (btn.dataset.weapon === 'normal') {
                btn.disabled = !enabled;
            }
        });
    }

    // Market
    updateMarket(player) {
        this.marketMoney.textContent = player.money;
    }

    // Victory
    showVictory(winnerName, isWinner) {
        this.victoryText.textContent = winnerName;
        this.victoryMessage.textContent = isWinner ? 'Tebrikler, kazandın! 🎉' : 'Oyun bitti!';
        this.showOverlay('victory');
    }

    // Elimination notification
    showElimination(playerName) {
        const notification = this.eliminationNotification;
        document.getElementById('elimination-text').textContent = `${playerName} Patladı!`;

        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 2000);
    }

    // Error toast
    showError(message) {
        document.getElementById('error-text').textContent = message;
        this.errorToast.classList.add('show');

        setTimeout(() => {
            this.errorToast.classList.remove('show');
        }, 3000);
    }

    // Utility
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getPlayerName() {
        return this.playerNameInput.value.trim() || 'Player';
    }

    getRoomName() {
        return this.roomNameInput.value.trim() || 'Yeni Oda';
    }

    getAngle() {
        return parseInt(this.angleSlider.value);
    }

    getPower() {
        return parseInt(this.powerSlider.value);
    }
}

// Export
window.UIManager = UIManager;
