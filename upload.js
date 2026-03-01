require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Configuration
const ACCESS_TOKEN = process.env.STRAVA_ACCESS_TOKEN;
const DIR_PATH = './runtastic_export';
const SUCCESS_PATH = './successfully_imported';
const OUTPUT_PATH = './output';
const REPORT_FILE = path.join(OUTPUT_PATH, 'report.md');
const UPLOAD_ENDPOINT = 'https://www.strava.com/api/v3/uploads';

// Set how many files to process in this run (1 for test, 500 for full batch)
const MAX_FILES_TO_PROCESS = 500;

// Sleep function to manage rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. Ensure necessary folders exist
[SUCCESS_PATH, OUTPUT_PATH].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// 2. Cumulative Reporting Logic: Create header or add session separator
if (!fs.existsSync(REPORT_FILE)) {
  const reportHeader = `# Strava Migration Report\nGenerated on: ${new Date().toLocaleString()}\n\n| GPX File | Runtastic Type | Strava Name & Link | Strava Type |\n| :--- | :--- | :--- | :--- |\n`;
  fs.writeFileSync(REPORT_FILE, reportHeader);
} else {
  fs.appendFileSync(REPORT_FILE, `\n\n### New Session: ${new Date().toLocaleString()}\n`);
}

// Helper to determine Activity Type, Time of Day, and Strava-specific sport mapping
function getFileInfo(file, filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Map Runtastic <type> to Strava activity_type
    let stravaType = 'run';
    const typeMatch = content.match(/<type>(.*?)<\/type>/i);
    const rawType = typeMatch ? typeMatch[1].toLowerCase() : 'running';

    if (rawType === 'strolling') stravaType = 'walk';
    else if (rawType === 'cycling') stravaType = 'ride';
    else if (rawType === 'running') stravaType = 'run';

    // Calculate Local Time of Day using Longitude Math
    let localHour = 12;
    const timeParts = file.match(/_(\d{2})-\d{2}-\d{2}-UTC/);
    const lonMatch = content.match(/lon="([^"]+)"/);

    if (timeParts && lonMatch) {
      const utcHour = parseInt(timeParts[1], 10);
      const lon = parseFloat(lonMatch[1]);
      const offset = Math.round(lon / 15);
      localHour = (utcHour + offset + 24) % 24;
    } else if (timeParts) {
      // Fallback to Toronto EST (UTC-5)
      const utcHour = parseInt(timeParts[1], 10);
      localHour = (utcHour - 5 + 24) % 24;
    }

    let timeOfDay = 'Morning';
    if (localHour >= 0 && localHour < 6) timeOfDay = 'Night';
    else if (localHour >= 6 && localHour < 12) timeOfDay = 'Morning';
    else if (localHour >= 12 && localHour < 17) timeOfDay = 'Afternoon';
    else if (localHour >= 17 && localHour < 21) timeOfDay = 'Evening';
    else if (localHour >= 21) timeOfDay = 'Night';

    const prettyType = stravaType.charAt(0).toUpperCase() + stravaType.slice(1);

    return {
      rawType: rawType,
      stravaType: stravaType,
      displayName: `RR - ${timeOfDay} ${prettyType}`
    };
  } catch (error) {
    return { rawType: 'unknown', stravaType: 'run', displayName: 'RR - Activity' };
  }
}

async function uploadToStrava() {
  let files = fs.readdirSync(DIR_PATH).filter(file => file.endsWith('.gpx'));

  if (files.length === 0) {
    console.log('🎉 No .gpx files found in runtastic_export! You are all caught up.');
    return;
  }

  // Sort files in reverse chronological order (newest first)
  files.sort((a, b) => b.localeCompare(a));

  const filesToProcess = files.slice(0, MAX_FILES_TO_PROCESS);

  console.log(`\n==================================================`);
  console.log(`STRAVA BULK UPLOAD STARTED`);
  console.log(`Remaining in queue: ${files.length}`);
  console.log(`Processing this batch: ${filesToProcess.length}`);
  console.log(`==================================================\n`);

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    const filePath = path.join(DIR_PATH, file);
    const successFilePath = path.join(SUCCESS_PATH, file);
    const currentFileNum = i + 1;
    const totalInBatch = filesToProcess.length;
    const remainingInBatch = totalInBatch - currentFileNum;

    const info = getFileInfo(file, filePath);

    console.log(`--------------------------------------------------`);
    console.log(`Processing File [${currentFileNum} of ${totalInBatch}] - ${remainingInBatch} left in batch`);
    console.log(`File:       ${file}`);
    console.log(`Strava Type: ${info.stravaType}`);
    console.log(`Gen Name:   ${info.displayName}`);

    const form = new FormData();
    form.append('data_type', 'gpx');
    form.append('activity_type', info.stravaType); //
    form.append('file', fs.createReadStream(filePath));
    form.append('name', info.displayName);
    form.append('description', 'Imported via custom Node.js script');

    try {
      console.log(`Status:     Uploading to Strava...`);
      const postResponse = await axios.post(UPLOAD_ENDPOINT, form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        }
      });

      const uploadId = postResponse.data.id;
      console.log(`Status:     File accepted (Upload ID: ${uploadId}). Waiting for processing...`);

      // Polling loop to wait for the activity link
      let activityId = postResponse.data.activity_id;
      let uploadStatus = postResponse.data.status;
      let hasError = postResponse.data.error;

      while (!activityId && !hasError && uploadStatus !== 'Your activity is ready.') {
        await sleep(2000);
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

      const stravaLink = `https://www.strava.com/activities/${activityId}`;
      console.log(`Result:     ✅ SUCCESS`);
      console.log(`Link:       ${stravaLink}`);

      // Move file only on confirmed success
      fs.renameSync(filePath, successFilePath);
      console.log(`File Move:  Moved to /successfully_imported`);

      // Append row to report
      const reportLine = `| ${file} | ${info.rawType} | [${info.displayName}](${stravaLink}) | ${info.stravaType} |\n`;
      fs.appendFileSync(REPORT_FILE, reportLine);

      successCount++;
    } catch (error) {
      console.log(`Result:     ❌ FAILED`);
      console.error(`Details:   `, error.response ? JSON.stringify(error.response.data) : error.message);
      failureCount++;
    }

    if (i < filesToProcess.length - 1) {
      console.log(`Action:     Waiting 5 seconds for rate limit...`);
      await sleep(5000);
    }
  }

  console.log(`\n==================================================`);
  console.log(`MIGRATION BATCH COMPLETE`);
  console.log(`Total Processed: ${filesToProcess.length}`);
  console.log(`Successful:      ${successCount}`);
  console.log(`Failed:          ${failureCount}`);
  console.log(`Master Report:   ${REPORT_FILE}`);
  console.log(`==================================================\n`);
}

uploadToStrava();
