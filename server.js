const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const rooms = new Map();
const players = new Map();

// Game constants
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 600;

// Weapon definitions
const WEAPONS = {
    normal: { name: 'Normal Shot', price: 0, damage: 25, radius: 35, count: -1 },
    triple: { name: 'Triple Shot', price: 100, damage: 18, radius: 28, count: 3 },
    atom: { name: 'Atom Bomb', price: 300, damage: 75, radius: 120, count: 1 },
    splash: { name: 'Splash Bomb', price: 150, damage: 30, radius: 80, count: 2 },
    sniper: { name: 'Sniper Shot', price: 120, damage: 50, radius: 20, count: 2 },
    cluster: { name: 'Cluster Bomb', price: 250, damage: 20, radius: 40, count: 2, splits: 5 }
};

// Upgrade definitions (with caps)
const UPGRADES = {
    armor: { name: 'Armor +10', price: 50, stat: 'armor', value: 10, maxCap: 50 },
    fuel: { name: 'Fuel +25', price: 30, stat: 'maxFuel', value: 25, maxCap: 150 },
    health: { name: 'Health +25', price: 75, stat: 'maxHealth', value: 25, maxCap: 150 },
    shield: { name: 'Shield', price: 100, stat: 'shield', value: 1, maxCap: 1 }
};

// Generate terrain points
function generateTerrain(type) {
    const points = [];
    const segments = 120;
    const segmentWidth = GAME_WIDTH / segments;

    // Base height (from top, so lower value = higher ground)
    const baseHeight = 400; // Ground level from top

    let amplitude, frequency;
    switch (type) {
        case 'mountain':
            amplitude = 120;
            frequency = 0.008;
            break;
        case 'desert':
            amplitude = 50;
            frequency = 0.015;
            break;
        case 'snow':
            amplitude = 80;
            frequency = 0.01;
            break;
        case 'jungle':
        default:
            amplitude = 60;
            frequency = 0.012;
            break;
    }

    for (let i = 0; i <= segments; i++) {
        const x = i * segmentWidth;

        // Generate smooth terrain using sine waves
        const noise1 = Math.sin(x * frequency) * amplitude;
        const noise2 = Math.sin(x * frequency * 2.5 + 1.5) * (amplitude * 0.4);
        const noise3 = Math.sin(x * frequency * 0.5 + 0.7) * (amplitude * 0.3);

        // Y coordinate from top of screen
        const y = baseHeight + noise1 + noise2 + noise3;

        points.push({ x, y });
    }

    return points;
}

// Get terrain height at X position from points array
function getTerrainHeightAt(points, x) {
    if (!points || points.length < 2) return 400;

    // Find the two points that x falls between
    for (let i = 0; i < points.length - 1; i++) {
        if (x >= points[i].x && x <= points[i + 1].x) {
            const t = (x - points[i].x) / (points[i + 1].x - points[i].x);
            return points[i].y + t * (points[i + 1].y - points[i].y);
        }
    }

    // Edge cases
    if (x < points[0].x) return points[0].y;
    return points[points.length - 1].y;
}

// Player colors
const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

// Create new player
function createPlayer(id, name, roomId, colorIndex, customColor = null) {
    return {
        id,
        name,
        roomId,
        health: 100,
        maxHealth: 100,
        fuel: 60,
        maxFuel: 60,
        money: 100, // Start with some money
        armor: 0,
        shield: 0,
        x: 0,
        y: 0,
        angle: 45,
        power: 50,
        weapons: {
            normal: { count: -1 },
            triple: { count: 0 },
            atom: { count: 0 },
            splash: { count: 0 },
            sniper: { count: 0 },
            cluster: { count: 0 }
        },
        currentWeapon: 'normal',
        isAlive: true,
        ready: false,
        color: customColor || PLAYER_COLORS[colorIndex % PLAYER_COLORS.length]
    };
}

// Create new room
function createRoom(id, name, adminId, terrain, maxPlayers) {
    return {
        id,
        name,
        adminId,
        terrain,
        maxPlayers: Math.min(Math.max(maxPlayers, 2), 4),
        players: [],
        gameState: 'waiting', // waiting, playing, roundEnd, finished
        currentTurn: 0,
        round: 1,
        terrainPoints: [],

        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        turnTimeout: null
    };
}

