const fetch = require('node-fetch');
const cheerio = require('cheerio');

const {
  SPOTIFY_PLAYLIST_ID,
  BSH_WIDGET_URL = 'https://widgets.autopo.st/widgets/public/DR66/recentlyplayed.php',
  INTERVAL = 60 * 1000,
} = require('./lib/config')();

const log = require('./lib/log')().child({
  module: 'scrape-now-playing-into-playlist',
});

const { fetchSpotify, fetchSpotifyAllPages } = require('./lib/spotify');

let seenTrackIds = [];

async function main() {
  update();
  setInterval(update, INTERVAL);
}

async function loadSeenTrackIdsFromPlaylist() {
  const items = await fetchSpotifyAllPages(
    `playlists/${SPOTIFY_PLAYLIST_ID}/tracks`
  );
  seenTrackIds = items.map((item) => item.track.id);
}

async function update() {
  try {
    await loadSeenTrackIdsFromPlaylist();
    const currSongs = await scrapeCurrentSongs();
    console.log(Date.now(), currSongs);
    for (const song of currSongs) {
      await addSong(song);
    }
  } catch (err) {
    console.error('update', err);
  }
}

async function scrapeCurrentSongs() {
  const req = await fetch(BSH_WIDGET_URL);
  const src = await req.text();
  const $ = cheerio.load(src);

  const currSongs = [];
  $('table tr').each((idx, row) => {
    const img = $(row).find('img').attr('src');
    const [song, playedAtTxt] = $($(row).find('td')[1])
      .html()
      .split('<br>')
      .slice(0, 2)
      .map((field) => field.split('>')[1]);
    const [artist, title] = song
      .split(' - ')
      .map((s) => $(`<span>${s}</span>`).text());
    const [_, playedAt] = playedAtTxt.split('at ').map((s) => s.trim());
    const scrapedAt = Date.now();
    currSongs.push({ artist, title, playedAt, scrapedAt });
  });

  return currSongs;
}

async function addSong(song) {
  const params = new URLSearchParams({
    type: 'track',
    q: `artist:${song.artist} ${song.title}`,
  });
  log.info({
    msg: 'searching for song',
    song,
    params: params.toString(),
  });
  const result = await fetchSpotify(`search?${params.toString()}`);

  if (result && result.tracks && result.tracks.items.length) {
    const tracksToAdd = result.tracks.items
      .slice(0, 1)
      .filter((track) => !seenTrackIds.includes(track.id));
    seenTrackIds.push(...tracksToAdd.map((track) => track.id));

    log.info({ msg: `Found ${tracksToAdd.length} new tracks`, song });
    const trackAddResult = await fetchSpotify(
      `playlists/${SPOTIFY_PLAYLIST_ID}/tracks`,
      {
        method: 'POST',
        body: JSON.stringify({
          uris: tracksToAdd.map((track) => track.uri),
        }),
      }
    );
    log.info({ msg: 'added tracks', trackAddResult });
  }
}

main().catch((err) => log.error(err));
