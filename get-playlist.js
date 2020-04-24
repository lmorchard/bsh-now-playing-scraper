const log = require('./lib/log')().child({ module: 'get-playlist' });
const { fetchSpotify, fetchPlaylistItems } = require('./lib/spotify');

const { SPOTIFY_PLAYLIST_ID } = require('./lib/config')();

async function main() {
  const items = await fetchPlaylistItems(SPOTIFY_PLAYLIST_ID);
  const ids = items.map(item => item.track.id);

  log.debug({ ids });
}

main().catch((err) => log.error(err));
