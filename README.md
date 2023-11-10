# Big Sonic Heaven Spy

This is a script which periodically polls for the current song playing at
[Big Sonic Heaven](https://bigsonicheaven.com). It then attempts to look
that song up on Spotify and automatically add it to a playlist.

Hopefully, this is a current example of just such a playlist:
- https://open.spotify.com/playlist/1xBbvEJrf5HycEZbwn04o1?si=bc7657cdb8c84fbe

## Configuration

These are instructions that hopefully future-me will understand, but they might help someone else too:

- Copy `.env.example` to `.env`

- Set `LOG_LEVEL=info` or `LOG_LEVEL=trace` or whatever

- Create a new playlist on Spotify, right click and "Share" then "Copy link to playlist"
  - The last path component of this URL is your playlist ID (not including query param)
  - https://open.spotify.com/playlist/1xBbvEJrf5HycEZbwn04o1?si=7ac1de5cd76e4216

- Add the playlist ID to `.env`
  - `SPOTIFY_PLAYLIST_ID=1xBbvEJrf5HycEZbwn04o1`

- Create a new Spotify app at https://developer.spotify.com/dashboard
  - Be sure to add a "Redirect URI" for a machine on your network - e.g. `http://192.168.0.234:8675/authorize`

- Add the client ID and Secret to `.env`, for example:
  - `SPOTIFY_CLIENT_ID=daae(REDACTED)`
  - `SPOTIFY_CLIENT_SECRET=fca11(REDACTED)`

- Run `./utils/auth.js` on a dev machine, which by default starts a small web app on port `8675`
  - You can specify `HOST` and `PORT` env vars to alter default behavior'
  - Open the app (e.g. `http://192.168.0.234:8675`) and click "Authorize"
  - Perform the Spotify OAuth login and permission dance
  - If you set the correct "Redirect URI" for your Spotify app earlier, there should be an `.env` section at the bottom of the resulting page tokens to copy & paste into `.env` - e.g.:
    - `SPOTIFY_ACCESS_TOKEN=BQD(REDACTED)`
    - `SPOTIFY_REFRESH_TOKEN=AQCIO(REDACTED)`

- Finally, run `npm install && ./start.sh`
  - Or, better yet:
    ```
    mkdir data
    docker run --restart unless-stopped -v `pwd`/data:/app/data -d lmorchard/bsh-spy
    ```

- Later, check out the `utils` directory for misc scripts and crap