// Position players on terrain with random spacing
function positionPlayers(room) {
    const playerCount = room.players.length;
    const margin = 120; // Keep players away from edges
    const minSpacing = 200; // Minimum distance between players
    const availableWidth = GAME_WIDTH - margin * 2;

    // Generate random positions with minimum spacing
    const positions = [];
    let attempts = 0;
    const maxAttempts = 100;

    while (positions.length < playerCount && attempts < maxAttempts) {
        // Random position within available area
        const x = margin + Math.random() * availableWidth;

        // Check if this position is far enough from all existing positions
        let validPosition = true;
        for (const existingX of positions) {
            if (Math.abs(x - existingX) < minSpacing) {
                validPosition = false;
                break;
            }
        }

        if (validPosition) {
            positions.push(x);
        }
        attempts++;
    }

    // If we couldn't find enough random positions, fall back to even spacing
    if (positions.length < playerCount) {
        positions.length = 0;
        const spacing = availableWidth / (playerCount + 1);
        for (let i = 0; i < playerCount; i++) {
            positions.push(margin + spacing * (i + 1));
        }
    }

    // Shuffle positions so players don't always get same side
    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Assign positions to players
    room.players.forEach((player, index) => {
        player.x = positions[index];
        player.y = getTerrainHeightAt(room.terrainPoints, player.x);
        player.isAlive = true;
        player.fuel = player.maxFuel;
        player.health = player.maxHealth;
        player.ready = false;
    });
}

// Available terrains for cycling
const TERRAIN_ORDER = ['desert', 'jungle', 'mountain', 'snow'];

// Start a new round
function startRound(room) {
    room.gameState = 'playing';

    // Cycle to next terrain each round
    const terrainIndex = (room.round - 1) % TERRAIN_ORDER.length;
    room.terrain = TERRAIN_ORDER[terrainIndex];
    room.terrainPoints = generateTerrain(room.terrain);

    room.currentTurn = 0;

    positionPlayers(room);

    // Find first alive player
    while (!room.players[room.currentTurn]?.isAlive && room.currentTurn < room.players.length) {
        room.currentTurn++;
    }

    io.to(room.id).emit('roundStarted', {
        terrain: room.terrainPoints,
        terrainType: room.terrain,
        players: room.players,
        currentTurn: room.currentTurn,
        round: room.round
    });

    // Start turn timer
    startTurnTimer(room);
}

// Turn timer
function startTurnTimer(room) {
    clearTurnTimer(room);

    room.turnTimeout = setTimeout(() => {
        // Auto-end turn if player doesn't act
        if (room.gameState === 'playing') {
            nextTurn(room);
        }
    }, 45000); // 45 second turn limit
}

function clearTurnTimer(room) {
    if (room.turnTimeout) {
        clearTimeout(room.turnTimeout);
        room.turnTimeout = null;
    }
}

// Move to next turn
function nextTurn(room) {
    clearTurnTimer(room);

    const alivePlayers = room.players.filter(p => p.isAlive);

    // Check win condition
    if (alivePlayers.length <= 1) {
        endRound(room, alivePlayers[0] || null);
        return;
    }

    // Find next alive player
    let nextIndex = room.currentTurn;
    let attempts = 0;

    do {
        nextIndex = (nextIndex + 1) % room.players.length;
        attempts++;
    } while (!room.players[nextIndex].isAlive && attempts <= room.players.length);

    room.currentTurn = nextIndex;

    // Reset fuel for next player
    room.players[nextIndex].fuel = room.players[nextIndex].maxFuel;



    io.to(room.id).emit('turnChanged', {
        currentTurn: room.currentTurn,
        playerId: room.players[room.currentTurn].id,
        playerName: room.players[room.currentTurn].name,

    });

    startTurnTimer(room);
}

