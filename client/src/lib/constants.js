export const NAME_MAX = 16;
export const PIN_LENGTH = 6;

export const DIFFICULTIES = [
  { key: 'easy', pieces: 12 },
  { key: 'normal', pieces: 24 },
  { key: 'hard', pieces: 48 },
  { key: 'expert', pieces: 96 },
];

export const ASPECTS = ['1:1', '3:4', '4:3', '5:6', '6:5', '2:3', '3:2', '9:16', '16:9'];
export const aspectParts = (key) => key.split(':').map(Number);
