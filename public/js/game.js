// =====================================================
// TANKS ARENA - Game Engine
// Canvas rendering, physics, effects
// =====================================================

class TanksGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Game state
        this.terrain = [];
        this.players = [];
        this.projectiles = [];
        this.explosions = [];
        this.particles = [];

        this.currentTurn = 0;
        this.myPlayerId = null;
        this.wind = 0;
        this.terrainType = 'desert';

        // Physics
        this.gravity = 0.15;

        // Animation
        this.animationId = null;
        this.lastTime = 0;

        // Theme colors
        this.themes = {
            desert: {
                sky: ['#f97316', '#fbbf24', '#fef3c7'],
                ground: '#c2956e',
                groundDark: '#a67c52',
                particles: ['#fbbf24', '#f97316', '#c2956e']
            },
            jungle: {
                sky: ['#0ea5e9', '#34d399', '#6ee7b7'],
                ground: '#4a7c59',
                groundDark: '#3d6b4a',
                particles: ['#34d399', '#4a7c59', '#2d5a3d']
            },
            mountain: {
                sky: ['#1e3a5f', '#3b82f6', '#93c5fd'],
                ground: '#6b7280',
                groundDark: '#4b5563',
                particles: ['#9ca3af', '#6b7280', '#4b5563']
            },
            snow: {
                sky: ['#475569', '#94a3b8', '#cbd5e1'],
                ground: '#e5e7eb',
                groundDark: '#d1d5db',
                particles: ['#ffffff', '#e5e7eb', '#cbd5e1']
            }
        };

        // Bind methods
        this.render = this.render.bind(this);
        this.resize = this.resize.bind(this);

        // Setup
        window.addEventListener('resize', this.resize);
        this.resize();
    }

    resize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Account for HUD, weapon panel, and controls
        const hudHeight = document.getElementById('game-hud')?.offsetHeight || 0;
        const weaponHeight = document.querySelector('.weapon-panel')?.offsetHeight || 0;
        const controlsHeight = document.getElementById('controls-panel')?.offsetHeight || 0;

        this.canvas.width = rect.width;
        this.canvas.height = Math.max(200, window.innerHeight - hudHeight - weaponHeight - controlsHeight - 60);

        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    start() {
        if (!this.animationId) {
            this.lastTime = performance.now();
            this.animationId = requestAnimationFrame(this.render);
        }
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    setTerrain(points, type) {
        this.terrainType = type;
        // Scale terrain to canvas size
        this.terrain = points.map(p => ({
            x: (p.x / 1200) * this.width,
            y: this.height - ((600 - p.y) / 600) * this.height
        }));
    }

    setPlayers(players) {
        this.players = players.map(p => ({
            ...p,
            displayX: (p.x / 1200) * this.width,
            displayY: this.height - ((600 - p.y) / 600) * this.height
        }));
    }

    updatePlayer(playerId, data) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            Object.assign(player, data);
            player.displayX = (player.x / 1200) * this.width;
            player.displayY = this.height - ((600 - player.y) / 600) * this.height;
        }
    }

    fireProjectile(data) {
        const { startX, startY, angle, velocity, weapon, wind } = data;

        const displayX = (startX / 1200) * this.width;
        const displayY = this.height - ((600 - startY) / 600) * this.height;

        // For triple shot, create 3 projectiles
        const projectileCount = weapon === 'triple' ? 3 : 1;
        const angleSpread = weapon === 'triple' ? 0.15 : 0;

        for (let i = 0; i < projectileCount; i++) {
            const adjustedAngle = angle + (i - 1) * angleSpread;

            this.projectiles.push({
                x: displayX,
                y: displayY,
                vx: Math.cos(adjustedAngle) * velocity * (this.width / 1200),
                vy: -Math.sin(adjustedAngle) * velocity * (this.height / 600),
                wind: wind * 0.01 * (this.width / 1200),
                weapon,
                trail: []
            });
        }
    }

    createExplosion(x, y, radius, weapon) {
        const displayX = (x / 1200) * this.width;
        const displayY = this.height - ((600 - y) / 600) * this.height;
        const displayRadius = (radius / 1200) * this.width * 2;

        this.explosions.push({
            x: displayX,
            y: displayY,
            radius: 0,
            maxRadius: displayRadius,
            alpha: 1,
            weapon
        });

        // Create particles
        const particleCount = weapon === 'atom' ? 50 : 20;
        const theme = this.themes[this.terrainType];

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 2 + Math.random() * 4;

            this.particles.push({
                x: displayX,
                y: displayY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                life: 1,
                decay: 0.02 + Math.random() * 0.02,
                size: 3 + Math.random() * 5,
                color: weapon === 'napalm' ?
                    ['#f97316', '#ef4444', '#fbbf24'][Math.floor(Math.random() * 3)] :
                    theme.particles[Math.floor(Math.random() * theme.particles.length)]
            });
        }

        // Screen shake
        this.screenShake = weapon === 'atom' ? 20 : 10;
    }

    render(currentTime) {
        const delta = (currentTime - this.lastTime) / 16.67; // Normalize to 60fps
        this.lastTime = currentTime;

        // Clear
        this.ctx.save();

        // Apply screen shake
        if (this.screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShake;
            const shakeY = (Math.random() - 0.5) * this.screenShake;
            this.ctx.translate(shakeX, shakeY);
            this.screenShake *= 0.9;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        // Draw sky
        this.drawSky();

        // Draw atmospheric particles
        this.drawAtmosphere();

        // Draw terrain
        this.drawTerrain();

        // Update and draw projectiles
        this.updateProjectiles(delta);

        // Draw tanks
        this.drawTanks();

        // Update and draw explosions
        this.updateExplosions(delta);

        // Update and draw particles
        this.updateParticles(delta);

        this.ctx.restore();

        this.animationId = requestAnimationFrame(this.render);
    }

    drawSky() {
        const theme = this.themes[this.terrainType];
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);

        gradient.addColorStop(0, theme.sky[0]);
        gradient.addColorStop(0.5, theme.sky[1]);
        gradient.addColorStop(1, theme.sky[2]);

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw sun/moon
        if (this.terrainType === 'desert') {
            this.ctx.fillStyle = '#fff7ed';
            this.ctx.beginPath();
            this.ctx.arc(this.width * 0.8, this.height * 0.15, 40, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (this.terrainType === 'snow') {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(this.width * 0.2, this.height * 0.2, 30, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawAtmosphere() {
        // Atmospheric particles based on terrain
        if (!this.atmosphereParticles) {
            this.atmosphereParticles = [];
            for (let i = 0; i < 30; i++) {
                this.atmosphereParticles.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    size: 1 + Math.random() * 3,
                    speed: 0.5 + Math.random()
                });
            }
        }

        const theme = this.themes[this.terrainType];

        this.atmosphereParticles.forEach(p => {
            // Update
            if (this.terrainType === 'snow') {
                p.y += p.speed;
                p.x += Math.sin(p.y * 0.01) * 0.5;
                if (p.y > this.height) {
                    p.y = 0;
                    p.x = Math.random() * this.width;
                }
            } else if (this.terrainType === 'desert') {
                p.x += p.speed * 2;
                if (p.x > this.width) {
                    p.x = 0;
                    p.y = Math.random() * this.height;
                }
            } else {
                p.y += p.speed * 0.5;
                p.x += Math.sin(p.y * 0.02) * 0.3;
                if (p.y > this.height) {
                    p.y = 0;
                    p.x = Math.random() * this.width;
                }
            }

            // Draw
            this.ctx.fillStyle = this.terrainType === 'snow' ?
                'rgba(255, 255, 255, 0.8)' :
                `rgba(255, 255, 255, 0.2)`;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawTerrain() {
        if (this.terrain.length < 2) return;

        const theme = this.themes[this.terrainType];

        // Ground fill
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.height);
        this.ctx.lineTo(this.terrain[0].x, this.terrain[0].y);

        for (let i = 1; i < this.terrain.length; i++) {
            this.ctx.lineTo(this.terrain[i].x, this.terrain[i].y);
        }

        this.ctx.lineTo(this.width, this.height);
        this.ctx.closePath();

        // Gradient fill
        const groundGradient = this.ctx.createLinearGradient(0, this.height * 0.3, 0, this.height);
        groundGradient.addColorStop(0, theme.ground);
        groundGradient.addColorStop(1, theme.groundDark);

        this.ctx.fillStyle = groundGradient;
        this.ctx.fill();

        // Top line
        this.ctx.strokeStyle = theme.groundDark;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(this.terrain[0].x, this.terrain[0].y);
        for (let i = 1; i < this.terrain.length; i++) {
            this.ctx.lineTo(this.terrain[i].x, this.terrain[i].y);
        }
        this.ctx.stroke();
    }

    drawTanks() {
        this.players.forEach(player => {
            if (!player.isAlive) return;

            const x = player.displayX;
            const y = player.displayY;
            const isCurrentTurn = this.players[this.currentTurn]?.id === player.id;
            const isMe = player.id === this.myPlayerId;

            this.ctx.save();
            this.ctx.translate(x, y);

            // Glow effect for current turn
            if (isCurrentTurn) {
                this.ctx.shadowColor = player.color;
                this.ctx.shadowBlur = 20;
            }

            // Tank body
            this.ctx.fillStyle = player.color;
            this.ctx.beginPath();
            this.ctx.roundRect(-20, -15, 40, 20, 5);
            this.ctx.fill();

            // Tank turret
            this.ctx.save();
            const angle = (player.angle * Math.PI) / 180;
            this.ctx.rotate(-angle + Math.PI);

            this.ctx.fillStyle = this.darkenColor(player.color, 20);
            this.ctx.fillRect(-4, 0, 8, 25);
            this.ctx.restore();

            // Tank dome
            this.ctx.fillStyle = this.darkenColor(player.color, 10);
            this.ctx.beginPath();
            this.ctx.arc(0, -10, 12, Math.PI, 0);
            this.ctx.fill();

            // Wheels
            this.ctx.fillStyle = '#333';
            for (let i = -15; i <= 15; i += 10) {
                this.ctx.beginPath();
                this.ctx.arc(i, 5, 6, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Health bar
            const healthPercent = player.health / player.maxHealth;
            const barWidth = 50;
            const barHeight = 6;

            // Background
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(-barWidth / 2, -40, barWidth, barHeight);

            // Health fill
            const healthColor = healthPercent > 0.5 ? '#10b981' :
                healthPercent > 0.25 ? '#f59e0b' : '#ef4444';
            this.ctx.fillStyle = healthColor;
            this.ctx.fillRect(-barWidth / 2, -40, barWidth * healthPercent, barHeight);

            // Border
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(-barWidth / 2, -40, barWidth, barHeight);

            // Player name
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 12px Rajdhani';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(player.name, 0, -48);

            // Shield indicator
            if (player.shield > 0) {
                this.ctx.strokeStyle = '#3b82f6';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(0, -5, 30, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            this.ctx.restore();
        });
    }

    updateProjectiles(delta) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            // Add to trail
            proj.trail.push({ x: proj.x, y: proj.y });
            if (proj.trail.length > 20) proj.trail.shift();

            // Physics
            proj.vx += proj.wind * delta;
            proj.vy += this.gravity * delta;
            proj.x += proj.vx * delta;
            proj.y += proj.vy * delta;

            // Draw trail
            this.ctx.beginPath();
            this.ctx.strokeStyle = proj.weapon === 'atom' ? '#ef4444' :
                proj.weapon === 'napalm' ? '#f97316' : '#fbbf24';
            this.ctx.lineWidth = 2;

            for (let j = 0; j < proj.trail.length; j++) {
                const t = proj.trail[j];
                if (j === 0) {
                    this.ctx.moveTo(t.x, t.y);
                } else {
                    this.ctx.lineTo(t.x, t.y);
                }
            }
            this.ctx.stroke();

            // Draw projectile
            this.ctx.fillStyle = proj.weapon === 'atom' ? '#ef4444' :
                proj.weapon === 'napalm' ? '#f97316' : '#fbbf24';
            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, proj.weapon === 'atom' ? 8 : 5, 0, Math.PI * 2);
            this.ctx.fill();

            // Check collision with terrain
            let hitTerrain = false;
            for (let j = 0; j < this.terrain.length - 1; j++) {
                const t1 = this.terrain[j];
                const t2 = this.terrain[j + 1];

                if (proj.x >= t1.x && proj.x <= t2.x) {
                    const terrainY = t1.y + ((proj.x - t1.x) / (t2.x - t1.x)) * (t2.y - t1.y);
                    if (proj.y >= terrainY) {
                        hitTerrain = true;
                        break;
                    }
                }
            }

            // Remove if out of bounds or hit terrain
            if (proj.x < 0 || proj.x > this.width || proj.y > this.height || hitTerrain) {
                // Emit hit event
                if (window.gameNetwork && hitTerrain) {
                    const gameX = (proj.x / this.width) * 1200;
                    const gameY = 600 - ((this.height - proj.y) / this.height) * 600;
                    window.gameNetwork.sendProjectileHit(gameX, gameY, proj.weapon);
                }
                this.projectiles.splice(i, 1);
            }
        }
    }

    updateExplosions(delta) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];

            // Expand
            exp.radius += (exp.maxRadius - exp.radius) * 0.2 * delta;

            // Fade
            if (exp.radius > exp.maxRadius * 0.8) {
                exp.alpha -= 0.05 * delta;
            }

            // Draw
            const gradient = this.ctx.createRadialGradient(
                exp.x, exp.y, 0,
                exp.x, exp.y, exp.radius
            );

            if (exp.weapon === 'atom') {
                gradient.addColorStop(0, `rgba(255, 255, 255, ${exp.alpha})`);
                gradient.addColorStop(0.2, `rgba(255, 200, 0, ${exp.alpha})`);
                gradient.addColorStop(0.6, `rgba(255, 100, 0, ${exp.alpha * 0.7})`);
                gradient.addColorStop(1, `rgba(255, 50, 0, 0)`);
            } else if (exp.weapon === 'napalm') {
                gradient.addColorStop(0, `rgba(255, 150, 0, ${exp.alpha})`);
                gradient.addColorStop(0.5, `rgba(255, 80, 0, ${exp.alpha * 0.6})`);
                gradient.addColorStop(1, `rgba(200, 50, 0, 0)`);
            } else {
                gradient.addColorStop(0, `rgba(255, 255, 200, ${exp.alpha})`);
                gradient.addColorStop(0.3, `rgba(255, 200, 100, ${exp.alpha * 0.8})`);
                gradient.addColorStop(1, `rgba(200, 100, 50, 0)`);
            }

            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Remove
            if (exp.alpha <= 0) {
                this.explosions.splice(i, 1);
            }
        }
    }

    updateParticles(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Physics
            p.vy += this.gravity * 0.5 * delta;
            p.x += p.vx * delta;
            p.y += p.vy * delta;
            p.life -= p.decay * delta;

            // Draw
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;

            // Remove
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
    }
}

// Export
window.TanksGame = TanksGame;
