import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadLang, saveLang } from './lib/session.js';

// Each value is a string or a function of params. Keep both languages in sync.
const en = {
  'app.name': 'Jigsaw Together',
  'app.tagline': 'Solve puzzles with friends in real time. 2–4 players.',
  'lang.label': 'Language',
  'conn.connecting': 'Connecting to server…',
  'restore.text': 'Rejoining your room…',
  'restore.cancel': 'Cancel',
  'notice.kicked': 'The host removed you from the room.',
  'notice.closed': 'That room has closed, or you were removed from it.',
  'notice.dismiss': 'Dismiss',

  'home.start': 'Get started',
  'home.nameLabel': 'Your name',
  'home.namePlaceholder': 'e.g. Clash',
  'home.nameHint': 'You can only change your name on this page. Once you join a room it stays the same.',
  'home.create': 'Create a room',
  'home.or': 'or join a friend’s room',
  'home.pinLabel': 'Room PIN',
  'home.join': 'Join',

  'lobby.pinCaption': 'Room PIN. Share it so friends can join from the home page.',
  'lobby.pinAria': ({ pin }) => `Room PIN ${pin.split('').join(' ')}`,
  'lobby.copyPin': 'Copy PIN',
  'lobby.copyLink': 'Copy link',
  'lobby.copied': 'Copied',
  'lobby.players': ({ n, max }) => `Players ${n}/${max}`,
  'lobby.empty': 'Waiting for a player…',
  'lobby.host': 'Host',
  'lobby.you': 'You',
  'lobby.offline': 'Disconnected',
  'lobby.kick': 'Kick',
  'lobby.kickAria': ({ name }) => `Kick ${name} from the room`,
  'lobby.maxPlayers': 'Max players',
  'lobby.nPlayers': ({ n }) => `${n} players`,
  'lobby.difficulty': 'Difficulty',
  'diff.easy': 'Easy',
  'diff.normal': 'Normal',
  'diff.hard': 'Hard',
  'diff.expert': 'Extreme',
  'lobby.gridInfo': ({ cols, rows, n }) => `${cols} × ${rows} = ${n} pieces`,
  'lobby.gridEstimate': ({ n }) => `About ${n} pieces (depends on the image shape)`,
  'lobby.image': 'Puzzle image',
  'lobby.imageAlt': 'The image this puzzle will use',
  'lobby.noImage1': 'No image yet',
  'lobby.noImage2': 'Anyone in the room can add one',
  'lobby.addedBy': ({ name, aspect }) => `Added by ${name} (${aspect})`,
  'lobby.chooseImage': 'Choose an image',
  'lobby.changeImage': 'Change image',
  'lobby.sample': 'Use a sample image',
  'lobby.start': 'Start game',
  'lobby.needImage': 'Add an image before starting.',
  'lobby.needPlayers': ({ n }) => `You need at least ${n} players to start.`,
  'lobby.waiting': ({ name }) => `Waiting for ${name} to start the game`,
  'lobby.hostFallback': 'the host',
  'lobby.leave': 'Leave room',

  'crop.dialog': 'Crop image for the puzzle',
  'crop.title': 'Pick the puzzle shape',
  'crop.ratioGroup': 'Aspect ratio',
  'crop.alt': 'Image being cropped',
  'crop.zoom': 'Zoom',
  'crop.lowRes': 'This image is fairly low resolution, so the puzzle may look soft.',
  'crop.cancel': 'Cancel',
  'crop.confirm': 'Use this image',
  'crop.working': 'Preparing image…',
  'crop.opening': 'Opening image…',
  'crop.close': 'Close',
  'crop.openError': 'Couldn’t open this image. Try a JPG or PNG file.',
  'crop.exportError': 'Couldn’t convert the image. Try again.',

  'game.progress': ({ done, total }) => `${done}/${total} pieces`,
  'game.playersAria': 'Players',
  'game.you': 'you',
  'game.hintShow': 'Show hint',
  'game.hintHide': 'Hide hint',
  'game.leave': 'Leave',
  'game.canvasAria': 'Puzzle board. Drag pieces to match the picture.',
  'game.leaveTitle': 'Leave this game?',
  'game.leaveBody': 'Your friends can keep playing, but you can’t rejoin once you leave.',
  'game.keepPlaying': 'Keep playing',
  'game.leaveConfirm': 'Leave game',
  'game.done': 'Puzzle complete!',
  'game.time': ({ time }) => `Time: ${time}`,
  'game.pieces': ({ n }) => (n === 1 ? '1 piece' : `${n} pieces`),
  'game.home': 'Back to home',

  'err.BAD_NAME': 'Enter a player name first.',
  'err.BAD_PIN': 'The PIN must be 6 digits.',
  'err.NOT_FOUND': 'Room not found. Check the PIN and try again.',
  'err.FULL': 'This room is full.',
  'err.STARTED': 'This game has already started, so you can’t join.',
  'err.RATE_LIMIT': 'Too many attempts. Wait a moment and try again.',
  'err.NOT_HOST': 'Only the host can do that.',
  'err.NO_IMAGE': 'Add an image before starting.',
  'err.BELOW_CURRENT': 'There are already more players in the room than that.',
  'err.BAD_IMAGE': 'That image can’t be used (max 5 MB).',
  'err.TIMEOUT': 'The server didn’t respond. Try again.',
  'err.ALREADY_IN_ROOM': 'You’re already in a room.',
  'err.BAD_PHASE': 'You can’t do that now. The game has already started.',
  'err.NO_ROOM': 'You’re not in a room.',
  'err.NOT_ENOUGH_PLAYERS': ({ n }) => `You need at least ${n} players to start.`,
  'err.default': 'Something went wrong. Try again.',
};

