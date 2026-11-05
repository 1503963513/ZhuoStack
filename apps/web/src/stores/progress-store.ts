'use client';

import { create } from 'zustand';

interface ProgressState {
  activeRequests: number;
  progress: number;
  visible: boolean;
  start: () => void;
  done: () => void;
  setProgress: (val: number | ((prev: number) => number)) => void;
}

let timer: NodeJS.Timeout | null = null;
let resetTimer: NodeJS.Timeout | null = null;

export const useProgressStore = create<ProgressState>((set, get) => ({
  activeRequests: 0,
  progress: 0,
  visible: false,

  start: () => {
    // 若存在即将隐藏的计时器，立即清理，保持显示
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }

    const nextCount = get().activeRequests + 1;
    set({ activeRequests: nextCount, visible: true });

    if (nextCount === 1) {
      set({ progress: 25 });

      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        const { progress, activeRequests } = get();
        if (activeRequests > 0 && progress < 85) {
          set({ progress: progress + Math.max(1, (85 - progress) * 0.15) });
        }
      }, 150);
    }
  },

  done: () => {
    const nextCount = Math.max(0, get().activeRequests - 1);
    set({ activeRequests: nextCount });

    if (nextCount === 0) {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      set({ progress: 100 });

      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        if (get().activeRequests === 0) {
          set({ visible: false, progress: 0 });
        }
        resetTimer = null;
      }, 250);
    }
  },

  setProgress: (val) => {
    set((state) => ({
      progress: typeof val === 'function' ? val(state.progress) : val,
    }));
  },
}));
