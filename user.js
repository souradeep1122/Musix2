const mongoose = require("mongoose");
mongoose.connect("mongodb+srv://souradeep418saha:HGNIErfgHHnMt4r3@aiavengerdb.je1poyy.mongodb.net/?retryWrites=true&w=majority");
mongoose.set("strictQuery", false);

const musicFileSchema = new mongoose.Schema({
  public_id: {
    type: String, // ✅ Proper object notation
    required: true,
    unique: true,
  },
  OriginalName: {
    type: String,
    require: true,
  },
  format: {
    type: String,

    default: "mp3",
  },
  url: {
    type: String,
    required: true,
  },

  bytes: {
    type: Number,

    min: 0,
  },

  duration: {
    type: Number,
    default: null,
  },
  created_at: {
    type: Date,

    default: Date.now,
  },
});

module.exports = mongoose.model("MusicFile", musicFileSchema);
