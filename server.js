const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== STORAGE UNTUK GAMBAR =====
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = "uploads";
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + "-" + Math.floor(Math.random()*10000) + ext);
    }
});
const upload = multer({ storage });

// ===== STATIC FILE =====
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.json());

// ===== DATA CHAT & USER =====
let chatData = [];      // Memory storage chat
let userNames = {};     // userId -> name, untuk fix nama satu kali

// ===== ROUTE GET MESSAGES =====
app.get("/messages", (req, res) => {
    res.json(chatData);
});

// ===== ROUTE SEND MESSAGE =====
app.post("/send", upload.single("image"), (req, res) => {
    const { text, name, userId } = req.body;

    if (!userId) return res.status(400).json({ status: "error", message: "userId required" });

    // ===== FIX BUG NAMA =====
    if (!userNames[userId]) {
        // User belum punya nama → simpan
        userNames[userId] = name || "Anonymous";
    }
    const finalName = userNames[userId];

    // ===== PROSES GAMBAR =====
    let image = null;
    if (req.file) {
        image = `/uploads/${req.file.filename}`;
    }

    const now = new Date();
    const time = now.getHours().toString().padStart(2,"0") + ":" + now.getMinutes().toString().padStart(2,"0");

    const msgObj = { userId, name: finalName, text, image, time };
    chatData.push(msgObj);

    // Batasi max 100 pesan
    if (chatData.length > 100) chatData = chatData.slice(chatData.length - 100);

    res.json({ status: "ok", name: finalName });
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
