const path = require('path');
const express = require('express');
const app = express();
require('dotenv').config();

const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary via env
cloudinary.config({
    cloud_name:'dzcf32qac',
    api_key: '983461817852631',
    api_secret: 'lKzveCmrBIOTEENfohkMwMVRrd4',
});

// Multer storage to Cloudinary (resource_type raw handles mp3 well; auto also works)
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Only allow mp3 uploads from the form; you can expand types if needed
    // You can also validate mimetype: file.mimetype === 'audio/mpeg'
    return {
      folder: 'music_uploads',
      resource_type: 'raw', // mp3s are best treated as raw or video; 'auto' is also acceptable
      use_filename: true,
      unique_filename: true,
      allowed_formats: ['mp3'],
    };
  },
});

const upload = multer({ storage });

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Home: upload form + playlist
app.get('/', async (req, res) => {
  try {
    // Fetch up to 200 most recent files in the music_uploads folder
    const results = await cloudinary.search
      .expression('folder:music_uploads')
      .sort_by('created_at', 'desc')
      .max_results(200)
      .execute(); // Cloudinary Search API[3][14]

    const files = (results.resources || []).map(r => ({
      public_id: r.public_id,
      url: r.secure_url,      // direct file URL
      format: r.format,       // should be mp3
      bytes: r.bytes,
      created_at: r.created_at,
      duration: r.duration || null, // may be null for raw; present if uploaded as 'video'
    }));
    

    res.render('data', { files });

  } catch (err) {
    console.error('Cloudinary search error:', err);
    res.status(500).send('Unable to list music files');
  }
});

// Handle MP3 upload
app.post('/upload', upload.single('music_file'), (req, res) => {
  // req.file contains Cloudinary info; redirect back to home
  //console.log('Uploaded to Cloudinary:', req.file);
  return res.redirect('/');
});

// Delete a track by public_id
app.get("/AllBus/:id", async function (req, res) {
  const  publicId  = req.params.id;
  console.log(publicId)
  const idd = `music_uploads/${publicId}`;


  //idd2="music_uploads/file_xsxaqh"
  const result = await cloudinary.uploader.destroy(idd, { resource_type: 'raw' });
  

  return res.redirect("/")
  /*try {
    const  publicId  = req.params.publicId;
    // Since we uploaded as resource_type: 'raw', set resource_type accordingly
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }); // Cloudinary destroy[7][10][19]

    const result2 = cloudinary.uploader.destroy(publicId, options).then(callback);

    console.log(result2);
    if (result2.result === 'not found') return res.status(404).json({ message: 'Track not found' });
    return res.json({ message: 'Deleted', result2 });
    
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ message: 'Delete failed' });
  }
    */
   
});





app.get('/postmp3', (req, res) => {
  // req.file contains Cloudinary info; redirect back to home
  console.log('now on postmp3 route');
  res.render("post");
});

app.get('/files', (req, res) => {
  // req.file contains Cloudinary info; redirect back to home
  
  res.render("files");
});

app.listen(3000, () => console.log('Server running on port 3000'));
