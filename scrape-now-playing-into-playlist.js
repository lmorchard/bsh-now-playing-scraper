const fs = require('fs');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const {
  SPOTIFY_PLAYLIST_ID,
  SONGS_TXT_FN = 'songs.txt',
  MYSTERY_SONGS_TXT_FN = 'mystery-songs.txt',
  BSH_WIDGET_URL = 'https://widgets.autopo.st/widgets/public/DR66/recentlyplayed.php',
  INTERVAL = 60 * 1000,
} = require('./lib/config')();

const log = require('./lib/log')().child({
  name: 'scrape-now-playing-into-playlist',
});

const { clearAccessToken, fetchSpotify, fetchSpotifyAllPages } = require('./lib/spotify');

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
    clearAccessToken();
    await loadSeenTrackIdsFromPlaylist();
    const currSongs = await scrapeCurrentSongs();
    log.info({
      msg: 'current songs',
      songs: currSongs.map(({artist, title}) => ({artist, title})),
    });
    for (const song of currSongs) {
      await addSong(song);
    }
  } catch (err) {
    log.error({ msg: 'update error', error: err });
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
    const [artist, title] = cleanUpSong(song
      .split(' - ')
      .map((s) => $(`<span>${s}</span>`).text()));
    const [_, playedAt] = playedAtTxt.split('at ').map((s) => s.trim());
    const scrapedAt = Date.now();
    currSongs.push({ artist, title, playedAt, scrapedAt });
  });

  return currSongs;
}

function cleanUpSong(song) {
  let [ artist, title ] = song;
  if (artist === 'Bj╤årk' || artist === 'Bjцrk') {
    artist = 'Björk';
  }
  if (artist === 'Sinйad O\'Connor') {
    artist = 'Sinead O\'Connor';
  }
  if (artist === 'INKRДKTARE') {
    artist = 'INKRÄKTARE';
  }
  if (artist === 'Jуnsi') {
    artist = 'Jonsi';
  }
  if (artist === 'Sigur Roґs' || artist === 'Sigur Rуs') {
    artist = 'Sigur Ros';
  }
  if (artist === 'Massive Attack & Azekel') {
    artist = 'Massive Attack';
  }
  if (artist === 'The Sisters Of Mercy') {
    artist = 'Sisters Of Mercy';
  }
  if (artist === 'Rцyksopp') {
    artist = 'Royksopp';
  }
  title = title.replace(/''/g, "'");
  title = title.replace(/ \(.*\)/, '');
  title = title.replace('Draems', 'Dreams');
  return [ artist, title ];
}

async function addSong(song) {
  let searchResultCount = 0;
  let newTracksCount = 0;
  let isMysterious = false;

  const { artist, title } = song;
  const params = new URLSearchParams({
    type: 'track',
    q: `artist:"${artist}" ${title}`,
  });

  const result = await fetchSpotify(`search?${params.toString()}`);
  searchResultCount = result.tracks.items.length;

  if (result && result.tracks && result.tracks.items.length) {
    const tracksToAdd = result.tracks.items
      .slice(0, 1)
      .filter((track) => !seenTrackIds.includes(track.id));
    seenTrackIds.push(...tracksToAdd.map((track) => track.id));
    newTracksCount = tracksToAdd.length;

    await fetchSpotify(
      `playlists/${SPOTIFY_PLAYLIST_ID}/tracks`,
      {
        method: 'POST',
        body: JSON.stringify({
          uris: tracksToAdd.map((track) => track.uri),
        }),
      }
    );
  } else {
    isMysterious = true;
    fs.appendFileSync(
      MYSTERY_SONGS_TXT_FN,
      `${JSON.stringify({ artist: song.artist, title: song.title, params: params.toString() })}\n`
    );
  }
  log.info({
    msg: 'processed song',
    artist,
    title,
    searchParams: params.toString(),
    searchResultCount,
    newTracksCount,
    isMysterious,
  });
}

main().catch((err) => log.error(err));
