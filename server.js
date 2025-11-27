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

// ===== DATA CHAT =====
let chatData = []; // Memory storage sementara, bisa diganti DB

// ===== ROUTE GET MESSAGES =====
app.get("/messages", (req, res) => {
    res.json(chatData);
});

// ===== ROUTE SEND MESSAGE =====
app.post("/send", upload.single("image"), (req, res) => {
    const { text, name, userId } = req.body;
    let image = null;
    if (req.file) {
        image = `/uploads/${req.file.filename}`;
    }
    const now = new Date();
    const time = now.getHours().toString().padStart(2,"0") + ":" + now.getMinutes().toString().padStart(2,"0");

    const msgObj = { userId, name, text, image, time };
    chatData.push(msgObj);

    // Batasi max 100 pesan
    if (chatData.length > 100) chatData = chatData.slice(chatData.length - 100);

    res.json({ status: "ok" });
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
