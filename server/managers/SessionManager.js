const crypto = require('crypto');

class SessionManager {
    constructor() {
        this.sessions = new Map(); // token -> { roomId, playerId, timestamp }
    }

    createSession(roomId, playerId) {
        const token = crypto.randomUUID();
        this.sessions.set(token, {
            roomId,
            playerId,
            timestamp: Date.now()
        });

        // Cleanup old sessions occasionally
        if (this.sessions.size > 1000) {
            this.cleanup();
        }

        return token;
    }

    getSession(token) {
        return this.sessions.get(token);
    }

    cleanup() {
        const now = Date.now();
        const expiry = 2 * 60 * 60 * 1000; // 2 hours
        for (const [token, data] of this.sessions) {
            if (now - data.timestamp > expiry) {
                this.sessions.delete(token);
            }
        }
    }
}

module.exports = new SessionManager();
