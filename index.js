

const path = require("path");
const express = require("express");
const app = express();
require("dotenv").config();
var morgan = require("morgan");
app.use(morgan("tiny"));
const Mongo = require("./user");
const Visitor = require("./visitor");

const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const mongoose = require("mongoose");
const https = require("https");
const http  = require("http");

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("DB Connection Error: ", err));
mongoose.set("strictQuery", false);

// Configure Cloudinary
cloudinary.config({
  cloud_name:process.env.CLOUD_NAME,
  api_key:process.env.CLOUD_API_KEY,
  api_secret:process.env.CLOUD_API_SECRET,
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

// --- ROUTES ---

// Home: List Music + Visitor Tracker
app.get("/", async (req, res) => {
  try {
    let visitorData = await Visitor.findOne({ id: "main_counter" });
    if (!visitorData) {
      visitorData = new Visitor({ id: "main_counter", count: 1 });
      await visitorData.save();
    } else {
      visitorData.count += 1;
      await visitorData.save();
    }

    const files2 = await Mongo.find({}).sort({ created_at: -1 }).limit(200);

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

// ─── AUDIO PROXY ROUTE ────────────────────────────────────────────────────────
// Fetches the audio from Cloudinary server-side and streams it back.
// This eliminates ALL browser CORS issues — the request is same-origin.
// The Service Worker caches /proxy-audio/:id responses (same-origin = always cacheable).
//
// URL format:  GET /proxy-audio/:public_id
// The client passes the Cloudinary URL as a query param:
//   /proxy-audio/some_file_id?url=https://res.cloudinary.com/...
//
// We verify the URL actually points to our Cloudinary account before proxying.

app.get("/proxy-audio/:id", async (req, res) => {
  try {
    const cloudinaryUrl = req.query.url;

    // Basic validation — only proxy our own Cloudinary account
    if (
      !cloudinaryUrl ||
      !cloudinaryUrl.includes("res.cloudinary.com") ||
      !cloudinaryUrl.includes("dzcf32qac")          // your cloud_name
    ) {
      return res.status(400).send("Invalid audio URL");
    }

    // Choose http or https module based on URL
    const client = cloudinaryUrl.startsWith("https") ? https : http;

    const proxyReq = client.get(cloudinaryUrl, (proxyRes) => {
      // Forward content-type and content-length so the SW can read size accurately
      const headers = {
        "Content-Type": proxyRes.headers["content-type"] || "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes",
      };
      if (proxyRes.headers["content-length"]) {
        headers["Content-Length"] = proxyRes.headers["content-length"];
      }

      // Support range requests so the audio element can seek while cached
      if (req.headers.range && proxyRes.headers["content-range"]) {
        headers["Content-Range"] = proxyRes.headers["content-range"];
        res.writeHead(206, headers);
      } else {
        res.writeHead(proxyRes.statusCode === 206 ? 206 : 200, headers);
      }

      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      console.error("Proxy fetch error:", err.message);
      if (!res.headersSent) res.status(502).send("Could not fetch audio");
    });

    req.on("close", () => proxyReq.destroy()); // client disconnected — stop fetching

  } catch (err) {
    console.error("Proxy route error:", err);
    if (!res.headersSent) res.status(500).send("Proxy error");
  }
});

// Handle MP3 upload
app.post("/upload", upload.single("music_file"), async (req, res) => {
  try {
    console.log("Successfully Uploaded to Cloudinary");

    const musicFile = new Mongo({
      public_id: req.file.filename,
      OriginalName: req.file.originalname,
      format: req.file.format || "mp3",
      url: req.file.path,
      bytes: req.file.size,
      duration: 0,
    });

    await musicFile.save();
    console.log("Saved to MongoDB");

    return res.redirect("/");
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).send("Upload Failed");
  }
});

// Delete a track
app.get("/AllBus/:id", async function (req, res) {
  try {
    const publicId = req.params.id;
    const fullId = `music_uploads/${publicId}`;

    await cloudinary.uploader.destroy(fullId, { resource_type: "raw" });
    await Mongo.deleteOne({ public_id: req.params.id });

    console.log("Deleted:", fullId);
    return res.redirect("/");
  } catch (err) {
    console.error("Deletion Error:", err);
    res.redirect("/");
  }
});

// Render Upload Page
app.get("/postmp3", (req, res) => {
  res.render("post");
});

app.listen(3000, () => console.log("Server running on port 3000"));
