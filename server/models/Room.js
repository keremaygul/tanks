const GAME_WIDTH = 1200;
const GAME_HEIGHT = 600;

class Room {
    constructor(id, name, adminId, terrainType, maxPlayers) {
        this.id = id;
        this.name = name;
        this.adminId = adminId;
        this.terrain = terrainType;
        this.maxPlayers = Math.min(Math.max(maxPlayers, 2), 4);

        this.players = [];
        this.gameState = 'waiting'; // waiting, playing, roundEnd, finished

        // Round Data
        this.currentTurn = 0;
        this.round = 1;
        this.terrainPoints = [];

        this.width = GAME_WIDTH;
        this.height = GAME_HEIGHT;

        this.turnTimeout = null;

        // Turn control
        this.hasFiredThisTurn = false; // Prevents multi-fire bug
    }

    addPlayer(player) {
        if (this.players.length >= this.maxPlayers) return false;
        this.players.push(player);
        return true;
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        if (this.adminId === playerId && this.players.length > 0) {
            this.adminId = this.players[0].id; // Transfer admin
            return this.adminId; // Return new admin ID
        }
        return null;
    }

    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    }
}

module.exports = Room;
