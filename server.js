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

// Terrain types
const TERRAINS = ['desert', 'jungle', 'mountain', 'snow'];

// Weapon definitions
const WEAPONS = {
    normal: { name: 'Normal Shot', price: 0, damage: 25, radius: 30, count: -1 },
    triple: { name: 'Triple Shot', price: 100, damage: 20, radius: 25, count: 3 },
    atom: { name: 'Atom Bomb', price: 300, damage: 80, radius: 100, count: 1 },
    napalm: { name: 'Napalm', price: 200, damage: 15, radius: 60, count: 2, burn: true }
};

// Upgrade definitions
const UPGRADES = {
    armor: { name: 'Armor +10', price: 50, stat: 'armor', value: 10 },
    fuel: { name: 'Fuel +20', price: 30, stat: 'maxFuel', value: 20 },
    health: { name: 'Health +20', price: 75, stat: 'maxHealth', value: 20 },
    shield: { name: 'Shield', price: 100, stat: 'shield', value: 1 }
};

// Generate terrain
function generateTerrain(type, width) {
    const points = [];
    const segments = 100;
    const segmentWidth = width / segments;
    
    let baseHeight = 300;
    let amplitude = 80;
    let frequency = 0.02;
    
    switch(type) {
        case 'mountain':
            amplitude = 150;
            frequency = 0.015;
            break;
        case 'desert':
            amplitude = 40;
            frequency = 0.03;
            break;
        case 'snow':
            amplitude = 100;
            frequency = 0.02;
            break;
        case 'jungle':
            amplitude = 60;
            frequency = 0.025;
            break;
    }
    
    for (let i = 0; i <= segments; i++) {
        const x = i * segmentWidth;
        const noise1 = Math.sin(i * frequency * 10) * amplitude;
        const noise2 = Math.sin(i * frequency * 20) * (amplitude * 0.5);
        const noise3 = Math.sin(i * frequency * 5) * (amplitude * 0.3);
        const y = baseHeight + noise1 + noise2 + noise3;
        points.push({ x, y });
    }
    
    return points;
}

// Create new player
function createPlayer(id, name, roomId) {
    return {
        id,
        name,
        roomId,
        health: 100,
        maxHealth: 100,
        fuel: 50,
        maxFuel: 50,
        money: 0,
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
            napalm: { count: 0 }
        },
        currentWeapon: 'normal',
        isAlive: true,
        color: getPlayerColor(id)
    };
}

