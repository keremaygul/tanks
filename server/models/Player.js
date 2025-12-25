const WEAPONS = {
    normal: { name: 'Normal Shot', price: 0, damage: 25, radius: 35, count: -1 },
    triple: { name: 'Triple Shot', price: 100, damage: 18, radius: 28, count: 3 },
    atom: { name: 'Atom Bomb', price: 300, damage: 75, radius: 120, count: 1 },
    splash: { name: 'Splash Bomb', price: 150, damage: 30, radius: 80, count: 2 },
    sniper: { name: 'Sniper Shot', price: 120, damage: 50, radius: 20, count: 2 },
    cluster: { name: 'Cluster Bomb', price: 250, damage: 20, radius: 40, count: 2, splits: 5 }
};

const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

class Player {
    constructor(id, name, roomId, colorIndex, customColor = null) {
        this.id = id;
        this.name = name;
        this.roomId = roomId;
        this.color = customColor || PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];

        // Stats
        this.health = 100;
        this.maxHealth = 100;
        this.fuel = 60;
        this.maxFuel = 60;
        this.money = 100;

        // Defense
        this.armor = 0;
        this.shield = 0;

        // Position
        this.x = 0;
        this.y = 0;
        this.angle = 45;
        this.power = 50;

        // State
        this.isAlive = true;
        this.ready = false;

        // Weapons
        this.weapons = {
            normal: { count: -1 },
            triple: { count: 0 },
            atom: { count: 0 },
            splash: { count: 0 },
            sniper: { count: 0 },
            cluster: { count: 0 }
        };
        this.currentWeapon = 'normal';
    }

    resetForRound(moneyBonus = 75) {
        this.ready = false;
        // Don't reset health/fuel fully if we want persistence, but for now classic rules:
        // Actually usually health carries over? Let's keep health but reset fuel.
        // The original code reset everything in positionPlayers. Let's keep it consistent.
        // Wait, original positionPlayers resets health to maxHealth. 
        this.fuel = this.maxFuel;
        this.money += moneyBonus;
    }
}

module.exports = { Player, WEAPONS };
