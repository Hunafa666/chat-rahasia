const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const moment = require("moment-timezone");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===== MULTER STORAGE =====
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, "uploads");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(
            null,
            Date.now() +
                "-" +
                Math.floor(Math.random() * 10000) +
                path.extname(file.originalname)
        );
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
});

// ===== DATA SERVER =====
let chatData = [];           // { userId, name, text, image, time, timestamp }
let userNames = {};          // userId -> name
let lastClear = {};          // userId -> timestamp
let onlineUsers = {};        // userId -> { name, lastActive }

// ======================================================================
// SET NAMA (SET SEKALI, TIDAK BISA DIUBAH)
// ======================================================================
app.post("/setname", (req, res) => {
    const { userId, name } = req.body;

    if (!userId || !name) {
        return res
            .status(400)
            .json({ status: "error", message: "userId & name diperlukan" });
    }

    // kalau user sudah punya nama → jangan overwrite
    if (userNames[userId]) {
        return res.json({
            status: "exists",
            name: userNames[userId],
        });
    }

    userNames[userId] = name;
    return res.json({ status: "ok", name });
});

// ======================================================================
// GET MESSAGES (FILTER BERDASARKAN WAKTU CLEAR USER)
// ======================================================================
app.get("/messages", (req, res) => {
    const { userId } = req.query;

    const clearTime = lastClear[userId] || 0;

    const filtered = chatData.filter((msg) => msg.timestamp > clearTime);

    res.json(filtered);
});

// ======================================================================
// SEND (TEKS + GAMBAR OPSIONAL)
// ======================================================================
app.post("/send", upload.single("image"), (req, res) => {
    const { text, userId } = req.body;

    if (!userId)
        return res
            .status(400)
            .json({ status: "error", message: "userId required" });

    // jika user belum pernah set name
    if (!userNames[userId]) {
        // auto buat nama default → agar konsisten
        userNames[userId] = "Anon-" + userId.slice(0, 6);
    }

    const msg = {
        userId,
        name: userNames[userId],
        text: text || "",
        image: req.file ? `/uploads/${req.file.filename}` : null,
        time: moment().tz("Asia/Jakarta").format("HH:mm"),
        timestamp: Date.now(),
    };

    chatData.push(msg);

    // jaga memori server
    if (chatData.length > 500) chatData.shift();

    res.json({ status: "ok" });
});

// ======================================================================
// CLEAR CHAT UNTUK USER (TIDAK HAPUS DATA SERVER)
// ======================================================================
app.post("/clear", (req, res) => {
    const { userId } = req.body;

    if (!userId)
        return res.status(400).json({ status: "error", message: "userId?" });

    lastClear[userId] = Date.now();

    res.json({ status: "ok" });
});

// ======================================================================
// HEARTBEAT (USER ONLINE INDICATOR)
// ======================================================================
app.post("/heartbeat", (req, res) => {
    const { userId, name } = req.body;

    if (!userId)
        return res.status(400).json({ status: "error", message: "userId?" });

    onlineUsers[userId] = {
        name: userNames[userId] || name || "Anon-" + userId.slice(0, 6),
        lastActive: Date.now(),
    };

    res.json({ status: "ok" });
});

// ======================================================================
// GET ONLINE USERS
// ======================================================================
app.get("/online", (req, res) => {
    const now = Date.now();

    for (const id in onlineUsers) {
        if (now - onlineUsers[id].lastActive > 30000) {
            delete onlineUsers[id];
        }
    }

    res.json(Object.values(onlineUsers).map((u) => u.name));
});

// ======================================================================
// START SERVER
// ======================================================================
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
