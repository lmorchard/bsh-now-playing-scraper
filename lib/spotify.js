const fetch = require('node-fetch');

const {
  SPOTIFY_CLIENT_ID = null,
  SPOTIFY_CLIENT_SECRET = null,
  SPOTIFY_ACCESS_TOKEN = null,
  SPOTIFY_REFRESH_TOKEN = null,
  SPOTIFY_CONCURRENCY = 1,
  MAX_RETRIES = 3,
} = require('./config')();

const log = require('./log')();

const API_BASE_URL = 'https://api.spotify.com/v1';

const { default: PQueue } = require('p-queue');

const apiQueue = new PQueue({
  concurrency: SPOTIFY_CONCURRENCY,
  timeout: 10000,
  interval: 500,
  intervalCap: 1,
  carryoverConcurrencyCount: true,
});

async function refreshAccessToken() {
  const tokenResp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...clientIdAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
  });

  if (!tokenResp.ok) {
    throw new Error('failed to refresh token');
  }

  return await tokenResp.json();
}

let _currAccessToken = null;
async function accessToken(forceRefresh = false) {
  if (forceRefresh || !_currAccessToken) {
    ({ access_token: _currAccessToken } = await refreshAccessToken());
  }
  return _currAccessToken;
}

function clearAccessToken() {
  _currAccessToken = null;
}

class RateLimitError extends Error {
  constructor(retryAfter, ...params) {
    super(...params);
    Object.assign(this, {
      type: 'RateLimitError',
      retryAfter,
    });
  }
}

class NotOkError extends Error {
  constructor(status, response, ...params) {
    super(...params);
    Object.assign(this, {
      type: 'NotOkError',
      status,
      response,
    });
  }
}

let _pauseTimer = null;
function pauseQueueFor(duration = 1000) {
  log.warn({ msg: `Pausing queue for ${duration}` });
  if (_pauseTimer) {
    clearTimeout(_pauseTimer);
  }
  queue.pause();
  _pauseTimer = setTimeout(() => queue.start(), duration);
}

const enqueueWithRetry = async (task, maxRetries = MAX_RETRIES) => {
  let retryCount = 0;
  while (retryCount < maxRetries) {
    try {
      return await apiQueue.add(task);
    } catch (err) {
      if (err.type === 'RateLimitError') {
        pauseQueueFor(err.retryAfter * 1000);
      }
      if (retryCount < MAX_RETRIES) {
        retryCount++;
      } else {
        throw err;
      }
    }
  }
};

const fetchSpotify = (path, opts = {}) =>
  enqueueWithRetry(async () => {
    const { headers: optsHeaders = {}, ...restOfOpts } = opts;
    const headers = {
      'Content-Type': 'application/json',
      ...optsHeaders,
      ...accessTokenAuthHeader(await accessToken()),
    };
    const resp = await fetch(
      path.startsWith(API_BASE_URL) ? path : `${API_BASE_URL}/${path}`,
      {
        headers,
        ...restOfOpts,
      }
    );
    if (!resp.ok) {
      if (resp.status === 429) {
        const { 'Retry-After': retryAfter = 3 } = resp.headers;
        throw new RateLimitError(retryAfter);
      } else {
        throw new NotOkError(resp.status, resp, await resp.text());
      }
    }
    return resp.json();
  });

async function fetchPlaylistItems(playlistId) {
  return fetchSpotifyAllPages(`playlists/${playlistId}/tracks`);
}

async function fetchSpotifyAllPages(path) {
  const allItems = [];
  let next = path;
  while (next) {
    const result = await fetchSpotify(next);
    allItems.push(...result.items);
    next = result.next;
  }
  return allItems;
}

function accessTokenAuthHeader(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function clientIdAuthHeader() {
  return {
    Authorization: `Basic ${Buffer.from(
      `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
    ).toString('base64')}`,
  };
}

module.exports = {
  clientIdAuthHeader,
  accessTokenAuthHeader,
  refreshAccessToken,
  clearAccessToken,
  fetchSpotify,
  fetchSpotifyAllPages,
  fetchPlaylistItems,
  enqueueWithRetry,
  RateLimitError,
  NotOkError,
};