// End round
function endRound(room, winner) {
    clearTurnTimer(room);
    room.gameState = 'roundEnd';

    // Award money
    if (winner) {
        winner.money += 250;
    }

    // Participation money
    room.players.forEach(p => {
        p.money += 75;
        p.ready = false;
    });

    io.to(room.id).emit('roundEnded', {
        winner: winner ? { id: winner.id, name: winner.name } : null,
        players: room.players,
        round: room.round
    });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Send initial data
    socket.emit('roomList', getRoomList());
    socket.emit('serverStatus', { online: true, playerCount: players.size });

    // Create room
    socket.on('createRoom', (data) => {
        const { roomName, playerName, terrain, maxPlayers, color } = data;
        const roomId = 'room_' + Date.now();

        const room = createRoom(roomId, roomName, socket.id, terrain, maxPlayers);
        room.terrainPoints = generateTerrain(terrain);
        rooms.set(roomId, room);

        const player = createPlayer(socket.id, playerName, roomId, 0, color);
        player.x = GAME_WIDTH / 2;
        player.y = getTerrainHeightAt(room.terrainPoints, player.x);

        players.set(socket.id, player);
        room.players.push(player);

        socket.join(roomId);
        socket.emit('roomCreated', { room, player });
        io.emit('roomList', getRoomList());
        io.emit('serverStatus', { online: true, playerCount: players.size });
    });

    // Join room
    socket.on('joinRoom', (data) => {
        const { roomId, playerName, color } = data;
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', { message: 'Oda bulunamadı!' });
            return;
        }

        if (room.players.length >= room.maxPlayers) {
            socket.emit('error', { message: 'Oda dolu!' });
            return;
        }

        if (room.gameState !== 'waiting') {
            socket.emit('error', { message: 'Oyun zaten başlamış!' });
            return;
        }

        const player = createPlayer(socket.id, playerName, roomId, room.players.length, color);
        player.x = GAME_WIDTH / 2;
        player.y = getTerrainHeightAt(room.terrainPoints, player.x);

        players.set(socket.id, player);
        room.players.push(player);

        socket.join(roomId);
        socket.emit('roomJoined', { room, player });
        io.to(roomId).emit('playerJoined', { player, players: room.players });
        io.emit('roomList', getRoomList());
        io.emit('serverStatus', { online: true, playerCount: players.size });
    });

    // Start game (admin only)
    socket.on('startGame', () => {
        const player = players.get(socket.id);
        if (!player) return;

        const room = rooms.get(player.roomId);
        if (!room || room.adminId !== socket.id) return;

        if (room.players.length < 2) {
            socket.emit('error', { message: 'En az 2 oyuncu gerekli!' });
            return;
        }

        // Generate terrain and position players
        room.terrainPoints = generateTerrain(room.terrain);

        room.gameState = 'playing';
        room.currentTurn = 0;

        positionPlayers(room);

        io.to(room.id).emit('gameStarted', {
            terrain: room.terrainPoints,
            players: room.players,
            currentTurn: room.currentTurn,

            round: room.round
        });

        startTurnTimer(room);
    });

    // Move tank
    socket.on('move', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        const room = rooms.get(player.roomId);
        if (!room || room.gameState !== 'playing') return;

        const currentPlayer = room.players[room.currentTurn];
        if (!currentPlayer || currentPlayer.id !== socket.id) return;

        const { direction } = data; // -1 left, 1 right
        const moveAmount = 8;
        const fuelCost = 2;

        if (player.fuel >= fuelCost) {
            const newX = player.x + (direction * moveAmount);

            // Keep within bounds
            if (newX > 50 && newX < GAME_WIDTH - 50) {
                player.x = newX;
                player.y = getTerrainHeightAt(room.terrainPoints, player.x);
                player.fuel -= fuelCost;

                io.to(room.id).emit('playerMoved', {
                    playerId: socket.id,
                    x: player.x,
                    y: player.y,
                    fuel: player.fuel
                });
            }
        }
    });

    // Adjust aim
    socket.on('aim', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        const room = rooms.get(player.roomId);
        if (!room || room.gameState !== 'playing') return;

        const currentPlayer = room.players[room.currentTurn];
        if (!currentPlayer || currentPlayer.id !== socket.id) return;

        const { angle, power } = data;
        player.angle = Math.max(0, Math.min(180, angle));
        player.power = Math.max(10, Math.min(100, power));

        io.to(room.id).emit('playerAimed', {
            playerId: socket.id,
            angle: player.angle,
            power: player.power
        });
    });

    // Select weapon
    socket.on('selectWeapon', (weaponId) => {
        const player = players.get(socket.id);
        if (!player) return;

        if (player.weapons[weaponId] && (player.weapons[weaponId].count > 0 || player.weapons[weaponId].count === -1)) {
            player.currentWeapon = weaponId;
            io.to(player.roomId).emit('weaponSelected', {
                playerId: socket.id,
                weapon: weaponId
            });
        }
    });

    // Fire weapon
    socket.on('fire', () => {
        const player = players.get(socket.id);
        if (!player) return;

        const room = rooms.get(player.roomId);
        if (!room || room.gameState !== 'playing') return;

        const currentPlayer = room.players[room.currentTurn];
        if (!currentPlayer || currentPlayer.id !== socket.id) return;

        const weapon = WEAPONS[player.currentWeapon];

        // Decrease weapon count if not infinite
        if (player.weapons[player.currentWeapon].count > 0) {
            player.weapons[player.currentWeapon].count--;
        }

        // Send weapon update to sync UI
        socket.emit('weaponUpdate', {
            weapons: player.weapons,
            currentWeapon: player.currentWeapon
        });

        // Calculate initial velocity (power affects distance)
        // Lower values for better balance: power 50 = velocity 25, power 100 = velocity 45
        const angleRad = (player.angle * Math.PI) / 180;
        const velocity = 5 + (player.power * 0.4);

        io.to(room.id).emit('projectileFired', {
            playerId: socket.id,
            startX: player.x,
            startY: player.y,
            angle: angleRad,
            velocity,
            weapon: player.currentWeapon
        });

        // Reset to normal weapon if out of ammo and send update
        if (player.weapons[player.currentWeapon].count === 0) {
            player.currentWeapon = 'normal';
            socket.emit('weaponUpdate', {
                weapons: player.weapons,
                currentWeapon: player.currentWeapon
            });
        }
    });

    // Handle projectile hit
    socket.on('projectileHit', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        const room = rooms.get(player.roomId);
        if (!room || room.gameState !== 'playing') return;

        const { hitX, hitY, weapon } = data;
        const weaponData = WEAPONS[weapon] || WEAPONS.normal;

        // Calculate damage to all players in radius
        const hits = [];
        let anyPlayerKilled = false;

        room.players.forEach(p => {
            if (!p.isAlive) return;

            const dx = p.x - hitX;
            const dy = p.y - hitY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < weaponData.radius) {
                // Damage falls off with distance
                const damageMultiplier = 1 - (distance / weaponData.radius) * 0.5;
                let damage = Math.floor(weaponData.damage * damageMultiplier);

                // Apply armor reduction
                damage = Math.max(1, damage - p.armor);

                // Shield blocks damage
                if (p.shield > 0) {
                    p.shield--;
                    damage = 0;
                }

                p.health = Math.max(0, p.health - damage);

                if (p.health <= 0) {
                    p.isAlive = false;
                    anyPlayerKilled = true;
                }

                hits.push({
                    playerId: p.id,
                    playerName: p.name,
                    damage,
                    health: p.health,
                    isAlive: p.isAlive,
                    shieldBlocked: damage === 0 && p.shield >= 0
                });
            }
        });

        // Award money for hits (50 gold per hit)
        if (hits.length > 0) {
            const totalReward = hits.length * 50;
            player.money += totalReward;
            socket.emit('moneyUpdate', { money: player.money });
        }

        // Send explosion event
        io.to(room.id).emit('explosion', {
            x: hitX,
            y: hitY,
            radius: weaponData.radius,
            weapon,
            hits
        });

        // Send elimination events
        hits.forEach(hit => {
            if (!hit.isAlive) {
                io.to(room.id).emit('playerEliminated', {
                    playerId: hit.playerId,
                    playerName: hit.playerName
                });
            }
        });

        // Check for round end
        const alivePlayers = room.players.filter(p => p.isAlive);

        // Small delay before next turn/round end to show effects
        setTimeout(() => {
            if (alivePlayers.length <= 1) {
                endRound(room, alivePlayers[0] || null);
            } else {
                nextTurn(room);
            }
        }, 1500);
    });

    // Purchase item
    socket.on('purchase', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        const room = rooms.get(player.roomId);
        if (!room || room.gameState !== 'roundEnd') return;

        const { type, itemId } = data;

        if (type === 'weapon') {
            const weapon = WEAPONS[itemId];
            if (!weapon) {
                socket.emit('error', { message: 'Silah bulunamadı!' });
                return;
            }
            if (player.money >= weapon.price) {
                player.money -= weapon.price;
                // Create weapon slot if doesn't exist
                if (!player.weapons[itemId]) {
                    player.weapons[itemId] = { count: 0 };
                }
                player.weapons[itemId].count += weapon.count === -1 ? 0 : 1;
                socket.emit('purchaseSuccess', { type, itemId, player });
            } else {
                socket.emit('error', { message: 'Yetersiz para!' });
            }
        } else if (type === 'upgrade') {
            const upgrade = UPGRADES[itemId];
            if (upgrade && player.money >= upgrade.price) {
                // Check if already at max cap
                const currentValue = player[upgrade.stat] || 0;
                if (upgrade.maxCap && currentValue >= upgrade.maxCap) {
                    socket.emit('error', { message: 'Maksimum seviyeye ulaştın!' });
                    return;
                }

                player.money -= upgrade.price;
                player[upgrade.stat] = Math.min(currentValue + upgrade.value, upgrade.maxCap || Infinity);
                socket.emit('purchaseSuccess', { type, itemId, player });
            } else {
                socket.emit('error', { message: 'Yetersiz para!' });
            }
        }
    });

    // Ready for next round
    socket.on('ready', () => {
        const player = players.get(socket.id);
        if (!player) return;

        const room = rooms.get(player.roomId);
        if (!room || room.gameState !== 'roundEnd') return;

        player.ready = true;

        io.to(room.id).emit('playerReady', {
            playerId: player.id,
            playerName: player.name
        });

        // Check if all players are ready
        const allReady = room.players.every(p => p.ready);
        if (allReady) {
            room.round++;
            startRound(room);
        }
    });

    // Leave room
    socket.on('leaveRoom', () => {
        handlePlayerLeave(socket);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        handlePlayerLeave(socket);
    });
});

