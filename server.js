require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { GridFSBucket } = require("mongodb");
const path = require("path");
const methodOverride = require("method-override");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride("_method"));
app.use(express.static("public"));
app.set("view engine", "ejs");

// MongoDB Connection
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/imageUpload";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Initialize GridFSBucket
let bucket;
mongoose.connection.once("open", () => {
    bucket = new GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
    console.log("✅ GridFSBucket Initialized");
});

// Configure Multer (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 🖼 Home Page - Show Uploaded Images
app.get("/", async (req, res) => {
    try {
        const files = await bucket.find().toArray();
        res.render("index", { files });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading images");
    }
});

// 📤 Upload Image Route
app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).send("No file uploaded.");

    const uploadStream = bucket.openUploadStream(req.file.originalname);
    uploadStream.end(req.file.buffer);

    uploadStream.on("finish", () => {
        console.log("✅ File Uploaded:", req.file.originalname);
        res.redirect("/");
    });

    uploadStream.on("error", (err) => {
        console.error("❌ Upload Error:", err);
        res.status(500).send("Upload failed");
    });
});

// 📸 Retrieve Image
app.get("/image/:filename", async (req, res) => {
    try {
        const file = await bucket.find({ filename: req.params.filename }).toArray();

        if (!file || file.length === 0) {
            return res.status(404).json({ err: "No file found" });
        }

        const downloadStream = bucket.openDownloadStreamByName(req.params.filename);
        downloadStream.pipe(res);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error retrieving image");
    }
});

// 🚀 Start Server
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
