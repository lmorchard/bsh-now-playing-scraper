const log = require('./lib/log')().child({ module: 'whoami' });
const { fetchSpotify } = require('./lib/spotify');

async function main() {
  const data = await fetchSpotify('me/playlists');
  for (const item of data.items) {
    log.info({ id: item.id, itemName: item.name });
  }
}

main().catch((err) => log.error(err));
