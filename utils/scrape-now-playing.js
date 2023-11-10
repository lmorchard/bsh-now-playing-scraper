const util = require("util");
const fs = require("fs");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const SONGS_FN = "songs.txt";
const BSH_WIDGET_URL =
  "https://widgets.autopo.st/widgets/public/DR66/recentlyplayed.php";
const MAX_LAST = 10;
const INTERVAL = 20 * 1000;

async function main() {
  update();
  setInterval(update, INTERVAL);
}

async function update() {
  try {
    const lastSongs = loadLastSongs();
    const currSongs = await scrapeCurrentSongs();
    console.log(Date.now(), currSongs);
    appendNewSongs(lastSongs, currSongs);
  } catch (err) {
    console.error('update', err);
  }
}

function loadLastSongs() {
  try {
    return fs
      .readFileSync(SONGS_FN, "UTF8")
      .trim()
      .split("\n")
      .slice(0 - MAX_LAST)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (err) {
          return null;
        }
      })
      .filter((item) => !!item);
  } catch (err) {
    // no-op
    console.error(err);
    return [];
  }
}

async function scrapeCurrentSongs() {
  const req = await fetch(BSH_WIDGET_URL);
  const src = await req.text();
  const $ = cheerio.load(src);

  const currSongs = [];
  $("table tr").each((idx, row) => {
    const img = $(row).find("img").attr("src");
    const [song, playedAtTxt] = $($(row).find("td")[1])
      .html()
      .split("<br>")
      .slice(0, 2)
      .map((field) => field.split(">")[1]);
    const [artist, title] = song.split(" - ").map(s => $(`<span>${s}</span>`).text());
    const [_, playedAt] = playedAtTxt.split("at ").map((s) => s.trim());
    const scrapedAt = Date.now();
    currSongs.push({ artist, title, playedAt, scrapedAt });
  });

  return currSongs;
}

function appendNewSongs(lastSongs, currSongs) {
  for (const item of currSongs) {
    let found = false;
    for (const lastItem of lastSongs) {
      if (lastItem.artist === item.artist && lastItem.title === item.title) {
        found = true;
      }
    }
    if (!found) {
      fs.appendFileSync(SONGS_FN, `${JSON.stringify(item)}\n`);
    }
  }
}

main().catch(console.error);
