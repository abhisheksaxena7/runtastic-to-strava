# Strava Bulk Uploader

A Node.js script to bulk upload `.gpx` files (like a Runtastic/Adidas Running export) to Strava, bypassing the manual web uploader limits.

## Prerequisites: Getting Your Access Token

By default, Strava API tokens are read-only. To upload files, you need to generate a token with `activity:write` permissions. Here is how to do it:

### Step 1: Create a Strava API Application

1. Go to your [Strava API Settings](https://www.strava.com/settings/api).
2. Fill out the form to create a new app. The exact details don't matter much, EXCEPT:
   - **Authorization Callback Domain:** You MUST enter `localhost` here.
3. Click Create.
4. On the next page, take note of your **Client ID** and **Client Secret**.

### Step 2: Authorize the App

You need to explicitly grant your new app permission to upload data to your account.

1. Copy the following URL, replace `[YOUR_CLIENT_ID]` with your actual Client ID, and paste it into your browser:
   `http://www.strava.com/oauth/authorize?client_id=[YOUR_CLIENT_ID]&response_type=code&redirect_uri=http://localhost/exchange_token&approval_prompt=force&scope=activity:write`
2. Click **Authorize** on the Strava page that appears.
3. Your browser will redirect to a broken `localhost` page (e.g., "This site can't be reached"). This is expected!
4. Look at the URL in your browser's address bar. It will look like this:
   `http://localhost/exchange_token?state=&code=YOUR_AUTHORIZATION_CODE&scope=read,activity:write`
5. Copy the exact string of characters that comes right after `code=` and before `&scope`. This is your Authorization Code.

### Step 3: Exchange the Code for an Access Token

Now, trade that code for your final write-access token using your terminal.

Run this `curl` command, replacing the bracketed values with your own:

```bash
curl -X POST [https://www.strava.com/oauth/token](https://www.strava.com/oauth/token) \
  -F client_id=[YOUR_CLIENT_ID] \
  -F client_secret=[YOUR_CLIENT_SECRET] \
  -F code=[YOUR_AUTHORIZATION_CODE] \
  -F grant_type=authorization_code
```

## Step 4: Installation & Setup

Since this repository already contains the Node.js project, you just need to clone it and install the required dependencies.

1. Clone the repository to your local machine:

   ```bash
   git clone [https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git)
   cd YOUR_REPO_NAME
   ```

2. Install the necessary packages (axios, form-data, and dotenv):
   ```bash
   npm install
   ```

## Step 5: Secure Your Access Token

It is crucial to keep your access token safe. This project uses a `.env` file to securely load your credentials without hardcoding them into the script.

1. Create a file named `.env` in the root directory of the project.
2. Paste your access token inside exactly like this (no quotes needed):
   ```env
   STRAVA_ACCESS_TOKEN=your_access_token_here
   ```

Here is the exact Markdown for Steps 5, 6, 7, and the rate limit warning, ready for you to copy and paste directly into your `README.md`:

````markdown
## Step 5: Secure Your Access Token

It is crucial to keep your access token safe. This project uses a `.env` file to securely load your credentials without hardcoding them into the script.

1. Create a file named `.env` in the root directory of the project.
2. Paste your access token inside exactly like this (no quotes needed):
   ```env
   STRAVA_ACCESS_TOKEN=your_access_token_here
   ```
````

_(Note: The provided `.gitignore` file ensures your `.env` file will never be accidentally committed back to GitHub)._

## Step 6: Prepare Your GPX Data

1. Create a folder named `runtastic_export` in the root directory of this project.
2. Extract all of your `.gpx` files from your Runtastic/Adidas Running archive and place them inside this folder.
   _(Note: The `.gitignore` file also prevents your personal GPS data from being pushed to the repository)._

## Step 7: Run the Migration

Once your `.env` file is saved and your `.gpx` files are sitting in the `runtastic_export` folder, you are ready to start the upload process.

Run the following command in your terminal:

```bash
node upload.js

```

## ⚠️ Important: Strava API Rate Limits

Strava enforces strict rate limits on their API to prevent server overload:

- **200 requests every 15 minutes**
- **2,000 requests per day**

The `upload.js` script handles this automatically. It includes a built-in 5-second delay between each upload request, safely pacing the uploads at 12 per minute. This keeps you well below the 15-minute threshold and ensures a smooth, uninterrupted migration without hitting a 429 "Too Many Requests" error.
