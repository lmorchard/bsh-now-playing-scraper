const fs = require('fs');
const ndjson = require('ndjson');
const { default: PQueue } = require('p-queue');

const {
  SONGS_TXT_FN = 'songs.txt',
  MYSTERY_SONGS_TXT_FN = 'mystery-songs.txt',
  SPOTIFY_PLAYLIST_ID,
} = require('../lib/config')();

const log = require('../lib/log')().child({
  module: 'add-tracks-from-songs-txt',
});

const { fetchSpotify, fetchSpotifyAllPages } = require('../lib/spotify');

const queue = new PQueue({
  concurrency: 1,
  timeout: 10000,
  interval: 500,
  intervalCap: 1,
  carryoverConcurrencyCount: true,
});

const seenTrackIds = [];

async function main() {
  await loadSeenTrackIdsFromPlaylist();
  fs.createReadStream(SONGS_TXT_FN)
    .pipe(ndjson.parse())
    .on('data', (song) => queue.add(() => searchSong(song)));
}

async function loadSeenTrackIdsFromPlaylist() {
  const items = await fetchSpotifyAllPages(
    `playlists/${SPOTIFY_PLAYLIST_ID}/tracks`
  );
  seenTrackIds.push(...items.map((item) => item.track.id));
}

async function searchSong(song) {
  const params = new URLSearchParams({
    type: 'track',
    q: `artist:"${song.artist}" track:"${song.title}"`,
  });
  log.debug({ /* song, */ params: params.toString() });
  const result = await fetchSpotify(`search?${params.toString()}`);
  if (result.tracks && result.tracks.items.length) {
    log.info({ msg: `Found ${result.tracks.items.length} tracks in search`, song });
    const tracksToAdd = result.tracks.items
      .slice(0, 1)
      .filter((track) => !seenTrackIds.includes(track.id));
    seenTrackIds.push(...tracksToAdd.map((track) => track.id));
    log.info({ msg: `Found ${tracksToAdd.length} new tracks`, song });
    await addTracksToPlaylist(tracksToAdd);
    fs.appendFileSync(
      SONGS_TXT_FN,
      `${JSON.stringify({ song, params: params.toString() })}\n`
    );
  } else {
    fs.appendFileSync(
      MYSTERY_SONGS_TXT_FN,
      `${JSON.stringify({ song, params: params.toString() })}\n`
    );
  }
}

async function addTracksToPlaylist(tracks) {
  const result = await fetchSpotify(`playlists/${SPOTIFY_PLAYLIST_ID}/tracks`, {
    method: 'POST',
    body: JSON.stringify({
      uris: tracks.map((track) => track.uri),
    }),
  });
  log.info({ msg: 'added tracks', result });
}

main().catch((err) => log.error(err));
