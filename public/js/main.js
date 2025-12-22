// =====================================================
// TANKS ARENA - Main Application
// Initializes and connects all components
// =====================================================

// Global instances
let game = null;
let network = null;
let ui = null;

// Current state
let myPlayer = null;
let currentRoom = null;
let allPlayers = [];

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize managers
    ui = new UIManager();
    network = new NetworkManager();

    // Expose network for game.js
    window.gameNetwork = network;

    // Connect to server
    network.connect();

    // Setup network callbacks
    setupNetworkCallbacks();

    // Setup UI event listeners
    setupUIEvents();
});

function setupNetworkCallbacks() {
    network.onConnect = () => {
        ui.updateServerStatus(true, 0);
    };

    network.onDisconnect = () => {
        ui.updateServerStatus(false, 0);
        ui.showScreen('lobby');
        ui.showError('Sunucu bağlantısı kesildi!');
    };

    network.onServerStatus = (data) => {
        ui.updateServerStatus(data.online, data.playerCount);
    };

    network.onRoomList = (rooms) => {
        ui.updateRoomList(rooms);
    };

    network.onRoomCreated = (data) => {
        currentRoom = data.room;
        myPlayer = data.player;
        allPlayers = data.room.players;
        ui.showScreen('waiting');
        ui.updateWaitingRoom(currentRoom, allPlayers, network.isAdmin);
    };

    network.onRoomJoined = (data) => {
        currentRoom = data.room;
        myPlayer = data.player;
        allPlayers = data.room.players;
        ui.showScreen('waiting');
        ui.updateWaitingRoom(currentRoom, allPlayers, network.isAdmin);
    };

    network.onPlayerJoined = (data) => {
        allPlayers = data.players;
        ui.updateWaitingRoom(currentRoom, allPlayers, network.isAdmin);
    };

    network.onPlayerLeft = (data) => {
        allPlayers = data.players;
        if (currentRoom) {
            currentRoom.adminId = data.newAdmin;
        }
        ui.updateWaitingRoom(currentRoom, allPlayers, network.isAdmin);
    };

    network.onGameStarted = (data) => {
        // Initialize game canvas
        const canvas = document.getElementById('game-canvas');
        game = new TanksGame(canvas);
        game.myPlayerId = network.playerId;

        // Set terrain and players
        game.setTerrain(data.terrain, currentRoom.terrain);
        game.setPlayers(data.players);
        game.currentTurn = data.currentTurn;
        game.wind = data.wind;

        allPlayers = data.players;
        myPlayer = allPlayers.find(p => p.id === network.playerId);

        // Show game screen
        ui.showScreen('game');

        // Start rendering
        setTimeout(() => {
            game.resize();
            game.start();

            // Update HUD
            updateGameUI(data);
        }, 100);
    };

    network.onPlayerMoved = (data) => {
        const player = allPlayers.find(p => p.id === data.playerId);
        if (player) {
            player.x = data.x;
            player.y = data.y;
            player.fuel = data.fuel;
            game.updatePlayer(data.playerId, { x: data.x, y: data.y });
        }

        if (data.playerId === network.playerId) {
            myPlayer.fuel = data.fuel;
            ui.updateHUD(myPlayer);
        }
    };

    network.onPlayerAimed = (data) => {
        const player = allPlayers.find(p => p.id === data.playerId);
        if (player) {
            player.angle = data.angle;
            player.power = data.power;
            game.updatePlayer(data.playerId, { angle: data.angle, power: data.power });
        }
    };

    network.onWeaponSelected = (data) => {
        const player = allPlayers.find(p => p.id === data.playerId);
        if (player) {
            player.currentWeapon = data.weapon;
        }
    };

    network.onProjectileFired = (data) => {
        game.fireProjectile(data);
    };

    network.onExplosion = (data) => {
        game.createExplosion(data.x, data.y, data.radius, data.weapon);

        // Update player health
        data.hits.forEach(hit => {
            const player = allPlayers.find(p => p.id === hit.playerId);
            if (player) {
                player.health = hit.health;
                player.isAlive = hit.isAlive;
                game.updatePlayer(hit.playerId, { health: hit.health, isAlive: hit.isAlive });
            }

            if (hit.playerId === network.playerId) {
                myPlayer.health = hit.health;
                myPlayer.isAlive = hit.isAlive;
                ui.updateHUD(myPlayer);
            }
        });
    };

    network.onPlayerEliminated = (data) => {
        ui.showElimination(data.playerName);
    };

    network.onTurnChanged = (data) => {
        game.currentTurn = data.currentTurn;
        game.wind = data.wind;

        // Update current player fuel
        const currentPlayer = allPlayers.find(p => p.id === data.playerId);
        if (currentPlayer) {
            currentPlayer.fuel = currentPlayer.maxFuel;
            game.updatePlayer(data.playerId, { fuel: currentPlayer.maxFuel });
        }

        const isMyTurn = data.playerId === network.playerId;
        const currentPlayerObj = allPlayers.find(p => p.id === data.playerId);
        ui.updateTurn(isMyTurn, currentPlayerObj?.name || 'Oyuncu', data.wind, currentRoom.round || 1);

        if (isMyTurn) {
            myPlayer.fuel = myPlayer.maxFuel;
            ui.updateHUD(myPlayer);
        }
    };

    network.onRoundEnded = (data) => {
        // Update all players
        allPlayers = data.players;
        myPlayer = allPlayers.find(p => p.id === network.playerId);

        // Show market
        ui.updateMarket(myPlayer);
        ui.showOverlay('market');
    };

    network.onRoundStarted = (data) => {
        // Hide market
        ui.hideOverlay('market');

        // Update game state
        game.setTerrain(data.terrain, currentRoom.terrain);
        game.setPlayers(data.players);
        game.currentTurn = data.currentTurn;
        game.wind = data.wind;
        currentRoom.round = data.round;

        allPlayers = data.players;
        myPlayer = allPlayers.find(p => p.id === network.playerId);

        updateGameUI(data);
    };

    network.onPurchaseSuccess = (data) => {
        myPlayer = data.player;
        ui.updateMarket(myPlayer);
        ui.updateHUD(myPlayer);
    };

    network.onError = (data) => {
        ui.showError(data.message);
    };
}

