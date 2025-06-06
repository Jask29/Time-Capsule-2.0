require("dotenv").config(); // Ensure this line is at the top

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase credentials. Check your .env file.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;