// Get player color based on index
function getPlayerColor(id) {
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'];
    const hash = id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
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
        gameState: 'waiting', // waiting, playing, finished
        currentTurn: 0,
        round: 1,
        terrainPoints: [],
        wind: 0,
        width: 1200,
        height: 600
    };
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Send room list on connect
    socket.emit('roomList', getRoomList());
    socket.emit('serverStatus', { online: true, playerCount: players.size });
    
    // Create room
    socket.on('createRoom', (data) => {
        const { roomName, playerName, terrain, maxPlayers } = data;
        const roomId = 'room_' + Date.now();
        
        const room = createRoom(roomId, roomName, socket.id, terrain, maxPlayers);
        rooms.set(roomId, room);
        
        const player = createPlayer(socket.id, playerName, roomId);
        players.set(socket.id, player);
        room.players.push(player);
        
        socket.join(roomId);
        socket.emit('roomCreated', { room, player });
        io.emit('roomList', getRoomList());
    });
    
    // Join room
    socket.on('joinRoom', (data) => {
        const { roomId, playerName } = data;
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
        
        const player = createPlayer(socket.id, playerName, roomId);
        players.set(socket.id, player);
        room.players.push(player);
        
        socket.join(roomId);
        socket.emit('roomJoined', { room, player });
        io.to(roomId).emit('playerJoined', { player, players: room.players });
        io.emit('roomList', getRoomList());
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
        
        // Generate terrain
        room.terrainPoints = generateTerrain(room.terrain, room.width);
        room.gameState = 'playing';
        room.wind = (Math.random() - 0.5) * 20;
        
        // Position players
        const spacing = room.width / (room.players.length + 1);
        room.players.forEach((p, index) => {
            p.x = spacing * (index + 1);
            // Find terrain height at player position
            const terrainIndex = Math.floor((p.x / room.width) * room.terrainPoints.length);
            p.y = room.terrainPoints[Math.min(terrainIndex, room.terrainPoints.length - 1)].y;
            p.fuel = p.maxFuel;
            p.health = p.maxHealth;
            p.isAlive = true;
        });
        
        io.to(room.id).emit('gameStarted', {
            terrain: room.terrainPoints,
            players: room.players,
            currentTurn: room.currentTurn,
            wind: room.wind,
            round: room.round
        });
    });
    
    // Move tank
    socket.on('move', (data) => {
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = rooms.get(player.roomId);
        if (!room || room.gameState !== 'playing') return;
        
        const currentPlayer = room.players[room.currentTurn];
        if (currentPlayer.id !== socket.id) return;
        
        const { direction } = data; // -1 left, 1 right
        const moveAmount = 5;
        const fuelCost = 1;
        
        if (player.fuel >= fuelCost) {
            const newX = player.x + (direction * moveAmount);
            if (newX > 30 && newX < room.width - 30) {
                player.x = newX;
                player.fuel -= fuelCost;
                
                // Update Y position based on terrain
                const terrainIndex = Math.floor((player.x / room.width) * room.terrainPoints.length);
                player.y = room.terrainPoints[Math.min(terrainIndex, room.terrainPoints.length - 1)].y;
                
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
        if (currentPlayer.id !== socket.id) return;
        
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
        if (currentPlayer.id !== socket.id) return;
        
        const weapon = WEAPONS[player.currentWeapon];
        
        // Decrease weapon count
        if (player.weapons[player.currentWeapon].count > 0) {
            player.weapons[player.currentWeapon].count--;
        }
        
        // Calculate trajectory
        const angleRad = (player.angle * Math.PI) / 180;
        const velocity = player.power * 0.5;
        
        io.to(room.id).emit('projectileFired', {
            playerId: socket.id,
            startX: player.x,
            startY: player.y - 20,
            angle: angleRad,
            velocity,
            weapon: player.currentWeapon,
            wind: room.wind
        });
        
        // Reset to normal weapon if out of ammo
        if (player.weapons[player.currentWeapon].count === 0) {
            player.currentWeapon = 'normal';
        }
    });
    
    // Handle projectile hit (calculated on client, verified on server)
    socket.on('projectileHit', (data) => {
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = rooms.get(player.roomId);
        if (!room || room.gameState !== 'playing') return;
        
        const { hitX, hitY, weapon } = data;
        const weaponData = WEAPONS[weapon];
        
        // Calculate damage to all players in radius
        const hits = [];
        room.players.forEach(p => {
            if (!p.isAlive) return;
            
            const distance = Math.sqrt(Math.pow(p.x - hitX, 2) + Math.pow(p.y - hitY, 2));
            if (distance < weaponData.radius) {
                const damageMultiplier = 1 - (distance / weaponData.radius);
                let damage = Math.floor(weaponData.damage * damageMultiplier);
                
                // Apply armor
                damage = Math.max(1, damage - p.armor);
                
                // Apply shield
                if (p.shield > 0) {
                    p.shield--;
                    damage = 0;
                }
                
                p.health -= damage;
                
                if (p.health <= 0) {
                    p.health = 0;
                    p.isAlive = false;
                }
                
                hits.push({
                    playerId: p.id,
                    playerName: p.name,
                    damage,
                    health: p.health,
                    isAlive: p.isAlive
                });
            }
        });
        
        io.to(room.id).emit('explosion', {
            x: hitX,
            y: hitY,
            radius: weaponData.radius,
            weapon,
            hits
        });
        
        // Check for eliminated players
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
        if (alivePlayers.length <= 1) {
            // Round ended
            room.gameState = 'roundEnd';
            
            if (alivePlayers.length === 1) {
                // Winner gets money
                alivePlayers[0].money += 200;
            }
            
            // All players get participation money
            room.players.forEach(p => {
                p.money += 50;
            });
            
            io.to(room.id).emit('roundEnded', {
                winner: alivePlayers[0] || null,
                players: room.players,
                round: room.round
            });
        } else {
            // Next turn
            nextTurn(room);
        }
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
            if (weapon && player.money >= weapon.price) {
                player.money -= weapon.price;
                player.weapons[itemId].count += 1;
                socket.emit('purchaseSuccess', { type, itemId, player });
            }
        } else if (type === 'upgrade') {
            const upgrade = UPGRADES[itemId];
            if (upgrade && player.money >= upgrade.price) {
                player.money -= upgrade.price;
                player[upgrade.stat] += upgrade.value;
                socket.emit('purchaseSuccess', { type, itemId, player });
            }
        }
    });
    
    // Ready for next round
    socket.on('ready', () => {
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = rooms.get(player.roomId);
        if (!room) return;
        
        player.ready = true;
        
        const allReady = room.players.every(p => p.ready);
        if (allReady) {
            startNewRound(room);
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
        io.emit('serverStatus', { online: true, playerCount: players.size });
    });
});

// Helper functions
function nextTurn(room) {
    let nextIndex = room.currentTurn;
    let attempts = 0;
    
    do {
        nextIndex = (nextIndex + 1) % room.players.length;
        attempts++;
    } while (!room.players[nextIndex].isAlive && attempts < room.players.length);
    
    room.currentTurn = nextIndex;
    
    // Reset fuel for next player
    room.players[nextIndex].fuel = room.players[nextIndex].maxFuel;
    
    // Randomize wind
    room.wind = (Math.random() - 0.5) * 20;
    
    io.to(room.id).emit('turnChanged', {
        currentTurn: room.currentTurn,
        playerId: room.players[room.currentTurn].id,
        wind: room.wind
    });
}

function startNewRound(room) {
    room.round++;
    room.gameState = 'playing';
    room.currentTurn = 0;
    room.wind = (Math.random() - 0.5) * 20;
    room.terrainPoints = generateTerrain(room.terrain, room.width);
    
    // Reset and reposition players
    const spacing = room.width / (room.players.length + 1);
    room.players.forEach((p, index) => {
        p.x = spacing * (index + 1);
        const terrainIndex = Math.floor((p.x / room.width) * room.terrainPoints.length);
        p.y = room.terrainPoints[Math.min(terrainIndex, room.terrainPoints.length - 1)].y;
        p.health = p.maxHealth;
        p.fuel = p.maxFuel;
        p.isAlive = true;
        p.ready = false;
    });
    
    io.to(room.id).emit('roundStarted', {
        terrain: room.terrainPoints,
        players: room.players,
        currentTurn: room.currentTurn,
        wind: room.wind,
        round: room.round
    });
}

function handlePlayerLeave(socket) {
    const player = players.get(socket.id);
    if (!player) return;
    
    const room = rooms.get(player.roomId);
    if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        socket.leave(room.id);
        
        if (room.players.length === 0) {
            rooms.delete(room.id);
        } else {
            // Transfer admin if needed
            if (room.adminId === socket.id) {
                room.adminId = room.players[0].id;
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
}

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
