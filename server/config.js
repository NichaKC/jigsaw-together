// ค่าตั้งต้นทั้งหมดของเซิร์ฟเวอร์อยู่ที่นี่ แก้ที่เดียวจบ
export const CONFIG = {
  PORT: Number(process.env.PORT) || 3001,

  // จำนวนผู้เล่น
  MIN_PLAYERS_TO_START: 2, // อยากให้เริ่มคนเดียวได้ (ไว้ทดสอบ) เปลี่ยนเป็น 1
  MAX_PLAYERS_LIMIT: 4,
  DEFAULT_MAX_PLAYERS: 2,

  NAME_MAX: 16,
  PIN_LENGTH: 6,
  MAX_IMAGE_BYTES: 5 * 1024 * 1024,

  // หลุดการเชื่อมต่อแล้วเก็บที่นั่งไว้นานแค่ไหนก่อนตัดออกจากห้อง
  GRACE_LOBBY_MS: 20_000,
  GRACE_PLAYING_MS: 3 * 60_000,
  ROOM_IDLE_TTL_MS: 30 * 60_000,

  // เกม: พิกัดทุกอย่างเป็นหน่วย "ความกว้างของภาพ = 1"
  MARGIN: 0.2, // ขอบโต๊ะรอบกระดานจิ๊กซอ
  SNAP_RATIO: 0.45, // วางใกล้ช่องจริงกี่เท่าของขนาดชิ้นแล้วจะดูดเข้าที่
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
