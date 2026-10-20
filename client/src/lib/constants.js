export const NAME_MAX = 16;
export const PIN_LENGTH = 6;

export const DIFFICULTIES = [
  { key: 'easy', label: 'ง่าย', pieces: 12 },
  { key: 'normal', label: 'ปกติ', pieces: 24 },
  { key: 'hard', label: 'ยาก', pieces: 48 },
  { key: 'expert', label: 'โหด', pieces: 96 },
];

export const ASPECTS = ['1:1', '3:4', '4:3', '5:6', '6:5', '2:3', '3:2', '9:16', '16:9'];
export const aspectParts = (key) => key.split(':').map(Number);

const MESSAGES = {
  BAD_NAME: 'กรุณาใส่ชื่อผู้เล่นก่อน',
  BAD_PIN: 'PIN ต้องเป็นตัวเลข 6 หลัก',
  NOT_FOUND: 'ไม่พบห้องนี้ ลองตรวจ PIN อีกครั้ง',
  FULL: 'ห้องนี้เต็มแล้ว',
  STARTED: 'ห้องนี้เริ่มเล่นไปแล้ว เข้าร่วมไม่ได้',
  RATE_LIMIT: 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่',
  NOT_HOST: 'ทำได้เฉพาะหัวหน้าห้อง',
  NO_IMAGE: 'ต้องแนบรูปก่อนเริ่มเกม',
  BELOW_CURRENT: 'ตอนนี้มีผู้เล่นในห้องมากกว่าจำนวนนี้แล้ว',
  BAD_IMAGE: 'ใช้รูปนี้ไม่ได้ (ต้องไม่เกิน 5 MB)',
  TIMEOUT: 'เซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง',
  ALREADY_IN_ROOM: 'คุณอยู่ในห้องอยู่แล้ว',
  BAD_PHASE: 'ทำอะไรตอนนี้ไม่ได้ เกมเริ่มไปแล้ว',
  NO_ROOM: 'ไม่ได้อยู่ในห้อง',
};

export function errorText(code, room) {
  if (code === 'NOT_ENOUGH_PLAYERS') return `ต้องมีผู้เล่นอย่างน้อย ${room?.minPlayers ?? 2} คนถึงเริ่มได้`;
  return MESSAGES[code] || 'มีบางอย่างผิดพลาด ลองใหม่อีกครั้ง';
}
