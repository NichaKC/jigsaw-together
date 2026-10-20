// All server settings live here.
export const CONFIG = {
  PORT: Number(process.env.PORT) || 3001,

  // Players
  MIN_PLAYERS_TO_START: 2, // set to 1 to allow solo starts (handy for testing)
  MAX_PLAYERS_LIMIT: 4,
  DEFAULT_MAX_PLAYERS: 2,

  NAME_MAX: 16,
  PIN_LENGTH: 6,
  MAX_IMAGE_BYTES: 5 * 1024 * 1024,

  // How long a disconnected player's seat is kept before they're removed from the room
  GRACE_LOBBY_MS: 20_000,
  GRACE_PLAYING_MS: 3 * 60_000,
  ROOM_IDLE_TTL_MS: 30 * 60_000,

  // Game: all coordinates use units where the image width = 1
  MARGIN: 0.2, // table margin around the puzzle board
  SNAP_RATIO: 0.45, // how close (as a fraction of piece size) a drop must be to snap into place
};

export const DIFFICULTIES = {
  easy: { pieces: 12 },
  normal: { pieces: 24 },
  hard: { pieces: 48 },
  expert: { pieces: 96 },
};

export const ASPECTS = ['1:1', '3:4', '4:3', '5:6', '6:5', '2:3', '3:2', '9:16', '16:9'];

export const PLAYER_COLORS = [
  '#FF3B7F', '#00B7D4', '#FFB300', '#8A5CFF',
  '#2ED573', '#FF6A2B', '#1E90FF', '#E040FB',
];