function setupUIEvents() {
    // Create room button
    ui.createRoomBtn.addEventListener('click', () => {
        const playerName = ui.getPlayerName();
        const roomName = ui.getRoomName();

        if (!playerName) {
            ui.showError('Lütfen adını gir!');
            return;
        }

        network.createRoom(roomName, playerName, ui.selectedTerrain, ui.selectedMaxPlayers);
    });

    // Room list click (join room)
    ui.roomList.addEventListener('click', (e) => {
        const roomItem = e.target.closest('.room-item');
        if (!roomItem) return;

        const roomId = roomItem.dataset.roomId;
        const playerName = ui.getPlayerName();

        if (!playerName) {
            ui.showError('Lütfen adını gir!');
            return;
        }

        network.joinRoom(roomId, playerName);
    });

    // Start game button
    ui.startGameBtn.addEventListener('click', () => {
        network.startGame();
    });

    // Leave room button
    ui.leaveRoomBtn.addEventListener('click', () => {
        network.leaveRoom();
        ui.showScreen('lobby');
        currentRoom = null;
        myPlayer = null;
        allPlayers = [];
    });

    // Move buttons
    ui.moveLeftBtn.addEventListener('click', () => {
        network.move(-1);
    });

    ui.moveRightBtn.addEventListener('click', () => {
        network.move(1);
    });

    // Touch hold for movement
    let moveInterval = null;

    const startMove = (direction) => {
        network.move(direction);
        moveInterval = setInterval(() => network.move(direction), 100);
    };

    const stopMove = () => {
        if (moveInterval) {
            clearInterval(moveInterval);
            moveInterval = null;
        }
    };

    ui.moveLeftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startMove(-1);
    });

    ui.moveRightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startMove(1);
    });

    ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(event => {
        ui.moveLeftBtn.addEventListener(event, stopMove);
        ui.moveRightBtn.addEventListener(event, stopMove);
    });

    // Fire button
    ui.fireBtn.addEventListener('click', () => {
        // Send aim first
        network.aim(ui.getAngle(), ui.getPower());
        // Then fire
        setTimeout(() => network.fire(), 50);
    });

    // Angle/Power sliders
    ui.angleSlider.addEventListener('change', () => {
        network.aim(ui.getAngle(), ui.getPower());
    });

    ui.powerSlider.addEventListener('change', () => {
        network.aim(ui.getAngle(), ui.getPower());
    });

    // Weapon selection
    document.querySelectorAll('.weapon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const weapon = btn.dataset.weapon;
            network.selectWeapon(weapon);

            document.querySelectorAll('.weapon-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Market items
    document.querySelectorAll('.market-item').forEach(item => {
        item.addEventListener('click', () => {
            const type = item.dataset.type;
            const id = item.dataset.id;
            network.purchase(type, id);
        });
    });

    // Ready button
    ui.readyBtn.addEventListener('click', () => {
        network.ready();
        ui.readyBtn.disabled = true;
        ui.readyBtn.textContent = '⏳ Bekleniyor...';
    });

    // Back to lobby button
    ui.backToLobbyBtn.addEventListener('click', () => {
        network.leaveRoom();
        ui.hideOverlay('victory');
        ui.showScreen('lobby');

        if (game) {
            game.stop();
            game = null;
        }

        currentRoom = null;
        myPlayer = null;
        allPlayers = [];
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (!game || !myPlayer) return;

        const currentPlayer = allPlayers[game.currentTurn];
        if (currentPlayer?.id !== network.playerId) return;

        switch (e.key) {
            case 'ArrowLeft':
            case 'a':
            case 'A':
                network.move(-1);
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                network.move(1);
                break;
            case 'ArrowUp':
            case 'w':
            case 'W':
                ui.angleSlider.value = Math.min(180, parseInt(ui.angleSlider.value) + 2);
                ui.angleValue.textContent = ui.angleSlider.value;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                ui.angleSlider.value = Math.max(0, parseInt(ui.angleSlider.value) - 2);
                ui.angleValue.textContent = ui.angleSlider.value;
                break;
            case ' ':
                e.preventDefault();
                network.aim(ui.getAngle(), ui.getPower());
                setTimeout(() => network.fire(), 50);
                break;
        }
    });
}

function updateGameUI(data) {
    const isMyTurn = allPlayers[data.currentTurn]?.id === network.playerId;
    const currentPlayer = allPlayers[data.currentTurn];

    ui.updateTurn(isMyTurn, currentPlayer?.name || 'Oyuncu', data.wind, data.round || 1);
    ui.updateHUD(myPlayer);

    // Set initial angle/power from player
    if (myPlayer) {
        ui.angleSlider.value = myPlayer.angle || 45;
        ui.angleValue.textContent = myPlayer.angle || 45;
        ui.powerSlider.value = myPlayer.power || 50;
        ui.powerValue.textContent = myPlayer.power || 50;
    }
}