// Handle player leaving
function handlePlayerLeave(socket) {
    const player = players.get(socket.id);
    if (!player) return;

    const room = rooms.get(player.roomId);
    if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        socket.leave(room.id);

        clearTurnTimer(room);

        if (room.players.length === 0) {
            rooms.delete(room.id);
        } else {
            // Transfer admin if needed
            if (room.adminId === socket.id) {
                room.adminId = room.players[0].id;
            }

            // If game in progress, check if current turn player left
            if (room.gameState === 'playing') {
                const alivePlayers = room.players.filter(p => p.isAlive);
                if (alivePlayers.length <= 1) {
                    endRound(room, alivePlayers[0] || null);
                } else if (room.currentTurn >= room.players.length) {
                    room.currentTurn = 0;
                    nextTurn(room);
                }
            }

            io.to(room.id).emit('playerLeft', {
                playerId: socket.id,
                players: room.players,
                newAdmin: room.adminId
            });
        }

        io.emit('roomList', getRoomList());
    }

    players.delete(socket.id);
    io.emit('serverStatus', { online: true, playerCount: players.size });
}

// Get room list for lobby
function getRoomList() {
    const list = [];
    rooms.forEach((room, id) => {
        list.push({
            id,
            name: room.name,
            terrain: room.terrain,
            playerCount: room.players.length,
            maxPlayers: room.maxPlayers,
            gameState: room.gameState
        });
    });
    return list;
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎮 Tanks Arena server running on port ${PORT}`);
});
