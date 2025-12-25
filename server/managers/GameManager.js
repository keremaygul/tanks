const physics = require('../physics/PhysicsEngine');
const { WEAPONS } = require('../models/Player');

// Terrain Cycle Order
const TERRAIN_ORDER = ['desert', 'jungle', 'mountain', 'snow'];

class GameManager {
    constructor(io, roomManager) {
        this.io = io;
        this.roomManager = roomManager;
    }

    startGame(room) {
        if (!room || room.players.length < 2) return;

        // Generate terrain
        room.terrainPoints = physics.generateTerrain(room.terrain);
        room.gameState = 'playing';
        room.currentTurn = 0;
        room.round = 1;

        this.positionPlayers(room);
        this.startTurn(room);

        this.io.to(room.id).emit('gameStarted', {
            terrain: room.terrainPoints,
            players: room.players,
            currentTurn: room.currentTurn,
            round: room.round
        });
    }

    startRound(room) {
        room.gameState = 'playing';

        // Cycle terrain
        const terrainIndex = (room.round - 1) % TERRAIN_ORDER.length;
        room.terrain = TERRAIN_ORDER[terrainIndex];
        room.terrainPoints = physics.generateTerrain(room.terrain);

        room.currentTurn = 0;
        this.positionPlayers(room);

        // Find first alive player
        while (!room.players[room.currentTurn]?.isAlive && room.currentTurn < room.players.length) {
            room.currentTurn++;
        }

        this.io.to(room.id).emit('roundStarted', {
            terrain: room.terrainPoints,
            terrainType: room.terrain,
            players: room.players,
            currentTurn: room.currentTurn,
            round: room.round
        });

        this.startTurn(room);
    }

    positionPlayers(room) {
        const playerCount = room.players.length;
        const margin = 120;
        const availableWidth = room.width - margin * 2;
        const spacing = availableWidth / (playerCount + 1);

        // Simple even spacing randomized slightly
        const positions = [];
        for (let i = 0; i < playerCount; i++) {
            positions.push(margin + spacing * (i + 1));
        }

        // Shuffle positions
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }

        room.players.forEach((player, index) => {
            player.x = positions[index];
            player.y = physics.getTerrainHeightAt(room.terrainPoints, player.x);
            player.resetForRound(); // Health stays, fuel resets
            player.isAlive = true;
            player.health = player.maxHealth; // Full health each round? Original code did this. Let's keep it.
        });
    }

    startTurn(room) {
        this.clearTurnTimer(room);
        room.hasFiredThisTurn = false; // Reset fire flag

        // Auto-skip dead players
        const currentPlayer = room.players[room.currentTurn];
        if (!currentPlayer || !currentPlayer.isAlive) {
            this.nextTurn(room);
            return;
        }

        room.turnTimeout = setTimeout(() => {
            if (room.gameState === 'playing') {
                this.nextTurn(room);
            }
        }, 45000); // 45s turn limit
    }

    nextTurn(room) {
        this.clearTurnTimer(room);

        const alivePlayers = room.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 1) {
            this.endRound(room, alivePlayers[0] || null);
            return;
        }

        let nextIndex = room.currentTurn;
        let attempts = 0;
        do {
            nextIndex = (nextIndex + 1) % room.players.length;
            attempts++;
        } while (!room.players[nextIndex].isAlive && attempts <= room.players.length);

        room.currentTurn = nextIndex;

        // Refill fuel for next player
        if (room.players[nextIndex]) {
            room.players[nextIndex].fuel = room.players[nextIndex].maxFuel;
        }

        this.io.to(room.id).emit('turnChanged', {
            currentTurn: room.currentTurn,
            playerId: room.players[room.currentTurn].id,
            playerName: room.players[room.currentTurn].name
        });

        this.startTurn(room);
    }

    endRound(room, winner) {
        this.clearTurnTimer(room);
        room.gameState = 'roundEnd';

        if (winner) winner.money += 250;
        room.players.forEach(p => {
            p.money += 75;
            p.ready = false;
        });

        this.io.to(room.id).emit('roundEnded', {
            winner: winner ? { id: winner.id, name: winner.name } : null,
            players: room.players,
            round: room.round
        });
    }

    clearTurnTimer(room) {
        if (room.turnTimeout) {
            clearTimeout(room.turnTimeout);
            room.turnTimeout = null;
        }
    }

    // ACTIONS

    handleMove(socket, direction) {
        const player = this._getPlayer(socket);
        if (!player) return;

        const room = this.roomManager.getRoom(player.roomId);
        if (!this._validateTurn(room, player)) return; // Prevents moving if not turn or fired (optional: allow move after fire? No, strict turn.)

        // Check if already fired? Usually games allow move before fire, not after.
        if (room.hasFiredThisTurn) return;

        const moveAmount = 3; // Reduced for smoother server tick? Or keep logic simple.
        // Original was 8 pixels. Let's do 8.
        const actualMove = 8;
        const fuelCost = 2;

        if (player.fuel >= fuelCost) {
            const newX = player.x + (direction * actualMove);
            if (newX > 50 && newX < room.width - 50) {
                player.x = newX;
                player.y = physics.getTerrainHeightAt(room.terrainPoints, player.x);
                player.fuel -= fuelCost;

                this.io.to(room.id).emit('playerMoved', {
                    playerId: player.id,
                    x: player.x,
                    y: player.y,
                    fuel: player.fuel
                });
            }
        }
    }

    handleAim(socket, angle, power) {
        const player = this._getPlayer(socket);
        if (!player) return;
        const room = this.roomManager.getRoom(player.roomId);
        if (!this._validateTurn(room, player)) return;

        // Allow aiming even after fire? Usually yes, to see where it lands.
        // But for turn strictness, maybe not.

        player.angle = Math.max(0, Math.min(180, angle));
        player.power = Math.max(10, Math.min(100, power));

        socket.to(room.id).emit('playerAimed', {
            playerId: player.id,
            angle: player.angle,
            power: player.power
        });
    }

    handleFire(socket) {
        const player = this._getPlayer(socket);
        if (!player) return;
        const room = this.roomManager.getRoom(player.roomId);

        // CRITICAL BUG FIX: Check hasFiredThisTurn
        if (!this._validateTurn(room, player)) return;
        if (room.hasFiredThisTurn) {
            console.log(`Prevented multi-fire from ${player.name}`);
            return;
        }

        const weapon = WEAPONS[player.currentWeapon];
        if (player.weapons[player.currentWeapon].count > 0) {
            player.weapons[player.currentWeapon].count--;
        }

        room.hasFiredThisTurn = true; // LOCK TURN IMMEDIATELY
        this.clearTurnTimer(room); // Stop timer so it doesn't auto-skip while projectile flies

        // Notify start of fire (visuals)
        const angleRad = (player.angle * Math.PI) / 180;
        const velocity = 5 + (player.power * 0.4);

        this.io.to(room.id).emit('projectileFired', {
            playerId: player.id,
            startX: player.x,
            startY: player.y,
            angle: angleRad,
            velocity,
            weapon: player.currentWeapon
        });

        socket.emit('weaponUpdate', {
            weapons: player.weapons,
            currentWeapon: player.currentWeapon
        });

        // Handle ammo reset if empty
        if (player.weapons[player.currentWeapon].count === 0) {
            player.currentWeapon = 'normal';
            socket.emit('weaponUpdate', {
                weapons: player.weapons,
                currentWeapon: player.currentWeapon
            });
        }

        // CALCULATE PHYSICS ON SERVER
        // Multi-projectile support (Triple Shot)
        const projectileCount = player.currentWeapon === 'triple' ? 3 : 1;
        const spreadAngle = 0.12;

        // We need to calculate terrain angle for the start position to match client visual
        // The client offsets the turret based on terrain slope.
        // For simplicity server-side, we can just use player.x/y as start, minor discrepancy manageable.
        // Or replicate the tank tilt logic.
        // Let's us basic physics for now. 

        // Calculate the trajectories
        const hits = new Set(); // Unique players hit
        let anyHit = false;

        let completedProjectiles = 0;

        for (let i = 0; i < projectileCount; i++) {
            let finalAngle = angleRad;
            if (player.currentWeapon === 'triple') {
                finalAngle += (i - 1) * spreadAngle;
            }

            // Initial position correction to match client barrel
            // Assuming barrel length is negligible for coarse server check, or use logic from game.js
            // Using simple start point at player center + small offset up
            const startX = player.x;
            const startY = player.y - 20;

            const result = physics.simulateProjectile(startX, startY, finalAngle, velocity, room.terrainPoints, 0);

            // Process impact
            // Delay event to match visual flight time?
            // Or send impact point immediately and let client interpolate?
            // Better: Send impact point immediately, client handles animation and snaps if needed.
            // Actually, for "Anti-Cheat", we must dictate the result.

            // Ideally we wait for flight time.
            // Flight time approx stats.
            // Distance / Velocity? Integration steps?
            // Let's just use a timeout based on distance to simulate flight.
            const dist = Math.sqrt(Math.pow(result.x - startX, 2) + Math.pow(result.y - startY, 2));
            const flightTime = (dist / velocity) * 20; // Rough heuristic ms

            setTimeout(() => {
                this.processExplosion(room, result.x, result.y, weapon, player);
                completedProjectiles++;

                if (completedProjectiles === projectileCount) {
                    // Turn end delay
                    setTimeout(() => {
                        const alivePlayers = room.players.filter(p => p.isAlive);
                        if (alivePlayers.length <= 1) {
                            this.endRound(room, alivePlayers[0] || null);
                        } else {
                            this.nextTurn(room);
                        }
                    }, 2000);
                }
            }, flightTime);
        }
    }

    processExplosion(room, x, y, weaponData, shooter) {
        const hits = physics.checkPlayerCollision(x, y, weaponData.radius, room.players, weaponData.damage, shooter.id);

        if (hits.length > 0) {
            const reward = hits.length * 50;
            shooter.money += reward;
            // Notify shooter
            const shooterSocket = this.io.sockets.sockets.get(shooter.id);
            if (shooterSocket) shooterSocket.emit('moneyUpdate', { money: shooter.money });
        }

        this.io.to(room.id).emit('explosion', {
            x, y,
            radius: weaponData.radius,
            weapon: weaponData.name, // or key
            hits: hits
        });

        hits.forEach(hit => {
            if (!hit.isAlive) {
                this.io.to(room.id).emit('playerEliminated', {
                    playerId: hit.playerId,
                    playerName: hit.playerName
                });
            }
        });
    }

    _getPlayer(socket) {
        // Need to find player from RoomManager's rooms
        // This is inefficient. In a real app we'd map socket.id -> player/room directly.
        // For now, iterate.
        const room = this.roomManager.findRoomByPlayerId(socket.id);
        if (room) {
            return room.getPlayer(socket.id);
        }
        return null;
    }

    _validateTurn(room, player) {
        if (!room || room.gameState !== 'playing') return false;
        const currentPlayer = room.players[room.currentTurn];
        return currentPlayer && currentPlayer.id === player.id;
    }
}

module.exports = GameManager;
