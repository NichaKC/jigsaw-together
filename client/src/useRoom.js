import { useCallback, useEffect, useState } from 'react';
import { request, socket } from './socket.js';
import {
  applyDenied, applyDrop, applyFinish, applyGrab, applyMove, clearGame, initGame,
} from './gameStore.js';
import { clearPin, getClientId, loadPin, savePin } from './lib/session.js';

export function useRoom() {
  const [connected, setConnected] = useState(socket.connected);
  const [room, setRoom] = useState(null);
  const [me, setMe] = useState(null);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(() => !!loadPin());

  const enter = useCallback((snap) => {
    setRoom(snap.room);
    setMe(snap.me);
    setResult(snap.result || null);
    if (snap.game) initGame(snap.game);
    else clearGame();
    savePin(snap.room.pin);
  }, []);

  const exit = useCallback((noticeKey = '') => {
    setRoom(null);
    setMe(null);
    setResult(null);
    clearGame();
    clearPin();
    if (noticeKey) setNotice(noticeKey); // a key like 'kicked', translated in App
  }, []);

  useEffect(() => {
    // On connect (or reconnect after a drop), if a room is saved, rejoin it and get the latest state.
    const rejoin = async () => {
      const pin = loadPin();
      if (!pin) return setRestoring(false);
      const res = await request('room:rejoin', { pin, clientId: getClientId() });
      if (res.ok) enter(res);
      else exit('closed');
      setRestoring(false);
    };

    const onConnect = () => { setConnected(true); rejoin(); };
    const onDisconnect = () => setConnected(false);
    const onRoomState = (r) => setRoom(r);
    const onStarted = ({ room: r, game }) => {
      initGame(game);
      setResult(null);
      setRoom(r);
    };
    const onComplete = ({ room: r, result: res }) => {
      applyFinish(res.finishedAt);
      setResult(res);
      setRoom(r);
    };
    const onKicked = () => exit('kicked');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);
    socket.on('game:started', onStarted);
    socket.on('game:complete', onComplete);
    socket.on('room:kicked', onKicked);
    socket.on('piece:grabbed', applyGrab);
    socket.on('piece:moved', applyMove);
    socket.on('piece:dropped', applyDrop);
    socket.on('piece:denied', applyDenied);
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
      socket.off('game:started', onStarted);
      socket.off('game:complete', onComplete);
      socket.off('room:kicked', onKicked);
      socket.off('piece:grabbed', applyGrab);
      socket.off('piece:moved', applyMove);
      socket.off('piece:dropped', applyDrop);
      socket.off('piece:denied', applyDenied);
    };
  }, [enter, exit]);

  // Wraps every action: sets busy, clears the old error, stores the new error code.
  const run = useCallback(async (fn) => {
    setBusy(true);
    setError('');
    try {
      const res = await fn();
      if (res && !res.ok) setError(res.code);
      return res;
    } finally {
      setBusy(false);
    }
  }, []);

  const actions = {
    create: (name) =>
      run(async () => {
        const res = await request('room:create', { name, clientId: getClientId() });
        if (res.ok) enter(res);
        return res;
      }),
    join: (pin, name) =>
      run(async () => {
        const res = await request('room:join', { pin, name, clientId: getClientId() });
        if (res.ok) enter(res);
        return res;
      }),
    leave: async () => {
      await request('room:leave');
      exit();
    },
    kick: (playerId) => run(() => request('room:kick', { playerId })),
    settings: (patch) => run(() => request('room:settings', patch)),
    start: () => run(() => request('game:start')),
    uploadImage: (blob, aspect) =>
      run(async () => request('room:image', { aspect, data: await blob.arrayBuffer() })),
  };

  return {
    connected, room, me, result, notice, error, busy, restoring, actions,
    dismissNotice: () => setNotice(''),
    clearError: () => setError(''),
    cancelRestore: () => { clearPin(); setRestoring(false); },
  };
}
