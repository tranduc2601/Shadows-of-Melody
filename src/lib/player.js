// Global audio player singleton — browser-only
// Events dispatched on window: player:songchange, player:play, player:pause, player:timeupdate, player:ended

import { API_BASE } from './api.js';

export const player = (() => {
  if (typeof window === 'undefined') {
    return {
      get current() { return null; }, get isPlaying() { return false; },
      get currentTime() { return 0; }, get duration() { return 0; },
      get shuffle() { return false; }, get repeat() { return 'none'; },
      playSong() {}, toggle() {}, next() {}, prev() {},
      seek() {}, setVolume() {}, toggleShuffle() { return false; }, cycleRepeat() { return 'none'; },
      saveState() {}, restoreState() {}, reset() {},
    };
  }

  let _audio = null;
  let _current = null;
  let _queue = [];
  let _queueIdx = -1;
  let _shuffle = false;
  let _repeat = 'none'; // 'none' | 'all' | 'one'
  let _loading = false; // true while src is being changed — suppresses spurious pause event
  let _historyTimer = null; // 10-second timer for logging plays

  function getAudio() {
    if (!_audio) {
      _audio = new Audio();
      _audio.addEventListener('timeupdate', () => _dispatch('timeupdate'));
      _audio.addEventListener('ended', _onEnded);
      _audio.addEventListener('play', () => _dispatch('play'));
      _audio.addEventListener('pause', () => { if (!_loading) _dispatch('pause'); });
      _audio.addEventListener('loadedmetadata', () => _dispatch('loaded'));
    }
    return _audio;
  }

  function _dispatch(type, extra = {}) {
    window.dispatchEvent(new CustomEvent(`player:${type}`, {
      detail: { song: _current, ...extra },
    }));
  }

  function _onEnded() {
    if (_repeat === 'one') {
      getAudio().currentTime = 0;
      getAudio().play();
      return;
    }
    if (_queue.length > 0 && (_queueIdx < _queue.length - 1 || _repeat === 'all')) {
      _nextInternal();
    } else {
      _dispatch('ended');
    }
  }

  function _nextInternal() {
    if (!_queue.length) return;
    if (_shuffle) {
      _queueIdx = Math.floor(Math.random() * _queue.length);
    } else {
      _queueIdx = _repeat === 'all'
        ? (_queueIdx + 1) % _queue.length
        : Math.min(_queueIdx + 1, _queue.length - 1);
    }
    _playSong(_queue[_queueIdx]);
  }

  async function _playSong(song) {
    _current = song;
    const a = getAudio();
    _loading = true;
    a.src = `${API_BASE}/stream/${song.id}`;
    _loading = false;
    _dispatch('songchange');
    try { await a.play(); } catch { /* autoplay blocked */ }

    // Cancel any pending history log from the previous song
    if (_historyTimer) { clearTimeout(_historyTimer); _historyTimer = null; }

    // Log to history after 10 seconds of listening
    const songId = song.id;
    _historyTimer = setTimeout(() => {
      _historyTimer = null;
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token || !songId) return;
      fetch(`${API_BASE}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ song_id: songId }),
      }).catch(() => {});
    }, 10_000);
  }

  return {
    get current() { return _current; },
    get isPlaying() { return _audio ? !_audio.paused : false; },
    get currentTime() { return _audio?.currentTime || 0; },
    get duration() { return _audio?.duration || 0; },
    get shuffle() { return _shuffle; },
    get repeat() { return _repeat; },
    /** Read-only snapshot of the current play queue. */
    get queue() { return [..._queue]; },
    /** Index of the currently playing song within the queue (-1 if none). */
    get queueIndex() { return _queueIdx; },

    /** @param {any} song @param {any[] | null} [queue] */
    playSong(song, queue = null) {
      if (queue) {
        _queue = queue;
        _queueIdx = queue.findIndex(s => s.id === song.id);
        if (_queueIdx < 0) _queueIdx = 0;
      }
      _playSong(song);
    },

    toggle() {
      if (!_audio) return;
      _audio.paused ? _audio.play() : _audio.pause();
    },

    next() { _nextInternal(); },

    prev() {
      if (_audio && _audio.currentTime > 3) { _audio.currentTime = 0; return; }
      if (!_queue.length) return;
      _queueIdx = Math.max(0, _queueIdx - 1);
      _playSong(_queue[_queueIdx]);
    },

    seek(fraction) {
      if (!_audio) return;
      const dur = isFinite(_audio.duration) && _audio.duration > 0
        ? _audio.duration
        : (_current?.duration ?? 0);
      if (dur <= 0) return;
      _audio.currentTime = fraction * dur;
    },

    setVolume(v) {
      if (_audio) _audio.volume = Math.max(0, Math.min(1, v));
    },

    toggleShuffle() { _shuffle = !_shuffle; return _shuffle; },

    cycleRepeat() {
      _repeat = _repeat === 'none' ? 'all' : _repeat === 'all' ? 'one' : 'none';
      return _repeat;
    },

    /** Save current playback state to sessionStorage so it survives page navigation. */
    saveState() {
      if (!_current) return;
      try {
        sessionStorage.setItem('player_state', JSON.stringify({
          song: _current,
          queue: _queue,
          queueIdx: _queueIdx,
          currentTime: _audio?.currentTime || 0,
          isPlaying: _audio ? !_audio.paused : false,
          volume: _audio?.volume ?? 1,
          shuffle: _shuffle,
          repeat: _repeat,
        }));
      } catch {}
    },

    /** Restore saved playback state after a page navigation. */
    restoreState() {
      try {
        const raw = sessionStorage.getItem('player_state');
        if (!raw) return;
        const state = JSON.parse(raw);
        if (!state?.song) return;
        // Keep the saved state so a second call (e.g. from another module) doesn't double-restore
        // Only clear after successfully starting playback
        _current = state.song;
        _queue = state.queue || [];
        _queueIdx = state.queueIdx ?? -1;
        _shuffle = state.shuffle ?? false;
        _repeat = state.repeat ?? 'none';
        const a = getAudio();
        if (state.volume != null) a.volume = state.volume;
        _loading = true;
        a.src = `${API_BASE}/stream/${state.song.id}`;
        _loading = false;
        // Seek to saved position once metadata is ready
        const targetTime = state.currentTime || 0;
        const doSeek = () => { if (targetTime > 0) a.currentTime = targetTime; };
        if (isFinite(a.duration) && a.duration > 0) {
          doSeek();
        } else {
          a.addEventListener('loadedmetadata', doSeek, { once: true });
        }
        sessionStorage.removeItem('player_state');
        // Dispatch after current synchronous execution so PlayerBar event
        // listeners are guaranteed to be registered before the event fires.
        queueMicrotask(() => {
          _dispatch('songchange');
          if (state.isPlaying) {
            a.play().catch(() => {});
          }
        });
      } catch {}
    },

    /** Stop playback and clear all player state (e.g. on logout). */
    reset() {
      if (_historyTimer) { clearTimeout(_historyTimer); _historyTimer = null; }
      if (_audio) {
        _audio.pause();
        _audio.src = '';
      }
      _current = null;
      _queue = [];
      _queueIdx = -1;
      _shuffle = false;
      _repeat = 'none';
      try { sessionStorage.removeItem('player_state'); } catch {}
      _dispatch('songchange');
    },
  };
})();
