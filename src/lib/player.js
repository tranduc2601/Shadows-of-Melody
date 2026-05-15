


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

  let _audio = null;
  let _current = null;
  let _queue = [];
  let _queueIdx = -1;
  let _shuffle = false;
  let _repeat = 'none';
  let _playbackRate = 1;
  let _loading = false;
  let _historyTimer = null;

  function getAudio() {
    if (!_audio) {
      _audio = new Audio();
      _audio.addEventListener('timeupdate', () => _dispatch('timeupdate'));
      _audio.addEventListener('ended', _onEnded);
      _audio.addEventListener('play', () => _dispatch('play'));
      _audio.addEventListener('pause', () => { if (!_loading) _dispatch('pause'); });
      _audio.addEventListener('loadedmetadata', () => _dispatch('loaded'));
    }
    _audio.playbackRate = _playbackRate;
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


    /**
     * @param {unknown} song
     * @param {unknown[] | null | undefined} [queue]
     */
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

    setPlaybackRate(rate) {
      const next = [0.5, 0.75, 1, 1.25, 1.5, 2].includes(rate) ? rate : 1;
      _playbackRate = next;
      if (_audio) _audio.playbackRate = next;
    },

    toggleShuffle() { _shuffle = !_shuffle; return _shuffle; },

    cycleRepeat() {
      _repeat = _repeat === 'none' ? 'all' : _repeat === 'all' ? 'one' : 'none';
      return _repeat;
    },


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
          playbackRate: _audio?.playbackRate ?? _playbackRate,
          shuffle: _shuffle,
          repeat: _repeat,
        }));
      } catch {}
    },


    restoreState() {
      try {
        const raw = sessionStorage.getItem('player_state');
        if (!raw) return;
        const state = JSON.parse(raw);
        if (!state?.song) return;


        _current = state.song;
        _queue = state.queue || [];
        _queueIdx = state.queueIdx ?? -1;
        _shuffle = state.shuffle ?? false;
        _repeat = state.repeat ?? 'none';
        _playbackRate = [0.5, 0.75, 1, 1.25, 1.5, 2].includes(state.playbackRate) ? state.playbackRate : 1;
        const a = getAudio();
        if (state.volume != null) a.volume = state.volume;
        a.playbackRate = _playbackRate;
        _loading = true;
        a.src = `${API_BASE}/stream/${state.song.id}?quality=standard`;
        _loading = false;

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
