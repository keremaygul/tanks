// =====================================================
// TANKS ARENA - Game Engine v2.0
// Complete rewrite with proper physics
// =====================================================

class TanksGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Game dimensions (fixed game world size)
        this.gameWidth = 1200;
        this.gameHeight = 600;

        // Scale factors for rendering
        this.scaleX = 1;
        this.scaleY = 1;

        // Game state
        this.terrain = []; // Array of Y heights for each X position
        this.terrainPath = []; // For drawing
        this.players = [];
        this.projectiles = [];
        this.explosions = [];
        this.particles = [];

        this.currentTurn = 0;
        this.myPlayerId = null;

        this.terrainType = 'desert';
        this.round = 1;

        // Physics constants
        this.gravity = 0.25;

        // Animation
        this.animationId = null;
        this.lastTime = 0;

        // Screen shake
        this.screenShake = 0;

        // Theme colors
        this.themes = {
            desert: {
                sky: ['#1a0a00', '#f97316', '#fbbf24'],
                ground: '#c2956e',
                groundDark: '#8b6914',
                accent: '#fbbf24',
                particles: ['#fbbf24', '#f97316', '#c2956e']
            },
            jungle: {
                sky: ['#001a0a', '#0ea5e9', '#34d399'],
                ground: '#2d5a3d',
                groundDark: '#1a3d26',
                accent: '#34d399',
                particles: ['#34d399', '#4a7c59', '#2d5a3d']
            },
            mountain: {
                sky: ['#0a0a1a', '#1e3a5f', '#3b82f6'],
                ground: '#4b5563',
                groundDark: '#374151',
                accent: '#60a5fa',
                particles: ['#9ca3af', '#6b7280', '#4b5563']
            },
            snow: {
                sky: ['#1a1a2e', '#475569', '#94a3b8'],
                ground: '#e5e7eb',
                groundDark: '#9ca3af',
                accent: '#f0f9ff',
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
        // Use fixed internal resolution for crisp rendering
        // The canvas internal size stays constant, CSS handles display scaling

        // Set fixed canvas resolution (game world size)
        this.canvas.width = this.gameWidth;
        this.canvas.height = this.gameHeight;

        // Calculate display size
        const statusBar = document.getElementById('status-bar');
        const gameHud = document.getElementById('game-hud');
        const weaponPanel = document.querySelector('.weapon-panel');
        const controlsPanel = document.getElementById('controls-panel');

        const usedHeight = (statusBar?.offsetHeight || 0) +
            (gameHud?.offsetHeight || 0) +
            (weaponPanel?.offsetHeight || 0) +
            (controlsPanel?.offsetHeight || 0);

        const availableWidth = window.innerWidth;
        const availableHeight = window.innerHeight - usedHeight;

        // Maintain aspect ratio (2:1)
        const aspectRatio = this.gameWidth / this.gameHeight;

        let displayWidth, displayHeight;

        if (availableWidth / availableHeight > aspectRatio) {
            // Height constrained
            displayHeight = Math.max(150, availableHeight);
            displayWidth = displayHeight * aspectRatio;
        } else {
            // Width constrained
            displayWidth = availableWidth;
            displayHeight = displayWidth / aspectRatio;
        }

        // Set CSS size for display (this scales the fixed resolution canvas)
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';

        // Scale factors are now 1:1 since canvas resolution equals game world
        this.scaleX = 1;
        this.scaleY = 1;

        // Enable crisp pixel rendering
        this.ctx.imageSmoothingEnabled = false;
    }

    // Convert game coordinates to canvas coordinates
    toCanvasX(gameX) {
        return gameX * this.scaleX;
    }

    toCanvasY(gameY) {
        return gameY * this.scaleY;
    }

    // Convert canvas coordinates to game coordinates
    toGameX(canvasX) {
        return canvasX / this.scaleX;
    }

    toGameY(canvasY) {
        return canvasY / this.scaleY;
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

    // Generate proper terrain with heights array
    generateTerrain(type) {
        this.terrainType = type;
        this.terrain = new Array(this.gameWidth).fill(0);
        this.terrainPath = [];

        // Base height (from bottom)
        const baseHeight = 200;

        // Terrain parameters based on type
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

        // Generate smooth terrain using multiple sine waves
        for (let x = 0; x < this.gameWidth; x++) {
            const noise1 = Math.sin(x * frequency) * amplitude;
            const noise2 = Math.sin(x * frequency * 2.5) * (amplitude * 0.4);
            const noise3 = Math.sin(x * frequency * 0.5) * (amplitude * 0.3);

            // Height from bottom of screen
            const height = baseHeight + noise1 + noise2 + noise3;

            // Store as Y coordinate from top (gameHeight - height)
            this.terrain[x] = this.gameHeight - height;

            // Store path points for drawing (every 10 pixels)
            if (x % 10 === 0) {
                this.terrainPath.push({ x, y: this.terrain[x] });
            }
        }

        // Ensure last point is added
        this.terrainPath.push({
            x: this.gameWidth - 1,
            y: this.terrain[this.gameWidth - 1]
        });
    }

    // Get terrain height at any X position
    getTerrainHeight(x) {
        const ix = Math.floor(Math.max(0, Math.min(this.gameWidth - 1, x)));
        return this.terrain[ix];
    }

    setTerrain(points, type) {
        this.terrainType = type;

        // If points provided from server, use them
        if (points && points.length > 0) {
            this.terrain = new Array(this.gameWidth).fill(0);
            this.terrainPath = [];

            // Interpolate points to fill terrain array
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];

                for (let x = Math.floor(p1.x); x < Math.floor(p2.x); x++) {
                    const t = (x - p1.x) / (p2.x - p1.x);
                    this.terrain[x] = p1.y + t * (p2.y - p1.y);
                }

                this.terrainPath.push({ x: p1.x, y: p1.y });
            }

            // Add last point
            const lastPoint = points[points.length - 1];
            this.terrainPath.push({ x: lastPoint.x, y: lastPoint.y });
        } else {
            // Generate new terrain
            this.generateTerrain(type);
        }
    }

    setPlayers(players) {
        this.players = players.map(p => ({
            ...p,
            // Ensure Y is on terrain
            y: this.getTerrainHeight(p.x)
        }));
    }

    updatePlayer(playerId, data) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            if (data.x !== undefined) {
                player.x = data.x;
                player.y = this.getTerrainHeight(data.x);
            }
            Object.assign(player, data);
        }
    }

    fireProjectile(data) {
        const { startX, startY, angle, velocity, weapon, playerId } = data;

        // Convert server's radians back to UI degrees (same as drawTanks)
        const uiAngleDegrees = (angle * 180) / Math.PI;
        const clampedAngle = Math.max(0, Math.min(180, uiAngleDegrees));

        // EXACT same formula as barrel drawing in drawTanks:
        // barrelRotation = (clampedAngle - 90) * PI / 180
        // At 0° (left): rotation = -90° = -PI/2
        // At 90° (up): rotation = 0°
        // At 180° (right): rotation = 90° = PI/2
        const barrelRotation = (clampedAngle - 90) * Math.PI / 180;

        // Direction vector: barrel points UP before rotation
        // After rotating, direction is (sin(rotation), -cos(rotation))
        // This matches how canvas rotate() works
        const dirX = Math.sin(barrelRotation);
        const dirY = -Math.cos(barrelRotation);

        // Barrel tip position (36px from turret center)
        const barrelLength = 36;
        const tipX = startX + dirX * barrelLength;
        const tipY = startY - 18 + dirY * barrelLength;  // -18 is turret center offset

        // Check if this is my projectile
        const isMyProjectile = playerId === this.myPlayerId;

        // For triple shot, create spread
        const projectileCount = weapon === 'triple' ? 3 : 1;
        const spreadAngle = 0.12; // radians spread between projectiles

        for (let i = 0; i < projectileCount; i++) {
            // Calculate spread for triple shot
            const spreadOffset = (i - Math.floor(projectileCount / 2)) * spreadAngle;
            const rotatedAngle = barrelRotation + spreadOffset;

            // Final direction with spread applied
            const finalDirX = Math.sin(rotatedAngle);
            const finalDirY = -Math.cos(rotatedAngle);

            this.projectiles.push({
                x: tipX,
                y: tipY,
                vx: finalDirX * velocity,
                vy: finalDirY * velocity,
                weapon,
                trail: [],
                active: true,
                isMyProjectile
            });
        }
    }

    createExplosion(x, y, radius, weapon) {
        this.explosions.push({
            x,
            y,
            radius: 0,
            maxRadius: radius,
            alpha: 1,
            weapon,
            phase: 'expand'
        });

        // Create particles
        const particleCount = weapon === 'atom' ? 60 : 25;
        const theme = this.themes[this.terrainType];

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
            const speed = 3 + Math.random() * 6;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 3,
                life: 1,
                decay: 0.015 + Math.random() * 0.02,
                size: 4 + Math.random() * 6,
                color: weapon === 'napalm' ?
                    ['#ff6b00', '#ff3300', '#ffaa00'][Math.floor(Math.random() * 3)] :
                    weapon === 'atom' ?
                        ['#ffffff', '#ffff00', '#ff6600'][Math.floor(Math.random() * 3)] :
                        theme.particles[Math.floor(Math.random() * theme.particles.length)]
            });
        }

        // Debris particles
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: -Math.abs(Math.sin(angle) * speed) - 2,
                life: 1,
                decay: 0.01 + Math.random() * 0.01,
                size: 3 + Math.random() * 4,
                color: theme.groundDark,
                isDebris: true
            });
        }

        // Screen shake based on weapon
        this.screenShake = weapon === 'atom' ? 25 : weapon === 'napalm' ? 15 : 10;
    }

    render(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        const delta = Math.min(deltaTime / 16.67, 3); // Cap at 3x speed
        this.lastTime = currentTime;

        // Clear canvas
        this.ctx.save();

        // Apply screen shake
        if (this.screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShake * this.scaleX;
            const shakeY = (Math.random() - 0.5) * this.screenShake * this.scaleY;
            this.ctx.translate(shakeX, shakeY);
            this.screenShake *= 0.9;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        // Draw layers
        this.drawSky();
        this.drawAtmosphere(delta);
        this.drawTerrain();
        this.updateAndDrawProjectiles(delta);
        this.drawTanks();
        this.updateAndDrawExplosions(delta);
        this.updateAndDrawParticles(delta);


        this.ctx.restore();

        this.animationId = requestAnimationFrame(this.render);
    }

    drawSky() {
        const theme = this.themes[this.terrainType];
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);

        gradient.addColorStop(0, theme.sky[0]);
        gradient.addColorStop(0.4, theme.sky[1]);
        gradient.addColorStop(1, theme.sky[2]);

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw celestial body
        const sunX = this.toCanvasX(1000);
        const sunY = this.toCanvasY(80);
        const sunRadius = 35 * this.scaleX;

        if (this.terrainType === 'desert') {
            // Bright sun
            const sunGradient = this.ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 2);
            sunGradient.addColorStop(0, '#ffffff');
            sunGradient.addColorStop(0.3, '#fff7ed');
            sunGradient.addColorStop(1, 'rgba(255, 247, 237, 0)');
            this.ctx.fillStyle = sunGradient;
            this.ctx.beginPath();
            this.ctx.arc(sunX, sunY, sunRadius * 2, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (this.terrainType === 'snow') {
            // Pale sun through clouds
            const moonGradient = this.ctx.createRadialGradient(sunX - 200, sunY + 20, 0, sunX - 200, sunY + 20, sunRadius);
            moonGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            moonGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            this.ctx.fillStyle = moonGradient;
            this.ctx.beginPath();
            this.ctx.arc(sunX - 200, sunY + 20, sunRadius, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawAtmosphere(delta) {
        if (!this.atmosphereParticles) {
            this.atmosphereParticles = [];
            const count = this.terrainType === 'snow' ? 50 : 20;
            for (let i = 0; i < count; i++) {
                this.atmosphereParticles.push({
                    x: Math.random() * this.gameWidth,
                    y: Math.random() * this.gameHeight,
                    size: 1 + Math.random() * 3,
                    speed: 0.5 + Math.random() * 1.5,
                    wobble: Math.random() * Math.PI * 2
                });
            }
        }

        this.atmosphereParticles.forEach(p => {
            // Update position based on terrain type
            if (this.terrainType === 'snow') {
                p.y += p.speed * delta;
                p.wobble += 0.02 * delta;
                p.x += Math.sin(p.wobble) * 0.5 * delta;
                if (p.y > this.gameHeight) {
                    p.y = -10;
                    p.x = Math.random() * this.gameWidth;
                }
            } else if (this.terrainType === 'desert') {
                p.x += p.speed * 3 * delta;
                p.y += Math.sin(p.wobble) * 0.3 * delta;
                p.wobble += 0.01 * delta;
                if (p.x > this.gameWidth) {
                    p.x = -10;
                    p.y = Math.random() * this.gameHeight * 0.7;
                }
            } else {
                p.y += p.speed * 0.5 * delta;
                p.x += Math.sin(p.wobble) * 0.2 * delta;
                p.wobble += 0.015 * delta;
                if (p.y > this.gameHeight) {
                    p.y = -10;
                    p.x = Math.random() * this.gameWidth;
                }
            }

            // Draw
            const opacity = this.terrainType === 'snow' ? 0.9 : 0.4;
            this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            this.ctx.beginPath();
            this.ctx.arc(
                this.toCanvasX(p.x),
                this.toCanvasY(p.y),
                p.size * this.scaleX,
                0, Math.PI * 2
            );
            this.ctx.fill();
        });
    }

    drawTerrain() {
        if (this.terrainPath.length < 2) return;

        const theme = this.themes[this.terrainType];

        // Create gradient for ground
        const groundGradient = this.ctx.createLinearGradient(
            0, this.toCanvasY(this.gameHeight - 250),
            0, this.canvas.height
        );
        groundGradient.addColorStop(0, theme.ground);
        groundGradient.addColorStop(0.5, theme.groundDark);
        groundGradient.addColorStop(1, theme.groundDark);

        // Draw filled terrain
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.canvas.height);
        this.ctx.lineTo(this.toCanvasX(this.terrainPath[0].x), this.toCanvasY(this.terrainPath[0].y));

        for (let i = 1; i < this.terrainPath.length; i++) {
            this.ctx.lineTo(
                this.toCanvasX(this.terrainPath[i].x),
                this.toCanvasY(this.terrainPath[i].y)
            );
        }

        this.ctx.lineTo(this.canvas.width, this.canvas.height);
        this.ctx.closePath();

        this.ctx.fillStyle = groundGradient;
        this.ctx.fill();

        // Draw terrain edge/grass line
        this.ctx.beginPath();
        this.ctx.moveTo(this.toCanvasX(this.terrainPath[0].x), this.toCanvasY(this.terrainPath[0].y));

        for (let i = 1; i < this.terrainPath.length; i++) {
            this.ctx.lineTo(
                this.toCanvasX(this.terrainPath[i].x),
                this.toCanvasY(this.terrainPath[i].y)
            );
        }

        this.ctx.strokeStyle = theme.accent;
        this.ctx.lineWidth = 3 * this.scaleX;
        this.ctx.stroke();

        // Add texture details
        if (this.terrainType === 'jungle') {
            this.drawGrassDetails();
        }
    }

    drawGrassDetails() {
        this.ctx.strokeStyle = '#34d399';
        this.ctx.lineWidth = 1;

        for (let x = 20; x < this.gameWidth; x += 30) {
            const y = this.getTerrainHeight(x);
            const grassHeight = 5 + Math.random() * 8;

            this.ctx.beginPath();
            this.ctx.moveTo(this.toCanvasX(x), this.toCanvasY(y));
            this.ctx.lineTo(
                this.toCanvasX(x + (Math.random() - 0.5) * 6),
                this.toCanvasY(y - grassHeight)
            );
            this.ctx.stroke();
        }
    }

    drawTanks() {
        this.players.forEach((player, index) => {
            if (!player.isAlive) return;

            const x = this.toCanvasX(player.x);
            const y = this.toCanvasY(this.getTerrainHeight(player.x));
            const isCurrentTurn = this.currentTurn === index;
            const isMe = player.id === this.myPlayerId;

            this.ctx.save();
            this.ctx.translate(x, y);

            // Calculate terrain angle for tank tilt
            const leftHeight = this.getTerrainHeight(player.x - 15);
            const rightHeight = this.getTerrainHeight(player.x + 15);
            const terrainAngle = Math.atan2(rightHeight - leftHeight, 30);

            this.ctx.rotate(terrainAngle);

            // Glow effect for current turn
            if (isCurrentTurn) {
                this.ctx.shadowColor = player.color;
                this.ctx.shadowBlur = 20 * this.scaleX;
            }

            const tankScale = this.scaleX;

            // Tank tracks
            this.ctx.fillStyle = '#1f1f1f';
            this.ctx.beginPath();
            this.ctx.roundRect(-22 * tankScale, -5 * tankScale, 44 * tankScale, 14 * tankScale, 4 * tankScale);
            this.ctx.fill();

            // Tank body
            this.ctx.fillStyle = player.color;
            this.ctx.beginPath();
            this.ctx.roundRect(-20 * tankScale, -18 * tankScale, 40 * tankScale, 18 * tankScale, 5 * tankScale);
            this.ctx.fill();

            // Tank body highlight
            this.ctx.fillStyle = this.lightenColor(player.color, 20);
            this.ctx.beginPath();
            this.ctx.roundRect(-18 * tankScale, -16 * tankScale, 36 * tankScale, 6 * tankScale, 3 * tankScale);
            this.ctx.fill();

            // Tank turret dome
            this.ctx.fillStyle = this.darkenColor(player.color, 10);
            this.ctx.beginPath();
            this.ctx.arc(0, -18 * tankScale, 12 * tankScale, Math.PI, 0);
            this.ctx.fill();

            // Draw barrel with correct angle system:
            // UI angle: 0° = horizontal left, 90° = straight up, 180° = horizontal right
            // We need to convert this to canvas rotation
            // Barrel is drawn pointing UP by default, so we rotate from there

            const playerAngle = player.angle !== undefined ? player.angle : 45;
            // Clamp angle to valid range (0-180, only above ground)
            const clampedAngle = Math.max(0, Math.min(180, playerAngle));

            // Convert to radians: 0° should point left (-X), 90° up (-Y), 180° right (+X)
            // Barrel default is pointing up (negative Y axis)
            // Rotation: 90° angle = no rotation (pointing up)
            // 0° angle = rotate -90° (pointing left)
            // 180° angle = rotate +90° (pointing right)
            const barrelRotation = (clampedAngle - 90) * Math.PI / 180;

            this.ctx.save();
            this.ctx.translate(0, -18 * tankScale); // Move to turret center
            this.ctx.rotate(barrelRotation);

            // Barrel body (pointing up from rotation point)
            this.ctx.fillStyle = this.darkenColor(player.color, 25);
            this.ctx.beginPath();
            this.ctx.roundRect(-3 * tankScale, 0, 6 * tankScale, -30 * tankScale, 2 * tankScale);
            this.ctx.fill();

            // Barrel tip
            this.ctx.fillStyle = '#444';
            this.ctx.beginPath();
            this.ctx.roundRect(-4 * tankScale, -30 * tankScale, 8 * tankScale, -6 * tankScale, 2 * tankScale);
            this.ctx.fill();

            this.ctx.restore();

            // Wheels
            this.ctx.fillStyle = '#2d2d2d';
            for (let wx = -15; wx <= 15; wx += 10) {
                this.ctx.beginPath();
                this.ctx.arc(wx * tankScale, 2 * tankScale, 5 * tankScale, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();

            // Draw health bar and name (not rotated)
            this.drawPlayerUI(player, x, y - 55 * this.scaleY, isCurrentTurn);
        });
    }

    drawPlayerUI(player, x, y, isCurrentTurn) {
        const barWidth = 60 * this.scaleX;
        const barHeight = 8 * this.scaleY;

        // Name background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.beginPath();
        this.ctx.roundRect(x - barWidth / 2 - 5, y - 25 * this.scaleY, barWidth + 10, 18 * this.scaleY, 4);
        this.ctx.fill();

        // Player name
        this.ctx.fillStyle = isCurrentTurn ? '#fbbf24' : '#ffffff';
        this.ctx.font = `bold ${12 * this.scaleX}px Rajdhani`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(player.name, x, y - 12 * this.scaleY);

        // Health bar background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.beginPath();
        this.ctx.roundRect(x - barWidth / 2, y, barWidth, barHeight, 3);
        this.ctx.fill();

        // Health bar fill
        const healthPercent = Math.max(0, player.health / (player.maxHealth || 100));
        const healthColor = healthPercent > 0.6 ? '#10b981' :
            healthPercent > 0.3 ? '#f59e0b' : '#ef4444';

        if (healthPercent > 0) {
            this.ctx.fillStyle = healthColor;
            this.ctx.beginPath();
            this.ctx.roundRect(x - barWidth / 2 + 2, y + 2, (barWidth - 4) * healthPercent, barHeight - 4, 2);
            this.ctx.fill();
        }

        // Health text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${9 * this.scaleX}px Orbitron`;
        this.ctx.fillText(`${Math.ceil(player.health)}`, x, y + barHeight - 1 * this.scaleY);

        // Shield indicator
        if (player.shield > 0) {
            this.ctx.strokeStyle = '#3b82f6';
            this.ctx.lineWidth = 3 * this.scaleX;
            this.ctx.setLineDash([5, 3]);
            this.ctx.beginPath();
            this.ctx.arc(x, y + 30 * this.scaleY, 35 * this.scaleX, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }

    updateAndDrawProjectiles(delta) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            if (!proj.active) continue;

            // Store trail
            proj.trail.push({ x: proj.x, y: proj.y });
            if (proj.trail.length > 25) proj.trail.shift();

            // Physics update

            proj.vy += this.gravity * delta;
            proj.x += proj.vx * delta;
            proj.y += proj.vy * delta;

            // Draw trail
            if (proj.trail.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.toCanvasX(proj.trail[0].x), this.toCanvasY(proj.trail[0].y));

                for (let j = 1; j < proj.trail.length; j++) {
                    this.ctx.lineTo(this.toCanvasX(proj.trail[j].x), this.toCanvasY(proj.trail[j].y));
                }

                this.ctx.strokeStyle = proj.weapon === 'atom' ? '#ff4444' :
                    proj.weapon === 'napalm' ? '#ff8800' :
                        proj.weapon === 'triple' ? '#44ff44' : '#ffcc00';
                this.ctx.lineWidth = 3 * this.scaleX;
                this.ctx.lineCap = 'round';
                this.ctx.stroke();
            }

            // Draw projectile
            const projSize = (proj.weapon === 'atom' ? 10 : 6) * this.scaleX;
            const projGradient = this.ctx.createRadialGradient(
                this.toCanvasX(proj.x), this.toCanvasY(proj.y), 0,
                this.toCanvasX(proj.x), this.toCanvasY(proj.y), projSize
            );

            if (proj.weapon === 'atom') {
                projGradient.addColorStop(0, '#ffffff');
                projGradient.addColorStop(0.5, '#ff4444');
                projGradient.addColorStop(1, '#aa0000');
            } else if (proj.weapon === 'napalm') {
                projGradient.addColorStop(0, '#ffff00');
                projGradient.addColorStop(0.5, '#ff8800');
                projGradient.addColorStop(1, '#ff4400');
            } else {
                projGradient.addColorStop(0, '#ffffff');
                projGradient.addColorStop(0.5, '#ffdd00');
                projGradient.addColorStop(1, '#ff8800');
            }

            this.ctx.fillStyle = projGradient;
            this.ctx.beginPath();
            this.ctx.arc(this.toCanvasX(proj.x), this.toCanvasY(proj.y), projSize, 0, Math.PI * 2);
            this.ctx.fill();

            // Check collision with terrain or players
            const terrainY = this.getTerrainHeight(proj.x);
            const hitTerrain = proj.y >= terrainY;

            // Out of bounds: left, right, or too far down
            const outOfBounds = proj.x < -50 || proj.x > this.gameWidth + 50 || proj.y > this.gameHeight + 100;

            // Also check if projectile went way up and is coming back down but taking too long
            const tooHigh = proj.y < -500;

            if (hitTerrain || outOfBounds || tooHigh) {
                proj.active = false;

                // Only the player who fired should send hit to server
                // This prevents duplicate turn changes from multiple clients
                if (proj.isMyProjectile && window.gameNetwork) {
                    if (hitTerrain) {
                        window.gameNetwork.sendProjectileHit(proj.x, terrainY, proj.weapon);
                    } else {
                        // Out of bounds - send miss (hit at position away from everyone)
                        window.gameNetwork.sendProjectileHit(-1000, -1000, proj.weapon);
                    }
                }

                this.projectiles.splice(i, 1);
            }
        }
    }

    updateAndDrawExplosions(delta) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];

            // Update based on phase
            if (exp.phase === 'expand') {
                exp.radius += (exp.maxRadius * 1.2 - exp.radius) * 0.15 * delta;
                if (exp.radius >= exp.maxRadius) {
                    exp.phase = 'fade';
                }
            } else {
                exp.alpha -= 0.04 * delta;
            }

            // Draw explosion
            const x = this.toCanvasX(exp.x);
            const y = this.toCanvasY(exp.y);
            const radius = exp.radius * this.scaleX;

            // Outer glow
            const glowGradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius * 1.5);

            if (exp.weapon === 'atom') {
                glowGradient.addColorStop(0, `rgba(255, 255, 255, ${exp.alpha})`);
                glowGradient.addColorStop(0.2, `rgba(255, 255, 0, ${exp.alpha * 0.8})`);
                glowGradient.addColorStop(0.5, `rgba(255, 100, 0, ${exp.alpha * 0.5})`);
                glowGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            } else if (exp.weapon === 'napalm') {
                glowGradient.addColorStop(0, `rgba(255, 200, 0, ${exp.alpha})`);
                glowGradient.addColorStop(0.4, `rgba(255, 100, 0, ${exp.alpha * 0.7})`);
                glowGradient.addColorStop(1, 'rgba(200, 50, 0, 0)');
            } else {
                glowGradient.addColorStop(0, `rgba(255, 255, 220, ${exp.alpha})`);
                glowGradient.addColorStop(0.3, `rgba(255, 200, 100, ${exp.alpha * 0.7})`);
                glowGradient.addColorStop(1, 'rgba(200, 100, 50, 0)');
            }

            this.ctx.fillStyle = glowGradient;
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
            this.ctx.fill();

            // Inner core
            const coreGradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius * 0.6);
            coreGradient.addColorStop(0, `rgba(255, 255, 255, ${exp.alpha})`);
            coreGradient.addColorStop(1, `rgba(255, 255, 200, 0)`);

            this.ctx.fillStyle = coreGradient;
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
            this.ctx.fill();

            // Remove when faded
            if (exp.alpha <= 0) {
                this.explosions.splice(i, 1);
            }
        }
    }

    updateAndDrawParticles(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Physics
            if (p.isDebris) {
                p.vy += this.gravity * 0.8 * delta;
            } else {
                p.vy += this.gravity * 0.3 * delta;
            }

            p.x += p.vx * delta;
            p.y += p.vy * delta;
            p.vx *= 0.99;
            p.life -= p.decay * delta;

            // Bounce on terrain for debris
            if (p.isDebris) {
                const terrainY = this.getTerrainHeight(p.x);
                if (p.y >= terrainY) {
                    p.y = terrainY;
                    p.vy *= -0.3;
                    p.vx *= 0.7;
                }
            }

            // Draw
            if (p.life > 0) {
                this.ctx.globalAlpha = Math.min(1, p.life);
                this.ctx.fillStyle = p.color;
                const size = p.size * p.life * this.scaleX;
                this.ctx.beginPath();
                this.ctx.arc(this.toCanvasX(p.x), this.toCanvasY(p.y), size, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.globalAlpha = 1;
            }

            // Remove dead particles
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }



    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
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
