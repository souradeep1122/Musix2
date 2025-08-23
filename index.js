const path = require("path");
const express = require("express");
const app = express();
require("dotenv").config();
var morgan = require("morgan");
app.use(morgan("tiny"));
const Mongo = require("./user");

const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { mongo } = require("mongoose");

// Configure Cloudinary via env
cloudinary.config({
  cloud_name: "dzcf32qac",
  api_key: "983461817852631",
  api_secret: "lKzveCmrBIOTEENfohkMwMVRrd4",
});

// Multer storage to Cloudinary (resource_type raw handles mp3 well; auto also works)
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Only allow mp3 uploads from the form; you can expand types if needed
    // You can also validate mimetype: file.mimetype === 'audio/mpeg'
    return {
      folder: "music_uploads",
      resource_type: "raw", // mp3s are best treated as raw or video; 'auto' is also acceptable
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

// Home: upload form + playlist
app.get("/", async (req, res) => {
  try {
    // Fetch up to 200 most recent files in the music_uploads folder
    const results = await cloudinary.search
      .expression("folder:music_uploads")
      .sort_by("created_at", "desc")
      .max_results(200)
      .execute(); // Cloudinary Search API[3][14]

    const files2 = await Mongo.find({})
      .sort({ createdAt: -1 }) // Most recent first
      .limit(200);

    // Transform data to match your existing template structure
    const formattedFiles = files2.map((file) => ({
      public_id: file.public_id,
      bytes: file.bytes,
      created_at: file.created_at,
      originalname: file.OriginalName, // This is the key addition!
      url: file.url,
      format: file.format,
      duration: file.duration,
    }));
    //console.log(files1)

    res.render("Data", { files: formattedFiles });
    //console.log(formattedFiles)
  } catch (err) {
    console.error("Cloudinary search error:", err);
    res.status(500).send("Unable to list music files");
  }
});

// Handle MP3 upload
app.post("/upload", upload.single("music_file"), async (req, res) => {
  console.log(" sucessfully Uploaded to Cloudinary:");

  // Save file metadata to MongoDB
  const musicFile = new Mongo({
    public_id: req.file.filename,
    OriginalName: req.file.originalname,
    format: req.file.format,
    url: req.file.path,
    bytes: req.file.size,
    duration: req.file.duration,
  });

  const savedFile = await musicFile.save();
  console.log("Saved to MongoDB:", musicFile);

  return res.redirect("/");
});

// Delete a track by public_id
app.get("/AllBus/:id", async function (req, res) {
  const publicId = req.params.id;

  const idd = `music_uploads/${publicId}`;

  const result = await cloudinary.uploader.destroy(idd, {
    resource_type: "raw",
  }); //for cloudinary deletion

  const mongodlt = await Mongo.deleteOne({ public_id: idd }); //for mongodb deletion
  console.log(idd);

  return res.redirect("/");
});

app.get("/postmp3", (req, res) => {
  // req.file contains Cloudinary info; redirect back to home
  console.log("now on postmp3 route");
  res.render("post");
});

app.get("/files", (req, res) => {
  // req.file contains Cloudinary info; redirect back to home

  res.render("files");
});

app.listen(3000, () => console.log("Server running on port 3000"));
