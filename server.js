const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const moment = require("moment-timezone");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===== storage uploads =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + Math.floor(Math.random()*10000) + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5*1024*1024 } });

// ===== data =====
let chatData = [];           // { userId, name, text, image, time, timestamp }
let userNames = {};          // userId -> name (set-once)
let lastClear = {};          // userId -> timestamp
let onlineUsers = {};        // userId -> { name, lastActive }

// ===== set name (set once) =====
app.post('/setname', (req, res) => {
  const { userId, name } = req.body;
  if(!userId || !name) return res.status(400).json({ status:'error', message:'missing' });

  // If name already exists for this userId, return the existing name (prevent overwrite)
  if(userNames[userId]) return res.json({ status:'exists', name: userNames[userId] });

  // else set and return ok
  userNames[userId] = name;
  return res.json({ status:'ok', name });
});

// ===== get messages (filter by lastClear[userId]) =====
app.get('/messages', (req, res) => {
  const userId = req.query.userId;
  const clearTime = lastClear[userId] || 0;
  // return all messages with timestamp > clearTime
  const filtered = chatData.filter(m => m.timestamp > clearTime);
  res.json(filtered);
});

// ===== send message (text + optional image) =====
app.post('/send', upload.single('image'), (req, res) => {
  const { text, userId } = req.body;
  if(!userId) return res.status(400).json({ status:'error', message:'userId required' });

  // Ensure user has a name registered (if not, create a default and store)
  if(!userNames[userId]) {
    // if client didn't set name, assign "Anon-XXXX" and store so user can't change later
    userNames[userId] = 'Anon-' + userId.slice(0,6);
  }

  const msg = {
    userId,
    name: userNames[userId],
    text: text || "",
    image: req.file ? `/uploads/${req.file.filename}` : null,
    time: moment().tz("Asia/Jakarta").format("HH:mm"),
    timestamp: Date.now()
  };

  chatData.push(msg);
  if(chatData.length > 500) chatData.shift();

  return res.json({ status:'ok' });
});

// ===== clear view for user (server records timestamp) =====
app.post('/clear', (req, res) => {
  const { userId } = req.body;
  if(!userId) return res.status(400).json({ status:'error' });
  lastClear[userId] = Date.now();
  res.json({ status:'ok' });
});

// ===== heartbeat =====
app.post('/heartbeat', (req, res) => {
  const { userId, name } = req.body;
  if(!userId) return res.status(400).json({ status:'error' });
  onlineUsers[userId] = { name: userNames[userId] || name || ('Anon-'+userId.slice(0,6)), lastActive: Date.now() };
  res.json({ status:'ok' });
});

// ===== get online list =====
app.get('/online', (req, res) => {
  const now = Date.now();
  for(const u in onlineUsers){
    if(now - onlineUsers[u].lastActive > 30000) delete onlineUsers[u];
  }
  res.json(Object.values(onlineUsers).map(x => x.name));
});

// ===== start =====
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
