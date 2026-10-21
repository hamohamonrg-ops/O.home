'use client';

import { useLocalStore } from './postStore';

export interface StickyMemo {
  id: string;
  text: string;
  author: string;
  color: string;
  x: number;
  y: number;
  rotation?: number;
  ts: number;
  bgType?: 'solid' | 'pattern';
  bgPattern?: string;
  fontFamily?: string;
  size?: 's' | 'm' | 'l';
}

export const MEMO_COLORS = ['#fff899', '#ffccf9', '#cbe6ff', '#e3ffc8', '#ffe4c4'];
export const MEMO_SIZE_W: Record<StickyMemo['size'], number> = { s: 128, m: 158, l: 196 };

export interface MemoSettings {
  allowMember: boolean;      // 회원 작성 허용 (끄면 관리자만)
  showAuthor: boolean;       // 포스트잇에 작성자 표시
}

export const DEFAULT_MEMO_SETTINGS: MemoSettings = {
  allowMember: true,
  showAuthor: true,
};

export function useMemoSettings() {
  return useLocalStore<MemoSettings>('ohome.memoSettings.v1', DEFAULT_MEMO_SETTINGS);
}
