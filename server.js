const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const moment = require("moment-timezone");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== STORAGE GAMBAR =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = "uploads";
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + "-" + Math.floor(Math.random()*10000) + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // max 5MB
});

// ===== STATIC FILE =====
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.json());

// ===== DATA CHAT =====
let chatData = [];
let userNames = {};
let onlineUsers = {};

// ===== DATA CLEAR CHAT PER USER =====
let lastClear = {};   // <— userId: timestamp

// ===== ROUTE GET MESSAGES =====
app.get("/messages", (req, res) => {
    const userId = req.query.userId;

    // Jika tidak ada userId, kirim semua chat
    if (!userId) {
        return res.json(chatData);
    }

    // Ambil waktu kapan user nge-clear
    const clearTime = lastClear[userId] || 0;

    // Filter chat yang muncul SETELAH user clear chat
    const filtered = chatData.filter(msg => {
        return msg.timestamp > clearTime;
    });

    res.json(filtered);
});

// ===== ROUTE SEND MESSAGE =====
app.post("/send", upload.single("image"), (req, res) => {
    const { text, name, userId } = req.body;
    if(!userId) return res.status(400).json({ status:"error", message:"userId required" });

    if(!userNames[userId]) userNames[userId] = name || "Anonymous";
    const finalName = userNames[userId];

    let image = null;
    if(req.file) image = `/uploads/${req.file.filename}`;

    const time = moment().tz("Asia/Jakarta").format("HH:mm");

    const msgObj = { 
        userId, 
        name: finalName, 
        text, 
        image, 
        time,
        timestamp: Date.now()       // <— penting untuk fitur clear chat!
    };

    chatData.push(msgObj);

    if(chatData.length > 100) chatData = chatData.slice(chatData.length - 100);

    res.json({ status:"ok", name: finalName });
});

// ===== CLEAR CHAT PER USER =====
app.post("/clear", (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ status: "error", message: "userId diperlukan" });
    }

    // Simpan timestamp kapan user nge-clear chat
    lastClear[userId] = Date.now();

    res.json({ status: "ok", message: "Chat tampilan user dibersihkan" });
});

// ===== ONLINE USERS =====
app.post("/heartbeat", (req,res)=>{
    const { userId, name } = req.body;
    if(!userId) return res.status(400).json({ status:"error" });
    onlineUsers[userId] = { name, lastActive: Date.now() };
    res.json({ status:"ok" });
});

app.get("/online", (req,res)=>{
    const now = Date.now();
    for(let id in onlineUsers){
        if(now - onlineUsers[id].lastActive > 30000) delete onlineUsers[id];
    }
    res.json(Object.values(onlineUsers).map(u=>u.name));
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
