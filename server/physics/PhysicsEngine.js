const GAME_WIDTH = 1200;
const GAME_HEIGHT = 600;

class PhysicsEngine {
    constructor() {
        this.width = GAME_WIDTH;
        this.height = GAME_HEIGHT;
    }

    generateTerrain(type) {
        const points = [];
        const segments = 120;
        const segmentWidth = this.width / segments;
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
            const noise1 = Math.sin(x * frequency) * amplitude;
            const noise2 = Math.sin(x * frequency * 2.5 + 1.5) * (amplitude * 0.4);
            const noise3 = Math.sin(x * frequency * 0.5 + 0.7) * (amplitude * 0.3);
            const y = baseHeight + noise1 + noise2 + noise3;
            points.push({ x, y });
        }
        return points;
    }

    getTerrainHeightAt(points, x) {
        if (!points || points.length < 2) return 400;

        // Find the two points that x falls between
        for (let i = 0; i < points.length - 1; i++) {
            if (x >= points[i].x && x <= points[i + 1].x) {
                const t = (x - points[i].x) / (points[i + 1].x - points[i].x);
                return points[i].y + t * (points[i + 1].y - points[i].y);
            }
        }

        if (x < points[0].x) return points[0].y;
        return points[points.length - 1].y;
    }

    // Server-side projectile simulation
    simulateProjectile(startX, startY, angleRad, velocity, terrainPoints, wind = 0) {
        const gravity = 0.25;
        let x = startX;
        let y = startY;
        let vx = Math.sin(angleRad) * velocity;
        let vy = -Math.cos(angleRad) * velocity;

        // Simulate step by step until hit or out of bounds
        // Limit steps to prevent infinite loops
        const maxSteps = 1000;

        for (let i = 0; i < maxSteps; i++) {
            x += vx;
            y += vy;
            vy += gravity;
            vx += wind;

            // Check collision with terrain
            if (x >= 0 && x <= this.width) {
                const terrainHeight = this.getTerrainHeightAt(terrainPoints, x);
                if (y >= terrainHeight) {
                    return { x, y, hit: true, type: 'terrain' };
                }
            }

            // Check out of bounds (bottom)
            if (y > this.height) {
                return { x, y, hit: true, type: 'bounds' };
            }
            // Check out of bounds (sides - allow some leeway)
            if (x < -100 || x > this.width + 100) {
                return { x, y, hit: true, type: 'bounds' };
            }
        }

        return { x, y, hit: false, type: 'timeout' };
    }

    // Check if a point hits any player
    checkPlayerCollision(x, y, radius, players, damage, shooterId) {
        const hits = [];

        players.forEach(p => {
            if (!p.isAlive) return;

            const dx = p.x - x;
            const dy = p.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < radius) {
                // Damage falloff
                const damageMultiplier = 1 - (distance / radius) * 0.5;
                let finalDamage = Math.floor(damage * damageMultiplier);

                // Apply armor
                finalDamage = Math.max(1, finalDamage - p.armor);

                // Shield check
                if (p.shield > 0) {
                    p.shield--;
                    finalDamage = 0;
                }

                p.health = Math.max(0, p.health - finalDamage);
                if (p.health <= 0) p.isAlive = false;

                hits.push({
                    playerId: p.id,
                    playerName: p.name,
                    damage: finalDamage,
                    health: p.health,
                    isAlive: p.isAlive,
                    shieldBlocked: finalDamage === 0 && p.shield >= 0
                });
            }
        });

        return hits;
    }
}

module.exports = new PhysicsEngine();
