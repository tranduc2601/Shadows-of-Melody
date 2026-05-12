/** Minimal song shape for queue / streaming helpers */
export interface PlayableSong {
  id: number | string;
  duration?: number;
}

export interface MusicPlayer {
  readonly current: PlayableSong | null;
  readonly isPlaying: boolean;
  readonly currentTime: number;
  readonly duration: number;
  readonly shuffle: boolean;
  readonly repeat: string;
  readonly queue: PlayableSong[];
  readonly queueIndex: number;
  /** Optional queue replaces internal queue when provided */
  playSong(
    song: PlayableSong,
    queue?: ReadonlyArray<PlayableSong> | PlayableSong[] | null | undefined
  ): void;
  toggle(): void;
  next(): void;
  prev(): void;
  seek(fraction: number): void;
  setVolume(v: number): void;
  toggleShuffle(): boolean;
  cycleRepeat(): string;
  saveState(): void;
  restoreState(): void;
  reset(): void;
}

export declare const player: MusicPlayer;
