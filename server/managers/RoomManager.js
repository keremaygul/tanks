const Room = require('../models/Room');
const { Player } = require('../models/Player');
const physics = require('../physics/PhysicsEngine');

class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(id, name, adminId, terrainType, maxPlayers) {
        const room = new Room(id, name, adminId, terrainType, maxPlayers);
        // Generate initial terrain
        room.terrainPoints = physics.generateTerrain(terrainType);
        this.rooms.set(id, room);
        return room;
    }

    getRoom(id) {
        return this.rooms.get(id);
    }

    deleteRoom(id) {
        return this.rooms.delete(id);
    }

    getRoomList() {
        const list = [];
        this.rooms.forEach((room, id) => {
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

    // Helper to find which room a player is in (naive approach, optimal would be a player map)
    findRoomByPlayerId(playerId) {
        for (const room of this.rooms.values()) {
            if (room.players.find(p => p.id === playerId)) {
                return room;
            }
        }
        return null;
    }
}

module.exports = new RoomManager();
