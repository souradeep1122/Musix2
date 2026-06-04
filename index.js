const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const path = require("path");
const express = require("express");
const app = express();

require("dotenv").config();

const morgan = require("morgan");
const mongoose = require("mongoose");
const multer = require("multer");

const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const Mongo = require("./user");
const Visitor = require("./visitor");

app.use(morgan("tiny"));

// Database Connection
mongoose
  .connect(process.env.mongo)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("DB Connection Error:", err));

mongoose.set("strictQuery", false);

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.cloud_name,
  api_key: process.env.api_key,
  api_secret: process.env.api_secret,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "music_uploads",
      resource_type: "raw",
      use_filename: true,
      unique_filename: true,
      allowed_formats: ["mp3"],
    };
  },
});

const upload = multer({ storage });

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Home Route
app.get("/", async (req, res) => {
  try {
    let visitorData = await Visitor.findOne({ id: "main_counter" });

    if (!visitorData) {
      visitorData = new Visitor({ id: "main_counter", count: 1 });
    } else {
      visitorData.count += 1;
    }

    await visitorData.save();

    const files2 = await Mongo.find({})
      .sort({ created_at: -1 })
      .limit(200);

    const formattedFiles = files2.map((file) => ({
      public_id: file.public_id,
      bytes: file.bytes,
      created_at: file.created_at,
      originalname: file.OriginalName,
      url: file.url,
      format: file.format,
      duration: file.duration,
    }));

    res.render("data3", {
      files: formattedFiles,
      visitorCount: visitorData.count,
    });
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Upload MP3
app.post("/upload", upload.single("music_file"), async (req, res) => {
  try {
    const musicFile = new Mongo({
      public_id: req.file.filename,
      OriginalName: req.file.originalname,
      format: req.file.format || "mp3",
      url: req.file.path,
      bytes: req.file.size,
      duration: 0,
    });

    await musicFile.save();

    return res.redirect("/");
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).send("Upload Failed");
  }
});

// Delete Track
app.get("/AllBus/:id", async (req, res) => {
  try {
    const publicId = req.params.id;

    await cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
    });

    await Mongo.deleteOne({ public_id: publicId });

    return res.redirect("/");
  } catch (err) {
    console.error("Deletion Error:", err);
    res.redirect("/");
  }
});

// Upload Page
app.get("/postmp3", (req, res) => {
  res.render("post");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});