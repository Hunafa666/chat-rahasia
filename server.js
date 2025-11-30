const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const moment = require("moment-timezone");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== UPLOADS =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = "uploads";
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + "-" + Math.random()*10000 + ext);
    }
});
const upload = multer({ storage });

// ===== STATIC =====
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.json());

// ===== DATA =====
let chatData = [];
let lastClear = {};
let onlineUsers = {};
let userNames = {};

// ===== GET MESSAGES =====
app.get("/messages", (req, res) => {
    const userId = req.query.userId;
    const clearTime = lastClear[userId] || 0;

    res.json(chatData.filter(m => m.timestamp > clearTime));
});

// ===== SEND =====
app.post("/send", upload.single("image"), (req, res) => {
    const { text, userId, name } = req.body;

    if (!userId) {
        return res.status(400).json({ status:"error", message:"userId required" });
    }

    if (!userNames[userId]) userNames[userId] = name || "Anonymous";

    const msg = {
        userId,
        name: userNames[userId],
        text: text || "",
        image: req.file ? "/uploads/" + req.file.filename : null,
        time: moment().tz("Asia/Jakarta").format("HH:mm"),
        timestamp: Date.now()
    };

    chatData.push(msg);
    if (chatData.length > 200) chatData.shift();

    res.json({ status:"ok" });
});

// ===== CLEAR =====
app.post("/clear", (req, res) => {
    const { userId } = req.body;
    lastClear[userId] = Date.now();
    res.json({ status:"ok" });
});

// ===== HEARTBEAT =====
app.post("/heartbeat", (req, res) => {
    const { userId, name } = req.body;
    onlineUsers[userId] = { name, lastActive: Date.now() };
    res.json({ status:"ok" });
});

// ===== ONLINE =====
app.get("/online", (req, res) => {
    const now = Date.now();
    for (let u in onlineUsers) {
        if (now - onlineUsers[u].lastActive > 20000) delete onlineUsers[u];
    }
    res.json(Object.values(onlineUsers).map(u => u.name));
});

// ===== START =====
app.listen(PORT, () => {
    console.log("Server running on PORT " + PORT);
});