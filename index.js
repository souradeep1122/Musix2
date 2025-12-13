const path = require("path");
const express = require("express");
const app = express();
require("dotenv").config();
var morgan = require("morgan");
app.use(morgan("tiny"));
const Mongo = require("./user"); // Your existing Music Schema
const Visitor = require("./visitor"); // The new Visitor Schema

const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const mongoose = require("mongoose");

// Database Connection
mongoose.connect("mongodb+srv://souradeep418saha:HGNIErfgHHnMt4r3@aiavengerdb.je1poyy.mongodb.net/?retryWrites=true&w=majority")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("DB Connection Error: ", err));
mongoose.set("strictQuery", false);

// Configure Cloudinary via env or hardcoded (as you provided)
cloudinary.config({
  cloud_name: "dzcf32qac",
  api_key: "983461817852631",
  api_secret: "lKzveCmrBIOTEENfohkMwMVRrd4",
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
app.use(express.static(path.join(__dirname, "public"))); // Serve static files if needed

// --- ROUTES ---

// Home: List Music + Visitor Tracker
app.get("/", async (req, res) => {
  try {
    // 1. Visitor Tracker Logic
    let visitorData = await Visitor.findOne({ id: "main_counter" });
    
    if (!visitorData) {
      // Initialize if not exists
      visitorData = new Visitor({ id: "main_counter", count: 1 });
      await visitorData.save();
    } else {
      // Increment count
      visitorData.count += 1;
      await visitorData.save();
    }

    // 2. Fetch Music Files
    const files2 = await Mongo.find({})
      .sort({ created_at: -1 }) // Note: Schema says created_at, make sure sorting key matches
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

    // 3. Render with both Music List and Visitor Count
    // Ensure your view file is named 'data3.ejs' inside the 'views' folder
    res.render("data3", { 
        files: formattedFiles, 
        visitorCount: visitorData.count 
    });

  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Handle MP3 upload
app.post("/upload", upload.single("music_file"), async (req, res) => {
  try {
    console.log("Successfully Uploaded to Cloudinary");

    // Save metadata to MongoDB
    const musicFile = new Mongo({
      public_id: req.file.filename,
      OriginalName: req.file.originalname,
      format: req.file.format || "mp3", // Cloudinary might not always send format for raw
      url: req.file.path,
      bytes: req.file.size,
      duration: 0, // Duration isn't auto-extracted by raw upload without extra Cloudinary settings, defaulting to 0 or null
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
    const fullId = `music_uploads/${publicId}`; // Construct full public_id if strictly stored that way

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(fullId, { resource_type: "raw" });

    // Delete from MongoDB
    await Mongo.deleteOne({ public_id: req.params.id }); // Note: Check if you stored "music_uploads/..." or just filename in DB
    // If your DB stores "music_uploads/filename", use `fullId`. If just "filename", use `req.params.id`. 
    // Based on your upload code: `public_id: req.file.filename` usually includes folder.

    console.log("Deleted:", fullId);
    return res.redirect("/");
  } catch (err) {
    console.error("Deletion Error:", err);
    res.redirect("/");
  }
});

// Render Upload Page
app.get("/postmp3", (req, res) => {
  res.render("post"); // Make sure 'views/post.ejs' exists (use the upload.html code there)
});

app.listen(3000, () => console.log("Server running on port 3000"));
