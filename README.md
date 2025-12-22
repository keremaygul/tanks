# 🎮 Tanks Arena

A modern, multiplayer artillery game inspired by classic Flash tank games. Battle against friends in turn-based tank combat with destructible terrain, special weapons, and strategic gameplay.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

---

## 🚀 Features

### Gameplay
- **Turn-based Combat** - Strategic artillery gameplay with angle and power controls
- **2-4 Player Multiplayer** - Real-time multiplayer battles via WebSocket
- **Destructible Terrain** - Explosions modify the battlefield
- **4 Unique Maps** - Desert, Jungle, Mountain, and Snow terrains that cycle each round
- **Random Spawn System** - Fair player positioning with minimum distance spacing

### Weapons & Upgrades
- **Normal Shot** - Unlimited standard ammunition
- **Triple Shot** - Fires 3 projectiles with spread
- **Atom Bomb** - Massive explosion radius
- **Napalm** - Area damage with lingering effects
- **Armor & Shield** - Defensive upgrades available in the shop

### Economy System
- **Hit Rewards** - Earn 25 gold per successful hit
- **Round Bonuses** - Winners receive extra gold
- **In-game Shop** - Purchase weapons and upgrades between rounds

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | Server runtime |
| **Express** | HTTP server |
| **Socket.IO** | Real-time WebSocket communication |
| **HTML5 Canvas** | Game rendering |
| **Vanilla CSS** | Responsive styling with glassmorphism design |
| **JavaScript** | Client & server game logic |

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/keremaygul/tanks.git

# Navigate to project directory
cd tanks

# Install dependencies
npm install

# Start the server
npm start
```

The game will be available at `http://localhost:3000`

---

## 🎯 How to Play

1. **Create or Join** a room from the lobby
2. **Aim** by adjusting the angle (0° = left, 90° = up, 180° = right)
3. **Set Power** to control projectile distance
4. **Fire** and watch the trajectory
5. **Move** your tank using fuel (limited per turn)
6. **Shop** between rounds for weapons and upgrades
7. **Win** by being the last tank standing!

### Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Aim | Arrow Up/Down or W/S | Angle Slider |
| Move | Arrow Left/Right or A/D | Movement Buttons |
| Fire | Spacebar | Fire Button |
| Select Weapon | 1-4 Keys | Weapon Panel |

---

## 🖥️ Screenshots

The game features a modern glassmorphism UI with:
- Real-time HUD showing health, fuel, armor, and money
- Touch-friendly controls optimized for mobile
- Smooth projectile physics with trail effects
- Dynamic explosions and particle effects

---

## 🌐 Deployment

The game is designed to be easily deployed on platforms like:
- **Render.com** (recommended)
- **Heroku**
- **Railway**
- Any Node.js hosting service

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/keremaygul/tanks/issues).

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/keremaygul">keremaygul</a>
</p>
