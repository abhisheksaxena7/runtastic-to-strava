require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Configuration
const ACCESS_TOKEN = process.env.STRAVA_ACCESS_TOKEN;
const DIR_PATH = './runtastic_export';
const UPLOAD_ENDPOINT = 'https://www.strava.com/api/v3/uploads';

// Set how many files to process in this run
const MAX_FILES_TO_PROCESS = 1;

// Sleep function to manage rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function uploadToStrava() {
  let files = fs.readdirSync(DIR_PATH).filter(file => file.endsWith('.gpx'));

  if (files.length === 0) {
    console.log('No .gpx files found. Double-check your runtastic_export folder!');
    return;
  }

  // Sort files in reverse chronological order (newest first)
  files.sort((a, b) => b.localeCompare(a));

  const filesToProcess = files.slice(0, MAX_FILES_TO_PROCESS);

  console.log(`\n==================================================`);
  console.log(`STRAVA BULK UPLOAD STARTED`);
  console.log(`Found ${files.length} total GPX files.`);
  console.log(`Attempting to upload the newest ${filesToProcess.length} files...`);
  console.log(`==================================================\n`);

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    const filePath = path.join(DIR_PATH, file);
    const currentFileNum = i + 1;
    const totalFiles = filesToProcess.length;
    const remainingFiles = totalFiles - currentFileNum;

    console.log(`--------------------------------------------------`);
    console.log(`Processing File [${currentFileNum} of ${totalFiles}] - ${remainingFiles} remaining`);
    console.log(`File Name: ${file}`);

    const form = new FormData();
    form.append('data_type', 'gpx');
    form.append('file', fs.createReadStream(filePath));

    const dateString = file.substring(0, 10);
    form.append('name', `RR - ${dateString}`);
    form.append('description', 'Imported via Node.js script');

    try {
      console.log(`Status:    Uploading to Strava...`);
      const postResponse = await axios.post(UPLOAD_ENDPOINT, form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        }
      });

      const uploadId = postResponse.data.id;
      console.log(`Status:    File accepted (Upload ID: ${uploadId}). Processing...`);

      // Polling loop to wait for Strava to finish processing and generate the link
      let activityId = postResponse.data.activity_id;
      let uploadStatus = postResponse.data.status;
      let hasError = postResponse.data.error;

      while (!activityId && !hasError && uploadStatus !== 'Your activity is ready.') {
        await sleep(2000); // Poll every 2 seconds
        const checkResponse = await axios.get(`${UPLOAD_ENDPOINT}/${uploadId}`, {
          headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
        });

        activityId = checkResponse.data.activity_id;
        uploadStatus = checkResponse.data.status;
        hasError = checkResponse.data.error;
      }

      if (hasError) {
        throw new Error(`Strava processing error: ${hasError}`);
      }

      console.log(`Result:    ✅ SUCCESS`);
      console.log(`Link:      https://www.strava.com/activities/${activityId}`);
      successCount++;
    } catch (error) {
      console.log(`Result:    ❌ FAILED`);
      console.error(`Details:  `, error.response ? JSON.stringify(error.response.data) : error.message);
      failureCount++;
    }

    // Wait 5 seconds between requests (skip sleep on the very last file)
    if (i < filesToProcess.length - 1) {
      console.log(`Action:    Waiting 5 seconds for rate limit...`);
      await sleep(5000);
    }
  }

  console.log(`\n==================================================`);
  console.log(`MIGRATION BATCH COMPLETE`);
  console.log(`Total Processed: ${filesToProcess.length}`);
  console.log(`Successful:      ${successCount}`);
  console.log(`Failed:          ${failureCount}`);
  console.log(`==================================================\n`);
}

uploadToStrava();
