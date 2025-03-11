
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");

// ✅ Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware
app.use(express.json());
app.use(cors());
app.use(fileUpload()); // ✅ Enable file uploads

// ✅ Upload Route (Stores file in Supabase + Saves metadata)
app.post("/upload", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const uploadedFile = req.files.file;
    const fileName = `${Date.now()}_${uploadedFile.name}`;
    const releaseDate = req.body.release_date; // Expecting a release date in request

    // ✅ Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from("time-capsule")
      .upload(`capsules/${fileName}`, uploadedFile.data, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) return res.status(500).json({ error: "File upload failed", details: error });

    // ✅ Save file metadata in Supabase Database
    const { data: dbData, error: dbError } = await supabase
      .from("capsules")
      .insert([{ file_name: fileName, release_date: releaseDate }]);

    if (dbError) return res.status(500).json({ error: "Failed to save metadata", details: dbError });

    res.json({ message: "File uploaded successfully!", fileName, releaseDate });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Access Route (Only returns file if unlocked)
app.get("/access/:fileName", async (req, res) => {
  try {
    const { fileName } = req.params;

    // ✅ Fetch file metadata from Supabase
    const { data, error } = await supabase
      .from("capsules")
      .select("release_date")
      .eq("file_name", fileName)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "File not found" });
    }

    const currentDate = new Date();
    const releaseDate = new Date(data.release_date);

    if (currentDate < releaseDate) {
      return res.status(403).json({ error: "File is still locked. Try again later!" });
    }

    // ✅ Generate a signed URL if file is unlocked
    const { data: urlData, error: urlError } = await supabase.storage
      .from("time-capsule")
      .createSignedUrl(`capsules/${fileName}`, 60); // URL expires in 60 seconds

    if (urlError) return res.status(500).json({ error: "Failed to generate file link", details: urlError });

    res.json({ message: "File is ready!", downloadUrl: urlData.signedUrl });
  } catch (error) {
    console.error("Access error:", error);
    res.status(500).json({ error: error.message });
  }
});
console.log("Uploading file to:", process.env.SUPABASE_URL);
console.log("Using API Key:", process.env.SUPABASE_KEY ? "Yes" : "No");


// ✅ Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
