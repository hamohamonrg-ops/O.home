'use client';

// useLocalStore 대신 원래 쓰이던 useLocalList로 변경
import { useLocalList, useLocalStore } from './postStore';

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

// 에러 났던 MEMO_SEED 복구
export const MEMO_SEED: StickyMemo[] = [
  { id: '1', text: '환영합니다!\n우측 하단의 + 버튼을 눌러 메모를 남겨보세요.', author: 'Admin', color: '#ffccf9', x: 20, y: 20, ts: Date.now() },
];

export const MEMO_COLORS = ['#fff899', '#ffccf9', '#cbe6ff', '#e3ffc8', '#ffe4c4'];
export const MEMO_SIZE_W: Record<StickyMemo['size'] extends string ? StickyMemo['size'] : 's', number> = { s: 128, m: 158, l: 196 };

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
