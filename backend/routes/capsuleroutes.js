const express = require("express");
const multer = require("multer");
const supabase = require("../config/supabaseconfig");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { originalname, buffer } = req.file;
    const { release_date, user_id } = req.body; // User sets release date

    const { data, error } = await supabase.storage
      .from("time-capsule")
      .upload(`capsules/${originalname}`, buffer, {
        contentType: req.file.mimetype,
      });

    if (error) throw error;

    // Save metadata in database
    const { error: dbError } = await supabase
      .from("capsules")
      .insert([{ 
        filename: originalname, 
        storage_path: `capsules/${originalname}`, 
        release_date, 
        user_id 
      }]);

    if (dbError) throw dbError;

    res.json({ message: "File uploaded and locked!", data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

router.get("/retrieve/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    // Fetch file metadata
    const { data: capsule, error } = await supabase
      .from("capsules")
      .select("*")
      .eq("filename", filename)
      .single();

    if (error || !capsule) throw new Error("File not found!");

    const currentTime = new Date();
    const releaseTime = new Date(capsule.release_date);

    if (currentTime < releaseTime) {
      return res.status(403).json({ message: "File is locked until " + capsule.release_date });
    }

    // Generate Signed URL for file download
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from("time-capsule")
      .createSignedUrl(capsule.storage_path, 60); // 60s validity

    if (urlError) throw urlError;

    res.json({ download_url: urlData.signedUrl });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

