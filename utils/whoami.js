const fetch = require('node-fetch');

const config = require('../lib/config')();
const log = require('../lib/log')().child({ module: 'whoami' });
const { refreshAccessToken, accessTokenAuthHeader } = require('../lib/spotify');

async function main() {
  const { access_token: accessToken } = await refreshAccessToken();
  const profileResp = await fetch('https://api.spotify.com/v1/me', {
    headers: { ...accessTokenAuthHeader(accessToken) },
  });
  if (!profileResp.ok) {
    log.error(await profileResp.text());
    return;
  }
  log.info(await profileResp.json());
}

main().catch((err) => log.error(err));
