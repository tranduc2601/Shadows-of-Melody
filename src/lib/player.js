


import { API_BASE } from './api.js';

export const player = (() => {
  if (typeof window === 'undefined') {
    return {
      get current() { return null; }, get isPlaying() { return false; },
      get currentTime() { return 0; }, get duration() { return 0; },
      get shuffle() { return false; }, get repeat() { return 'none'; },
      /**
       * @param {unknown} [_song]
       * @param {unknown[] | null | undefined} [_queue]
       */
      playSong(_song, _queue) {}, toggle() {}, next() {}, prev() {},
      seek() {}, setVolume() {}, setPlaybackRate() {}, toggleShuffle() { return false; }, cycleRepeat() { return 'none'; },
      saveState() {}, restoreState() {}, reset() {},
    };
  }

  const _audioKey = '__shadows_of_melody_audio__';
  function getSharedAudio() {
    if (window[_audioKey]) return window[_audioKey];
    window[_audioKey] = new Audio();
    window[_audioKey].addEventListener('timeupdate', () => _dispatch('timeupdate'));
    window[_audioKey].addEventListener('ended', _onEnded);
    window[_audioKey].addEventListener('play', () => _dispatch('play'));
    window[_audioKey].addEventListener('pause', () => { if (!_loading) _dispatch('pause'); });
    window[_audioKey].addEventListener('loadedmetadata', () => _dispatch('loaded'));
    return window[_audioKey];
  }

  let _audio = null;
  let _current = null;
  let _queue = [];
  let _queueIdx = -1;
  let _libraryQueue = [];
  let _fallbackAllSongs = null;
  let _librarySignature = '';
  let _libraryPromise = null;
  let _shuffle = false;
  let _repeat = 'none';
  let _playbackRate = 1;
  const _storageKey = 'player_state';
  let _loading = false;
  let _historyTimer = null;

  function getAudio() {
    if (!_audio) _audio = getSharedAudio();
    return _audio;
  }

  function _persistState() {
    try {
      sessionStorage.setItem(_storageKey, JSON.stringify({
        song: _current,
        queue: _queue,
        queueIdx: _queueIdx,
        currentTime: _audio?.currentTime || 0,
        isPlaying: _audio ? !_audio.paused : false,
        volume: _audio?.volume ?? 1,
        playbackRate: _playbackRate,
        shuffle: _shuffle,
        repeat: _repeat,
      }));
    } catch {}
  }

  function _applyPlaybackRate(rate = _playbackRate) {
    _playbackRate = Math.max(0.25, Math.min(3, Number(rate) || 1));
    if (_audio) {
      if (_audio.readyState >= 2) {
        _audio.playbackRate = _playbackRate;
      } else {
        _audio.addEventListener('canplay', () => {
          if (_audio) _audio.playbackRate = _playbackRate;
        }, { once: true });
      }
    }
    try { localStorage.setItem('player_speed', String(_playbackRate)); } catch {}
    try { sessionStorage.setItem('player_playback_rate', String(_playbackRate)); } catch {}
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
      return;
    }
    _ensureFallbackQueue().then(() => {
      if (_fallbackAllSongs?.length) {
        _nextInternal();
      } else {
        _dispatch('ended');
      }
    });
  }

  async function _ensureFallbackQueue() {
    if (_fallbackAllSongs?.length) return _fallbackAllSongs;
    if (_libraryPromise) return _libraryPromise;
    _libraryPromise = fetch(`${API_BASE}/songs?limit=500`)
      .then((res) => res.json())
      .then((json) => {
        _fallbackAllSongs = Array.isArray(json?.data) ? json.data : [];
        return _fallbackAllSongs;
      })
      .catch(() => {
        _fallbackAllSongs = [];
        return _fallbackAllSongs;
      })
      .finally(() => {
        _libraryPromise = null;
      });
    return _libraryPromise;
  }

  function _activeQueue() {
    return _queue.length ? _queue : _libraryQueue.length ? _libraryQueue : (_fallbackAllSongs || []);
  }

  function _syncLibraryQueueFromStoredQueue() {
    if (!_queue.length || !_libraryQueue.length || _queue === _libraryQueue) return;
    const queueIds = _queue.map((song) => song?.id).join(',');
    if (queueIds && queueIds === _librarySignature) return;
    _libraryQueue = [..._queue];
    _librarySignature = queueIds;
  }

  async function _ensureLibraryQueue() {
    if (_libraryQueue.length || _fallbackAllSongs?.length) return _activeQueue();
    return await _ensureFallbackQueue();
  }

  function _nextInternal() {
    _syncLibraryQueueFromStoredQueue();
    const queue = _activeQueue();
    if (!queue.length) return;

    const currentId = _current?.id;
    const queueIsComplete = !_queue.length || queue.length > _queue.length;

    if (_shuffle) {
      _queueIdx = Math.floor(Math.random() * queue.length);
    } else if (_repeat === 'all') {
      _queueIdx = (_queueIdx + 1) % queue.length;
    } else if (_queueIdx >= queue.length - 1 && queueIsComplete && _fallbackAllSongs?.length) {
      const currentIndex = _fallbackAllSongs.findIndex((song) => song?.id === currentId);
      if (currentIndex >= 0 && currentIndex < _fallbackAllSongs.length - 1) {
        _libraryQueue = _fallbackAllSongs;
        _queue = _fallbackAllSongs;
        _librarySignature = _fallbackAllSongs.map((song) => song?.id).join(',');
        _queueIdx = currentIndex + 1;
      } else {
        _queueIdx = Math.min(_queueIdx + 1, queue.length - 1);
      }
    } else {
      _queueIdx = Math.min(_queueIdx + 1, queue.length - 1);
    }

    _playSong(queue[_queueIdx]);
  }

  async function _playSong(song) {
    _current = song;
    const a = getAudio();
    _loading = true;
    const user = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('auth_user') || 'null') : null;
    const quality = user?.subscription_badge?.is_active && ['premium', 'vip'].includes(String(user?.subscription_badge?.subscription_type || '').toLowerCase()) ? 'hi' : 'standard';
    a.src = `${API_BASE}/stream/${song.id}?quality=${quality}`;
    _loading = false;
    _dispatch('songchange');
    try { await a.play(); } catch {  }


    if (_historyTimer) { clearTimeout(_historyTimer); _historyTimer = null; }


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
    get volume() { return _audio?.volume ?? 1; },
    get playbackRate() { return _audio?.playbackRate ?? _playbackRate; },

    get queue() { return [..._queue]; },

    get queueIndex() { return _queueIdx; },

    preloadLibrary() {
      return _ensureFallbackQueue();
    },

    /**
     * @param {unknown} song
     * @param {unknown[] | null | undefined} [queue]
     */
    playSong(song, queue = null) {
      if (queue) {
        _queue = queue;
        _libraryQueue = queue;
        _librarySignature = queue.map((s) => s?.id).join(',');
        _queueIdx = queue.findIndex(s => s.id === song.id);
        if (_queueIdx < 0) _queueIdx = 0;
      } else if (!_queue.length && _libraryQueue.length) {
        _queue = _libraryQueue;
        _queueIdx = _queue.findIndex(s => s.id === song.id);
        if (_queueIdx < 0) _queueIdx = 0;
      }
      try { localStorage.setItem('player_speed', String(_playbackRate)); } catch {}
      _playSong(song);
    },

    toggle() {
      if (!_audio) return;
      _audio.paused ? _audio.play() : _audio.pause();
    },

    async next() {
      await _ensureLibraryQueue();
      _nextInternal();
    },

    async prev() {
      if (_audio && _audio.currentTime > 3) { _audio.currentTime = 0; return; }
      _syncLibraryQueueFromStoredQueue();
      await _ensureLibraryQueue();
      const queue = _activeQueue();
      if (!queue.length) return;
      _queueIdx = Math.max(0, _queueIdx - 1);
      _playSong(queue[_queueIdx]);
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
      if (_audio) _audio.volume = Math.max(0, Math.min(1, Number(v)));
    },

    setPlaybackRate(rate) {
      _applyPlaybackRate(rate);
    },

    toggleShuffle() { _shuffle = !_shuffle; return _shuffle; },

    cycleRepeat() {
      _repeat = _repeat === 'none' ? 'all' : _repeat === 'all' ? 'one' : 'none';
      return _repeat;
    },


    saveState() {
      if (!_current) return;
      _persistState();
    },


    restoreState() {
      try {
        const savedSpeed = parseFloat(localStorage.getItem('player_speed') ?? '1');
        if (Number.isFinite(savedSpeed)) _applyPlaybackRate(savedSpeed);
      } catch {}
      try {
        const raw = sessionStorage.getItem('player_state');
        if (!raw) return;
        const state = JSON.parse(raw);
        if (!state?.song) return;


        _current = state.song;
        _queue = state.queue || [];
        _libraryQueue = [..._queue];
        _librarySignature = _libraryQueue.map((s) => s?.id).join(',');
        _queueIdx = state.queueIdx ?? -1;
        _shuffle = state.shuffle ?? false;
        _repeat = state.repeat ?? 'none';
        const a = getAudio();
        if (state.volume != null) a.volume = state.volume;
        _loading = true;
        a.src = `${API_BASE}/stream/${state.song.id}?quality=standard`;
        _loading = false;
        const restoredSpeed = Number.isFinite(Number(state.playbackRate)) ? Number(state.playbackRate) : parseFloat(localStorage.getItem('player_speed') ?? '1');
        if (Number.isFinite(restoredSpeed)) {
          a.addEventListener('canplay', () => {
            if (_audio) _audio.playbackRate = restoredSpeed;
          }, { once: true });
          _applyPlaybackRate(restoredSpeed);
        }

        const targetTime = state.currentTime || 0;
        const doSeek = () => { if (targetTime > 0) a.currentTime = targetTime; };
        if (isFinite(a.duration) && a.duration > 0) {
          doSeek();
        } else {
          a.addEventListener('loadedmetadata', doSeek, { once: true });
        }
        sessionStorage.removeItem('player_state');


        queueMicrotask(() => {
          _dispatch('songchange');
          if (state.isPlaying) {
            a.play().catch(() => {});
          }
        });
      } catch {}
    },


    reset() {
      if (_historyTimer) { clearTimeout(_historyTimer); _historyTimer = null; }
      if (_audio) {
        _audio.pause();
        _audio.src = '';
      }
      if (window[_audioKey]) {
        window[_audioKey].pause();
        window[_audioKey].src = '';
      }
      _current = null;
      _queue = [];
      _libraryQueue = [];
      _fallbackAllSongs = null;
      _librarySignature = '';
      _queueIdx = -1;
      _shuffle = false;
      _repeat = 'none';
      try { sessionStorage.removeItem('player_state'); sessionStorage.removeItem('player_playback_rate'); } catch {}
      _dispatch('songchange');
    },

    syncPlaybackRateFromStorage() {
      try {
        const savedSpeed = parseFloat(localStorage.getItem('player_speed') ?? '1');
        if (Number.isFinite(savedSpeed)) _applyPlaybackRate(savedSpeed);
      } catch {}
    },
  };
})();
