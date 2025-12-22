// =====================================================
// TANKS ARENA - Main Application v2.0
// Improved state management and game logic
// =====================================================

// Global instances
let game = null;
let network = null;
let ui = null;

// Current state
let myPlayer = null;
let currentRoom = null;
let allPlayers = [];
let isMyTurn = false;

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

    console.log('Tanks Arena initialized');
});

function setupNetworkCallbacks() {
    network.onConnect = () => {
        ui.updateServerStatus(true, 0);
        console.log('Connected to server');
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
        if (currentRoom) {
            currentRoom.players = data.players;
        }
        ui.updateWaitingRoom(currentRoom, allPlayers, network.isAdmin);
    };

    network.onPlayerLeft = (data) => {
        allPlayers = data.players;
        if (currentRoom) {
            currentRoom.players = data.players;
            currentRoom.adminId = data.newAdmin;
        }
        ui.updateWaitingRoom(currentRoom, allPlayers, network.isAdmin);
    };

    network.onGameStarted = (data) => {
        startGame(data);
    };

    network.onRoundStarted = (data) => {
        // Hide market overlay
        ui.hideOverlay('market');
        ui.readyBtn.disabled = false;
        ui.readyBtn.innerHTML = '<span>✅ Hazırım!</span>';

        // Update room state
        if (currentRoom) {
            currentRoom.round = data.round;
        }

        // Reinitialize game state
        if (game) {
            game.setTerrain(data.terrain, currentRoom.terrain);
            game.setPlayers(data.players);
            game.currentTurn = data.currentTurn;

            game.round = data.round;
        }

        // Update local state
        allPlayers = data.players;
        myPlayer = allPlayers.find(p => p.id === network.playerId);

        // Update UI
        updateGameUI(data);

        console.log('Round started:', data.round);
    };

    network.onPlayerMoved = (data) => {
        // Update player in array
        const player = allPlayers.find(p => p.id === data.playerId);
        if (player) {
            player.x = data.x;
            player.y = data.y;
            player.fuel = data.fuel;
        }

        // Update game visualization
        if (game) {
            game.updatePlayer(data.playerId, { x: data.x, y: data.y });
        }

        // Update HUD if it's our player
        if (data.playerId === network.playerId && myPlayer) {
            myPlayer.fuel = data.fuel;
            ui.updateHUD(myPlayer);
        }
    };

    network.onPlayerAimed = (data) => {
        const player = allPlayers.find(p => p.id === data.playerId);
        if (player) {
            player.angle = data.angle;
            player.power = data.power;
        }

        if (game) {
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
        if (game) {
            game.fireProjectile(data);
        }

        // Disable controls during projectile flight
        isMyTurn = false;
        ui.enableControls(false);
    };

    network.onExplosion = (data) => {
        if (game) {
            game.createExplosion(data.x, data.y, data.radius, data.weapon);
        }

        // Update player health from hits
        data.hits.forEach(hit => {
            const player = allPlayers.find(p => p.id === hit.playerId);
            if (player) {
                player.health = hit.health;
                player.isAlive = hit.isAlive;
            }

            if (game) {
                game.updatePlayer(hit.playerId, {
                    health: hit.health,
                    isAlive: hit.isAlive
                });
            }

            // Update our HUD
            if (hit.playerId === network.playerId && myPlayer) {
                myPlayer.health = hit.health;
                myPlayer.isAlive = hit.isAlive;
                ui.updateHUD(myPlayer);
            }
        });
    };

    network.onPlayerEliminated = (data) => {
        ui.showElimination(data.playerName);
        console.log('Player eliminated:', data.playerName);
    };

    network.onTurnChanged = (data) => {
        if (game) {
            game.currentTurn = data.currentTurn;

        }

        // Update current player's fuel
        const currentPlayer = allPlayers.find(p => p.id === data.playerId);
        if (currentPlayer) {
            currentPlayer.fuel = currentPlayer.maxFuel;
            if (game) {
                game.updatePlayer(data.playerId, { fuel: currentPlayer.maxFuel });
            }
        }

        // Check if it's our turn
        isMyTurn = data.playerId === network.playerId;

        // Update UI
        ui.updateTurn(isMyTurn, data.playerName || currentPlayer?.name || 'Oyuncu', currentRoom?.round || 1);
        ui.enableControls(isMyTurn);

        // Reset our fuel display if it's our turn
        if (isMyTurn && myPlayer) {
            myPlayer.fuel = myPlayer.maxFuel;
            ui.updateHUD(myPlayer);
        }

        console.log('Turn changed to:', data.playerName, 'isMyTurn:', isMyTurn);
    };

    network.onRoundEnded = (data) => {
        console.log('Round ended. Winner:', data.winner?.name);

        // Update all players with new money
        allPlayers = data.players;
        myPlayer = allPlayers.find(p => p.id === network.playerId);

        // Show market
        if (myPlayer) {
            ui.updateMarket(myPlayer);
            ui.updateHUD(myPlayer);
        }

        ui.showOverlay('market');
    };

    network.onPlayerReady = (data) => {
        console.log('Player ready:', data.playerName);
    };

    network.onPurchaseSuccess = (data) => {
        // Update our player
        Object.assign(myPlayer, data.player);
        ui.updateMarket(myPlayer);
        ui.updateHUD(myPlayer);
        console.log('Purchase successful:', data.itemId);
    };

    network.onError = (data) => {
        ui.showError(data.message);
    };
}

function startGame(data) {
    console.log('Game starting with data:', data);

    // Initialize game canvas
    const canvas = document.getElementById('game-canvas');
    game = new TanksGame(canvas);
    game.myPlayerId = network.playerId;

    // Set terrain and players
    game.setTerrain(data.terrain, currentRoom.terrain);
    game.setPlayers(data.players);
    game.currentTurn = data.currentTurn;

    game.round = data.round || 1;

    allPlayers = data.players;
    myPlayer = allPlayers.find(p => p.id === network.playerId);

    // Show game screen
    ui.showScreen('game');

    // Start rendering after a short delay to ensure DOM is ready
    setTimeout(() => {
        game.resize();
        game.start();

        // Update HUD
        updateGameUI(data);

        console.log('Game started and rendering');
    }, 100);
}

function updateGameUI(data) {
    // Find current player
    const currentPlayerIndex = data.currentTurn;
    const currentPlayer = allPlayers[currentPlayerIndex];

    // Check if it's our turn
    isMyTurn = currentPlayer?.id === network.playerId;

    ui.updateTurn(isMyTurn, currentPlayer?.name || 'Oyuncu', data.round || currentRoom?.round || 1);
    ui.enableControls(isMyTurn);

    if (myPlayer) {
        ui.updateHUD(myPlayer);

        // Set initial angle/power from player data
        ui.angleSlider.value = myPlayer.angle || 45;
        ui.angleValue.textContent = myPlayer.angle || 45;
        ui.powerSlider.value = myPlayer.power || 50;
        ui.powerValue.textContent = myPlayer.power || 50;
    }
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
        leaveGame();
    });

    // Movement buttons with touch hold support
    let moveInterval = null;

    const startMove = (direction) => {
        if (!isMyTurn) return;
        network.move(direction);
        moveInterval = setInterval(() => {
            if (isMyTurn) network.move(direction);
        }, 80);
    };

    const stopMove = () => {
        if (moveInterval) {
            clearInterval(moveInterval);
            moveInterval = null;
        }
    };

    // Mouse events
    ui.moveLeftBtn.addEventListener('mousedown', () => startMove(-1));
    ui.moveRightBtn.addEventListener('mousedown', () => startMove(1));

    // Touch events
    ui.moveLeftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startMove(-1);
    });

    ui.moveRightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startMove(1);
    });

    // Stop events
    ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(event => {
        ui.moveLeftBtn.addEventListener(event, stopMove);
        ui.moveRightBtn.addEventListener(event, stopMove);
    });

    // Fire button
    ui.fireBtn.addEventListener('click', () => {
        if (!isMyTurn) return;

        // Send aim first, then fire
        network.aim(ui.getAngle(), ui.getPower());
        setTimeout(() => {
            network.fire();
        }, 100);
    });

    // Angle/Power sliders
    let aimTimeout = null;

    const sendAim = () => {
        if (!isMyTurn) return;
        clearTimeout(aimTimeout);
        aimTimeout = setTimeout(() => {
            network.aim(ui.getAngle(), ui.getPower());
        }, 100);
    };

    ui.angleSlider.addEventListener('input', () => {
        ui.angleValue.textContent = ui.angleSlider.value;

        // Update local player angle for real-time visualization
        if (myPlayer && game) {
            myPlayer.angle = parseInt(ui.angleSlider.value);
            game.updatePlayer(network.playerId, { angle: myPlayer.angle });
        }

        sendAim();
    });

    ui.powerSlider.addEventListener('input', () => {
        ui.powerValue.textContent = ui.powerSlider.value;
        sendAim();
    });

    // Weapon selection
    document.querySelectorAll('.weapon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled || !isMyTurn) return;

            const weapon = btn.dataset.weapon;
            network.selectWeapon(weapon);

            // Update UI
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
        ui.readyBtn.innerHTML = '<span>⏳ Bekleniyor...</span>';
    });

    // Back to lobby button
    ui.backToLobbyBtn.addEventListener('click', () => {
        leaveGame();
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (!game || !myPlayer || !isMyTurn) return;

        switch (e.key) {
            case 'ArrowLeft':
            case 'a':
            case 'A':
                e.preventDefault();
                network.move(-1);
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                e.preventDefault();
                network.move(1);
                break;
            case 'ArrowUp':
            case 'w':
            case 'W':
                e.preventDefault();
                ui.angleSlider.value = Math.min(180, parseInt(ui.angleSlider.value) + 2);
                ui.angleValue.textContent = ui.angleSlider.value;
                if (myPlayer) {
                    myPlayer.angle = parseInt(ui.angleSlider.value);
                    game.updatePlayer(network.playerId, { angle: myPlayer.angle });
                }
                sendAim();
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                e.preventDefault();
                ui.angleSlider.value = Math.max(0, parseInt(ui.angleSlider.value) - 2);
                ui.angleValue.textContent = ui.angleSlider.value;
                if (myPlayer) {
                    myPlayer.angle = parseInt(ui.angleSlider.value);
                    game.updatePlayer(network.playerId, { angle: myPlayer.angle });
                }
                sendAim();
                break;
            case ' ':
                e.preventDefault();
                network.aim(ui.getAngle(), ui.getPower());
                setTimeout(() => network.fire(), 100);
                break;
            case '1':
                network.selectWeapon('normal');
                break;
            case '2':
                network.selectWeapon('triple');
                break;
            case '3':
                network.selectWeapon('atom');
                break;
            case '4':
                network.selectWeapon('napalm');
                break;
        }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        if (game) {
            game.resize();
        }
    });

    // Prevent context menu on long press (mobile)
    document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('#controls-panel') || e.target.closest('.weapon-panel')) {
            e.preventDefault();
        }
    });
}

function leaveGame() {
    network.leaveRoom();
    ui.hideOverlay('market');
    ui.hideOverlay('victory');
    ui.showScreen('lobby');

    if (game) {
        game.stop();
        game = null;
    }

    currentRoom = null;
    myPlayer = null;
    allPlayers = [];
    isMyTurn = false;
}

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden && game) {
        // Page is hidden, could pause render loop
    } else if (!document.hidden && game) {
        // Page is visible again
        game.resize();
    }
});
