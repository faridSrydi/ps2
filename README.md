# PS2 Cloud Gaming Platform 🎮☁️

Platform cloud gaming berbasis web yang memungkinkan pengguna memainkan game PlayStation 2 (PS2) langsung di browser tanpa perlu menginstall emulator. Server menjalankan PCSX2 headless di lingkungan Ubuntu Linux dengan akselerasi GPU NVIDIA L4, memancarkan video/audio stream berlatensi rendah (<50ms) menggunakan WebRTC, dan menerima kontrol input stik virtual dari smartphone melalui QR code & WebSocket.

---

## 🌟 Fitur Utama

- 🎮 **Zero Client Install**: Cukup buka browser (PC/Laptop/Tablet) untuk langsung bermain.
- ⚡ **Low Latency Streaming**: Menggunakan WebRTC + GStreamer dengan hardware video encoding NVIDIA NVENC (H.264).
- 📱 **Mobile Virtual Gamepad**: Scan QR Code di layar PC menggunakan smartphone untuk mengubah HP menjadi stik PS2 lengkap (D-Pad, Analog Kiri/Kanan, △ ○ ✕ □, L1/L2/R1/R2, Start, Select).
- 📁 **Automated Library Scanner**: Pindai folder `ps2/games` secara otomatis untuk membaca ISO/CHD/BIN, ekstraksi metadata serial code, dan penataan sampul.
- 💾 **Save States & Screenshots**: Simpan progres game dan tangkapan layar langsung ke server per pengguna.
- 🛡️ **Keamanan & Autentikasi**: Proteksi JWT, Rate Limiting, CORS, Hashing Password bcrypt, dan mode Guest instan.
- 📊 **Monitoring Telemetri Realtime**: Admin panel untuk memantau performa CPU, GPU NVIDIA L4, VRAM, RAM, Sesi aktif, dan manajemen pengguna.

---

## 🏗️ Folder Structure

```
ps2/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── README.md
├── nginx/
│   └── nginx.conf
├── systemd/
│   └── ps2-cloud.service
├── scripts/
│   ├── setup.sh
│   ├── deploy.sh
│   └── scan-library.sh
│
├── server/                          # Node.js + Express Backend
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma            # PostgreSQL Database Schema
│   └── src/
│       ├── index.js                 # Entry Point
│       ├── config/                  # Env & Database Config
│       ├── controllers/             # Auth, Games, Session, Admin, Profile, Saves, Favorites
│       ├── middleware/              # Auth JWT, RateLimiter, Validation
│       ├── routes/                  # REST API Endpoints
│       ├── services/                # Emulator, Streaming, Library, Controller, Monitoring
│       ├── socket/                  # WebRTC Signaling, Controller WS, Monitoring WS
│       └── utils/                   # RoomID, QRCode, Logger
│
├── client/                          # React + Vite + Tailwind Frontend
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx                  # Main Router
│       ├── components/              # GameGrid, GameCard, StreamPlayer, QRCodeModal, SessionControls, Navbar
│       ├── pages/                   # Home, Library, GamePage, PlaySession, Profile, Settings, Login, Register
│       ├── pages/admin/             # AdminDashboard, AdminLibrary, AdminUsers, AdminSessions
│       ├── services/api.js          # Axios API Client
│       └── context/AuthContext.jsx  # Auth State Provider
│
├── controller/                      # Mobile Virtual Gamepad Web App
│   ├── index.html
│   ├── controller.css
│   └── controller.js
│
├── games/                           # PS2 ISO/CHD Games Directory (or ps2/games)
├── bios/                            # PS2 BIOS files (scph10000.bin, etc.)
├── saves/                           # Saved game states per user
├── covers/                          # Cover images
├── screenshots/                     # User screenshots
├── config/                          # PCSX2 configurations
├── logs/                            # App and error logs
└── storage/                         # Avatars and static storage
```

---

## ⚡ Panduan Instalasi & Deploy

### Requirements
- OS: Ubuntu 24.04 LTS (atau sejenis)
- GPU: NVIDIA L4 / T4 / RTX series (NVIDIA Container Toolkit terpasang)
- Memory: 16GB - 64GB RAM
- Dependensi: Docker & Docker Compose

### Step 1: Clone Repository & Setup Folder
```bash
cd /opt/ps2
bash scripts/setup.sh
```

### Step 2: Sediakan BIOS & Game
Letakkan file BIOS PS2 di folder `bios/` dan file game ISO di `games/ps2/`:
```bash
# Contoh download ISO via wget
wget -c --tries=0 -P games/ps2/ https://your-server.com/game.iso
```

### Step 3: Deploy via Docker
```bash
bash scripts/deploy.sh
```
Akses platform melalui browser di `http://IP_SERVER_ANDA`.

---

## 📄 REST API Endpoint

| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/api/auth/register` | Pendaftaran akun baru |
| `POST` | `/api/auth/login` | Login user -> JWT Access Token |
| `POST` | `/api/auth/guest` | Login instan sebagai Guest |
| `GET` | `/api/games` | Mengambil daftar game library |
| `GET` | `/api/games/:id` | Detail spesifik game |
| `POST` | `/api/games/rescan` | Pindai ulang folder game (Admin) |
| `POST` | `/api/sessions` | Membuat sesi cloud baru (Play Game) |
| `GET` | `/api/sessions/:id` | Mengambil status sesi & Room ID / QR |
| `POST` | `/api/sessions/:id/pause` | Jeda (Pause) emulator |
| `POST` | `/api/sessions/:id/resume` | Lanjutkan (Resume) emulator |
| `POST` | `/api/sessions/:id/save` | Simpan Save State |
| `DELETE` | `/api/sessions/:id` | Hentikan & hapus sesi game |
| `GET` | `/api/admin/dashboard` | Telemetri sistem & status GPU realtime |
