const mongoose = require("mongoose");
mongoose.connect("mongodb+srv://souradeep418saha:HGNIErfgHHnMt4r3@aiavengerdb.je1poyy.mongodb.net/?retryWrites=true&w=majority");
mongoose.set("strictQuery", false);

const visitorSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  count: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("Visitor", visitorSchema);