const th = {
  'app.name': 'จิ๊กซอด้วยกัน',
  'app.tagline': 'ต่อภาพกับเพื่อนแบบเรียลไทม์ 2–4 คน',
  'lang.label': 'ภาษา',
  'conn.connecting': 'กำลังเชื่อมต่อเซิร์ฟเวอร์…',
  'restore.text': 'กำลังกลับเข้าห้อง…',
  'restore.cancel': 'ยกเลิก',
  'notice.kicked': 'หัวหน้าห้องเชิญคุณออกจากห้อง',
  'notice.closed': 'ห้องนี้ปิดไปแล้ว หรือคุณถูกนำออกจากห้อง',
  'notice.dismiss': 'ปิด',

  'home.start': 'เริ่มเล่น',
  'home.nameLabel': 'ชื่อของคุณ',
  'home.namePlaceholder': 'เช่น Clash',
  'home.nameHint': 'เปลี่ยนชื่อได้เฉพาะหน้านี้ พอเข้าห้องแล้วจะเปลี่ยนไม่ได้',
  'home.create': 'สร้างห้องใหม่',
  'home.or': 'หรือเข้าห้องของเพื่อน',
  'home.pinLabel': 'PIN ห้อง',
  'home.join': 'เข้าร่วม',

  'lobby.pinCaption': 'PIN ห้อง ส่งให้เพื่อนกรอกที่หน้าแรก',
  'lobby.pinAria': ({ pin }) => `PIN ห้อง ${pin.split('').join(' ')}`,
  'lobby.copyPin': 'คัดลอก PIN',
  'lobby.copyLink': 'คัดลอกลิงก์',
  'lobby.copied': 'คัดลอกแล้ว',
  'lobby.players': ({ n, max }) => `ผู้เล่น ${n}/${max}`,
  'lobby.empty': 'รอผู้เล่น…',
  'lobby.host': 'หัวหน้าห้อง',
  'lobby.you': 'คุณ',
  'lobby.offline': 'หลุดการเชื่อมต่อ',
  'lobby.kick': 'เตะ',
  'lobby.kickAria': ({ name }) => `เตะ ${name} ออกจากห้อง`,
  'lobby.maxPlayers': 'จำนวนผู้เล่นสูงสุด',
  'lobby.nPlayers': ({ n }) => `${n} คน`,
  'lobby.difficulty': 'ระดับความยาก',
  'diff.easy': 'ง่าย',
  'diff.normal': 'ปกติ',
  'diff.hard': 'ยาก',
  'diff.expert': 'โหด',
  'lobby.gridInfo': ({ cols, rows, n }) => `${cols} × ${rows} = ${n} ชิ้น`,
  'lobby.gridEstimate': ({ n }) => `ประมาณ ${n} ชิ้น (ขึ้นกับสัดส่วนรูป)`,
  'lobby.image': 'รูปจิ๊กซอ',
  'lobby.imageAlt': 'รูปที่จะใช้ต่อจิ๊กซอ',
  'lobby.noImage1': 'ยังไม่มีรูป',
  'lobby.noImage2': 'ใครในห้องก็แนบได้',
  'lobby.addedBy': ({ name, aspect }) => `แนบโดย ${name} (${aspect})`,
  'lobby.chooseImage': 'เลือกรูปจากเครื่อง',
  'lobby.changeImage': 'เปลี่ยนรูป',
  'lobby.sample': 'ใช้รูปตัวอย่าง',
  'lobby.start': 'เริ่มเล่น',
  'lobby.needImage': 'แนบรูปก่อนถึงจะเริ่มได้',
  'lobby.needPlayers': ({ n }) => `ต้องมีผู้เล่นอย่างน้อย ${n} คน`,
  'lobby.waiting': ({ name }) => `รอ ${name} กดเริ่มเกม`,
  'lobby.hostFallback': 'หัวหน้าห้อง',
  'lobby.leave': 'ออกจากห้อง',

  'crop.dialog': 'ครอปรูปสำหรับจิ๊กซอ',
  'crop.title': 'เลือกสัดส่วนของจิ๊กซอ',
  'crop.ratioGroup': 'สัดส่วนภาพ',
  'crop.alt': 'รูปที่กำลังครอป',
  'crop.zoom': 'ซูม',
  'crop.lowRes': 'รูปนี้ความละเอียดค่อนข้างต่ำ จิ๊กซอจะไม่คมนัก',
  'crop.cancel': 'ยกเลิก',
  'crop.confirm': 'ใช้รูปนี้',
  'crop.working': 'กำลังเตรียมรูป…',
  'crop.opening': 'กำลังเปิดรูป…',
  'crop.close': 'ปิด',
  'crop.openError': 'เปิดไฟล์รูปนี้ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG',
  'crop.exportError': 'แปลงรูปไม่สำเร็จ ลองใหม่อีกครั้ง',

  'game.progress': ({ done, total }) => `${done}/${total} ชิ้น`,
  'game.playersAria': 'ผู้เล่น',
  'game.you': 'คุณ',
  'game.hintShow': 'แสดงตัวช่วย',
  'game.hintHide': 'ซ่อนตัวช่วย',
  'game.leave': 'ออก',
  'game.canvasAria': 'กระดานจิ๊กซอ ลากชิ้นส่วนไปวางให้ตรงกับภาพ',
  'game.leaveTitle': 'ออกจากเกมนี้?',
  'game.leaveBody': 'เพื่อนจะเล่นต่อได้ แต่คุณกลับเข้ามาที่เดิมไม่ได้ถ้ากดออกแล้ว',
  'game.keepPlaying': 'เล่นต่อ',
  'game.leaveConfirm': 'ออกจากเกม',
  'game.done': 'ต่อภาพสำเร็จแล้ว!',
  'game.time': ({ time }) => `ใช้เวลา ${time}`,
  'game.pieces': ({ n }) => `${n} ชิ้น`,
  'game.home': 'กลับหน้าหลัก',

  'err.BAD_NAME': 'กรุณาใส่ชื่อผู้เล่นก่อน',
  'err.BAD_PIN': 'PIN ต้องเป็นตัวเลข 6 หลัก',
  'err.NOT_FOUND': 'ไม่พบห้องนี้ ลองตรวจ PIN อีกครั้ง',
  'err.FULL': 'ห้องนี้เต็มแล้ว',
  'err.STARTED': 'ห้องนี้เริ่มเล่นไปแล้ว เข้าร่วมไม่ได้',
  'err.RATE_LIMIT': 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่',
  'err.NOT_HOST': 'ทำได้เฉพาะหัวหน้าห้อง',
  'err.NO_IMAGE': 'ต้องแนบรูปก่อนเริ่มเกม',
  'err.BELOW_CURRENT': 'ตอนนี้มีผู้เล่นในห้องมากกว่าจำนวนนี้แล้ว',
  'err.BAD_IMAGE': 'ใช้รูปนี้ไม่ได้ (ต้องไม่เกิน 5 MB)',
  'err.TIMEOUT': 'เซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง',
  'err.ALREADY_IN_ROOM': 'คุณอยู่ในห้องอยู่แล้ว',
  'err.BAD_PHASE': 'ทำอะไรตอนนี้ไม่ได้ เกมเริ่มไปแล้ว',
  'err.NO_ROOM': 'ไม่ได้อยู่ในห้อง',
  'err.NOT_ENOUGH_PLAYERS': ({ n }) => `ต้องมีผู้เล่นอย่างน้อย ${n} คนถึงเริ่มได้`,
  'err.default': 'มีบางอย่างผิดพลาด ลองใหม่อีกครั้ง',
};

const DICTS = { en, th };
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(loadLang);

  const setLang = useCallback((next) => {
    setLangState(next);
    saveLang(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = DICTS[lang]['app.name'];
  }, [lang]);

  const value = useMemo(() => {
    const t = (key, params) => {
      const v = DICTS[lang][key] ?? en[key] ?? key;
      return typeof v === 'function' ? v(params ?? {}) : v;
    };
    // Translate a server error code, falling back to a generic message.
    const te = (code, params) => t(`err.${code}` in en ? `err.${code}` : 'err.default', params);
    return { lang, setLang, t, te };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
