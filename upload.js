require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Configuration
const ACCESS_TOKEN = process.env.STRAVA_ACCESS_TOKEN;
const DIR_PATH = './runtastic_export';
const UPLOAD_ENDPOINT = 'https://www.strava.com/api/v3/uploads';

// Set how many files to process in this run (e.g., 1 for testing, or 500 for the full batch)
const MAX_FILES_TO_PROCESS = 1;

// Sleep function to manage rate limits (1 request every 5 seconds)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function uploadToStrava() {
  // Read the directory and filter only for .gpx files
  let files = fs.readdirSync(DIR_PATH).filter(file => file.endsWith('.gpx'));

  if (files.length === 0) {
    console.log('No .gpx files found. Double-check your runtastic_export folder!');
    return;
  }

  // Sort files in reverse chronological order (newest first)
  // String comparison works perfectly here because of the YYYY-MM-DD naming convention
  files.sort((a, b) => b.localeCompare(a));

  // Limit the array to the specified constant
  const filesToProcess = files.slice(0, MAX_FILES_TO_PROCESS);

  console.log(`Found ${files.length} total GPX files. Attempting to upload the newest ${filesToProcess.length}...`);

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    const filePath = path.join(DIR_PATH, file);

    // Construct the multipart/form-data payload
    const form = new FormData();
    form.append('data_type', 'gpx');
    form.append('file', fs.createReadStream(filePath));

    // Cleaning up the name slightly for the Strava feed
    const dateString = file.substring(0, 10); // Extracts the YYYY-MM-DD
    form.append('name', `Runtastic Run - ${dateString}`);
    form.append('description', 'Imported via Node.js script');

    try {
      console.log(`[${i + 1}/${filesToProcess.length}] Uploading ${file}...`);
      const response = await axios.post(UPLOAD_ENDPOINT, form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        }
      });
      console.log(`  -> Success! Strava Upload ID: ${response.data.id}`);
    } catch (error) {
      console.error(`  -> Failed to upload ${file}:`, error.response ? error.response.data : error.message);
    }

    // Wait 5 seconds between requests (skip sleep on the very last file)
    if (i < filesToProcess.length - 1) {
      await sleep(5000);
    }
  }

  console.log('Batch complete! Check your Strava feed.');
}

uploadToStrava();
