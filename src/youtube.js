import fs from 'fs';
import http from 'http';
import { URL } from 'url';
import { google } from 'googleapis';
import { YT_CLIENT_SECRET, YT_TOKEN } from './config.js';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
];

const REDIRECT_PORT = 3456;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

function loadClientSecrets() {
  if (!fs.existsSync(YT_CLIENT_SECRET)) {
    throw new Error(
      `Missing ${YT_CLIENT_SECRET}\n` +
        'Create an OAuth 2.0 Desktop client in Google Cloud Console,\n' +
        'enable YouTube Data API v3, download client_secret.json,\n' +
        'and place it at the project root.'
    );
  }
  return JSON.parse(fs.readFileSync(YT_CLIENT_SECRET, 'utf8'));
}

function createOAuthClient(secrets) {
  const { client_id, client_secret } = secrets.installed ?? secrets.web;
  return new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
}

function saveToken(tokens) {
  fs.writeFileSync(YT_TOKEN, JSON.stringify(tokens, null, 2));
}

function loadToken() {
  if (!fs.existsSync(YT_TOKEN)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(YT_TOKEN));
}

function waitForAuthCode(oauth2Client) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
        if (url.pathname !== '/oauth2callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400);
          res.end(`Authorization failed: ${error}`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400);
          res.end('Missing authorization code');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<h1>Authorization successful</h1><p>You can close this window and return to the terminal.</p>'
        );
        server.close();
        resolve(code);
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log('\nOpen this URL in your browser to authorize YouTube upload:\n');
      console.log(authUrl);
      console.log('');
    });

    server.on('error', reject);
  });
}

export async function getAuthClient() {
  const secrets = loadClientSecrets();
  const oauth2Client = createOAuthClient(secrets);

  const saved = loadToken();
  if (saved) {
    oauth2Client.setCredentials(saved);
    return oauth2Client;
  }

  console.log('[youtube] No cached token found. Starting OAuth flow...');
  const code = await waitForAuthCode(oauth2Client);
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  saveToken(tokens);
  console.log('[youtube] Token saved for future uploads.');
  return oauth2Client;
}

export async function uploadVideo(auth, { videoPath, title, description, tags, categoryId, privacyStatus }) {
  const youtube = google.youtube({ version: 'v3', auth });

  console.log('[youtube] Uploading video (resumable)...');

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        tags,
        categoryId,
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  const videoId = response.data.id;
  if (!videoId) {
    throw new Error('Upload succeeded but no video ID was returned.');
  }

  console.log(`[youtube] Upload complete. Video ID: ${videoId}`);
  return videoId;
}

export async function setThumbnail(auth, videoId, thumbnailPath) {
  const youtube = google.youtube({ version: 'v3', auth });

  console.log('[youtube] Setting custom thumbnail...');

  await youtube.thumbnails.set({
    videoId,
    media: {
      body: fs.createReadStream(thumbnailPath),
    },
  });

  console.log('[youtube] Thumbnail set.');
}
