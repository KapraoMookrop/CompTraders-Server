import { google } from 'googleapis';
import { ENV } from './env.js';

const oauth2Client = new google.auth.OAuth2(
  ENV.GOOGLE_CLIENT_ID,
  ENV.GOOGLE_CLIENT_SECRET,
  ENV.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: ENV.GOOGLE_REFRESH_TOKEN
});

export const drive = google.drive({
  version: 'v3',
  auth: oauth2Client,
});