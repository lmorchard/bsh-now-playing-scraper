require('dotenv').config();

module.exports = () => {
  const {
    SPOTIFY_CLIENT_ID = null,
    SPOTIFY_CLIENT_SECRET = null,
  } = process.env;
  
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error('Spotift client ID and secret not configured');
    process.exit(1);
  }

  return process.env;
};
