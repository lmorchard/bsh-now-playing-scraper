const express = require('express');
const fetch = require('node-fetch');

const {
  PORT = 8675,
  HOST = '192.168.0.13',
  SPOTIFY_CLIENT_ID = null,
  SPOTIFY_CLIENT_SECRET = null,
} = require('../lib/config')();

const log = require('../lib/log')().child({ module: 'auth' });

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error('Spotift client ID and secret not configured');
  process.exit(1);
}

const SCOPES = [
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'playlist-read-private',
  'user-library-modify',
  'user-library-read',
  'user-top-read',
  'user-read-recently-played',
];

const app = express();

app.use(require('pino-http')({ logger: log.child('auth-server') }));

app.get('/', (req, res) =>
  res.send(`
  <html>
    <body>
      <a href="${authorizeUrl()}">Authorize!</a>
    </body>
  </html>
`)
);

app.get('/authorize', async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    return res.send(`
      <html>
        <body>
          <dl>
            <dt>error</dt><dd>${error}</dd>
            <dt>state</dt><dd>${state}</dd>
          </dl>
        </body>
      </html>
    `);
  }

  const tokenResp = await fetch(`https://accounts.spotify.com/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
    }),
  });

  if (!tokenResp.ok) {
    return res.send(`
      <html>
        <body>
          <h1>NOT OK</h1>
          <dl>
            <dt>status</dt><dd>${tokenResp.status}</dd>
            <dt>body</dt><dd>${await tokenResp.text()}</dd>            
          </dl>
        </body>
      </html>
    `);
  }

  const tokenData = await tokenResp.json();

  res.send(`
    <html>
      <body>
        <h2>Query</h2>
        ${ddObject(req.query)}
        <h2>Token</h2>
        ${ddObject(tokenData)}
        <h2>.env</h2>
        <textarea style="width: 100%; height: 5em">SPOTIFY_ACCESS_TOKEN=${tokenData.access_token}
SPOTIFY_REFRESH_TOKEN=${tokenData.refresh_token}</textarea>
      </body>
    </html>
  `);
});

app.listen(PORT, HOST, () =>
  console.log(`Example app listening at http://${HOST}:${PORT}`)
);

function ddObject(obj) {
  return `
    <dl>
      ${Object.entries(obj)
        .map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`)
        .join('\n')}
    </dl>
  `;
}

function redirectUri() {
  return `http://${HOST}:${PORT}/authorize`;
}

function authorizeUrl() {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    state: 'state-noop',
    scope: SCOPES.join(' '),
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}
