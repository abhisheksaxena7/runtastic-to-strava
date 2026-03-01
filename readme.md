# Runtastic to Strava Bulk Uploader

A specialized Node.js utility designed to migrate your entire activity history from Runtastic (Adidas Running) to Strava. This tool bypasses manual upload limits and correctly maps activity types (strolling → walk, cycling → ride).

## 🚀 Key Features

- **Smart activity mapping**: Automatically translates Runtastic's internal labels (`strolling`, `running`, `cycling`) to the correct Strava API types.
- **Rate-limit protection**: Implements a dual-layer throttle (5-second pause between uploads and a 7.5-second status polling interval) to respect Strava's API quotas.
- **Resumable progress**: Successfully uploaded files are moved to a `successfully_imported` folder. If the script stops, it picks up exactly where it left off.
- **Session reporting**: Generates a cumulative Markdown report in `/output/report.md` with links to every imported activity on Strava.
- **Time-zone correction**: Uses GPS longitude data to calculate the local time of day for activity naming (e.g., "Afternoon Walk").

---

<details>
<summary><strong>🛠️ Setup & Installation</strong></summary>

<br>

#### 0. Export your data from Adidas Running

1. Log in to the Adidas Running web portal (`https://www.runtastic.com`) using your account.
2. Go to **Settings → Account & Data**.
3. In the **Export Data** section, click **Export Data** and confirm the request.
4. Wait for the email with your download link (this can take anywhere from a few hours to a couple of days).
5. Download the `.zip` archive to your computer.
6. Unzip the archive and navigate to `Sport-sessions/GPS-data`.
7. Copy all `.gpx` files from `GPS-data` into a folder named `runtastic_export` in the root of this project.

#### 1. Clone & install dependencies

```bash
git clone https://github.com/abhisheksaxena7/runtastic-to-strava.git
cd runtastic-to-strava
npm install
```

#### 2. Configure your Strava API token

You need a Strava token with `activity:write` permissions so the script can create activities on your behalf.

##### a. Create a Strava API application

1. Log in and open your [Strava API settings](https://www.strava.com/settings/api).
2. Fill out the form to create a new app:

   - **Application Name:** e.g. "Runtastic Migrator".
   - **Category:** "Visualizer" or "Other".
   - **Website:** `http://localhost`
   - **Authorization Callback Domain:** `localhost` (required).

3. Click **Create**. Note your **Client ID** and **Client Secret**.

##### b. Authorize the app for write access

Standard tokens only let you _read_ data; you must explicitly request permission to _upload_ it.

1. Copy the URL below and replace `[YOUR_CLIENT_ID]` with the actual ID from your Strava settings:

   `http://www.strava.com/oauth/authorize?client_id=[YOUR_CLIENT_ID]&response_type=code&redirect_uri=http://localhost/exchange_token&approval_prompt=force&scope=activity:write`

2. Paste the modified URL into your browser and click **Authorize**.
3. Your browser will redirect to a page that looks like an error (e.g., "Site cannot be reached") on `localhost`. This is expected.
4. Look at the **URL bar**. It will look similar to:

   `http://localhost/exchange_token?state=&code=ABC123XYZ...&scope=read,activity:write`

5. Copy everything between `code=` and `&scope`. This is your **authorization code**.

##### c. Exchange the code for an access token

The authorization code is temporary. Exchange it for a final access token using your terminal:

```bash
curl -X POST https://www.strava.com/oauth/token \
  -F client_id=[YOUR_CLIENT_ID] \
  -F client_secret=[YOUR_CLIENT_SECRET] \
  -F code=[YOUR_AUTHORIZATION_CODE] \
  -F grant_type=authorization_code
```

The response will be a JSON block. Look for the value labeled `"access_token"`.

##### d. Save the token to your `.env` file

1. In your project folder, create a file named `.env` (if it doesn't already exist).
2. Add your token value:

   ```bash
   STRAVA_ACCESS_TOKEN=your_token_string_here
   ```

The `upload.js` script looks for this exact variable name (`STRAVA_ACCESS_TOKEN`) to authenticate your requests.

#### 3. Prepare your data folder

Place all exported `.gpx` files from your Runtastic archive into the `runtastic_export` folder in the root of this project.

</details>

---

<details>
<summary><strong>📖 Usage Guide</strong></summary>

<br>

### Phase 1: Scan your data

Before uploading, run the scanner to verify your file count and activity types:

```bash
node scan.js
```

This prints a summary table showing how many runs, walks, and rides were detected.

### Phase 2: Bulk upload

Start the migration process:

```bash
node upload.js
```

The script will:

- Process your newest activities first.
- Move successfully uploaded files to the `successfully_imported` folder.
- Log each upload (with Strava links) to `output/report.md`.

</details>

---

<details>
<summary><strong>⚠️ Rate Limits & Safety</strong></summary>

<br>

Strava enforces strict limits on their API:

- **15-minute limit**: 200 requests.
- **Daily limit**: 2,000 requests.

**Safety measures in this script:**

- **Fail-graceful**: If a `429 Too Many Requests` error is encountered, the script immediately stops to protect your API standing.
- **Throttling**: The script is paced to process ~12 files per 15-minute window, staying safely under the short-term threshold.

</details>

---

<details>
<summary><strong>📂 Project Structure</strong></summary>

<br>

- `upload.js`: Main migration engine with upload and polling logic.
- `scan.js`: Utility to analyze your GPX export folder.
- `runtastic_export/`: Source folder for GPX files you want to import.
- `successfully_imported/`: Target folder for files after a successful upload.
- `output/report.md`: Cumulative log of all migrated activities.

</details>

