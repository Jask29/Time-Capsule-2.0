const supabase = require("../config/supabaseconfig");
const { v4: uuidv4 } = require("uuid");

exports.createCapsule = async (req, res) => {
  try {
    const { title, unlockDate, userId } = req.body;
    const files = req.files;
    if (!title || !unlockDate || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const capsuleId = uuidv4();
    let fileLinks = [];

    for (const file of files) {
      const filePath = `capsules/${capsuleId}/${file.originalname}`;
      const { error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(filePath, file.buffer, { contentType: file.mimetype });

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(filePath);

      fileLinks.push(publicUrl.publicUrl);
    }

    res.status(201).json({ message: "Capsule created!", capsuleId, fileLinks, unlockDate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCapsule = async (req, res) => {
  try {
    const { id } = req.params;
    // Retrieve unlock date (this depends on how you store data)
    const unlockDate = new Date(); // Replace with actual stored date
    if (new Date() < unlockDate) {
      return res.status(403).json({ error: "Capsule is locked!" });
    }

    res.status(200).json({ message: "Capsule unlocked!", files: [] }); // Replace with actual files
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Upload Route
app.post("/upload", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = req.files.file;
    const userId = req.body.user_id;  // User ID from request
    const releaseDate = req.body.release_date;  // When the file should be unlocked

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from("time-capsule")  // Change to your bucket name
      .upload(`capsules/${file.name}`, file.data, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    // Store file metadata in Supabase database
    const { error: dbError } = await supabase
      .from("capsules")  // Make sure your table is named "capsules"
      .insert([{ file_name: file.name, user_id: userId, release_date: releaseDate, status: "locked" }]);

    if (dbError) throw dbError;

    res.status(200).json({ message: "File uploaded successfully!", fileName: file.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
