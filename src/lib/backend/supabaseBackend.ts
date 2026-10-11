'use client';
// Supabase 백엔드 — Postgres 테이블(행 단위) + Auth + Storage + Realtime
// 스키마·권한: supabase/schema.sql
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  Backend, BackendCheck, BackendConfig, BackendUser, ListItem, diffList, metaOf,
} from './types';
import { visFloorOf } from '../visFloor';

const BUCKET = 'ohome';
const PROBE = ['profiles', 'site_settings', 'posts', 'characters'];

export async function createSupabaseBackend(
  cfg: Extract<BackendConfig, { kind: 'supabase' }>,
): Promise<Backend> {
  const { createBrowserClient } = await import('@supabase/ssr');
  const sb: SupabaseClient = createBrowserClient(cfg.url.replace(/\/$/, ''), cfg.anonKey);

  const toUser = async (u: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null | undefined): Promise<BackendUser | null> => {
    if (!u) return null;
    const { data: prof } = await sb.from('profiles')
      .select('nickname, role, avatar_url, avatar_color').eq('id', u.id).maybeSingle();
    return {
      id: u.id,
      nickname: prof?.nickname ?? (u.user_metadata?.nickname as string) ?? u.email ?? 'user',
      role: (prof?.role as 'admin' | 'member') ?? 'member',
      email: u.email,
      avatarUrl: prof?.avatar_url ?? undefined,
      avatarColor: prof?.avatar_color ?? undefined,
    };
  };

  return {
    kind: 'supabase',

    async check(): Promise<BackendCheck> {
      const fail = (p: Partial<BackendCheck>): BackendCheck =>
        ({ ok: false, reachable: false, schema: false, hasAdmin: false, message: '', ...p });
      let reachable = false;
      try {
        const { error } = await sb.from('profiles').select('id').limit(1);
        if (error) {
          if (error.code === '42P01' || /does not exist/i.test(error.message)) reachable = true;
          else if (/JWT|api key|Invalid/i.test(error.message)) {
            return fail({ message: 'anon key가 올바르지 않습니다 — Supabase → Settings → API에서 anon public 키를 다시 복사해 주세요.' });
          } else if (/fetch|network|Load failed/i.test(error.message)) {
            return fail({ message: '프로젝트에 닿지 못했습니다 — Project URL이 정확한지, 프로젝트가 일시정지(Paused) 상태는 아닌지 확인해 주세요.' });
          } else return fail({ message: `연결에 실패했습니다 — ${error.message}` });
        } else reachable = true;
      } catch {
        return fail({ message: '프로젝트에 접속할 수 없습니다 — URL을 확인해 주세요.' });
      }

      const missing: string[] = [];
      for (const t of PROBE) {
        const { error } = await sb.from(t).select('*', { head: true, count: 'exact' }).limit(1);
        if (error && (error.code === '42P01' || /does not exist/i.test(error.message))) missing.push(t);
      }
      if (missing.length) {
        return fail({ reachable, message: `스키마가 아직 없습니다 (${missing.join(', ')}) — 아래 SQL을 Supabase의 SQL Editor에서 한 번 실행해 주세요.` });
      }

      const { count } = await sb.from('profiles').select('id', { head: true, count: 'exact' }).eq('role', 'admin');
      const hasAdmin = (count ?? 0) > 0;
      return {
        ok: true, reachable, schema: true, hasAdmin,
        message: hasAdmin ? '연결 완료 — 관리자 계정이 이미 있습니다. 그 계정으로 로그인해 주세요.'
          : '연결 완료 — 이제 관리자 계정을 만들면 됩니다. 첫 번째 가입 계정이 관리자가 됩니다.',
      };
    },

    async currentUser() {
      const { data } = await sb.auth.getUser();
      return toUser(data.user);
    },

    onAuthChange(cb) {
      const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
        void toUser(session?.user).then(cb);
      });
      return () => sub.subscription.unsubscribe();
    },

    async signIn(id, password) {
      const { error } = await sb.auth.signInWithPassword({ email: id, password });
      return error ? { ok: false, error: error.message } : { ok: true };
    },

    async signUp(id, password, nickname) {
      const { error } = await sb.auth.signUp({ email: id, password, options: { data: { nickname } } });
      return error ? { ok: false, error: error.message } : { ok: true };
    },

    async signOut() { await sb.auth.signOut(); },

    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email);
      return error ? { ok: false, error: error.message } : { ok: true };
    },

async updateProfile(patch) {
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: '로그인이 필요합니다.' };

  const row: Record<string, unknown> = {};
  if (patch.nickname !== undefined) row.nickname = patch.nickname;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
  if (patch.avatarColor !== undefined) row.avatar_color = patch.avatarColor;

  // 변경할 항목이 없으면 바로 성공 리턴
  if (Object.keys(row).length === 0) return { ok: true };

  // upsert 대신 update를 사용해 기존 프로필의 전달된 필드만 변경합니다.
  const { error } = await sb.from('profiles').update(row).eq('id', data.user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
},

    async claimOwner() { return { ok: true }; },

    async listMembers() {
      const { data, error } = await sb.from('profiles').select('id, nickname, role, avatar_url').order('created_at');
      if (error) throw error;
      return (data ?? []).map(r => {
        const p = r as { id: string; nickname: string; role: string; avatar_url?: string | null };
        return {
          id: p.id, nickname: p.nickname, role: (p.role as 'admin' | 'member') ?? 'member',
          avatarUrl: p.avatar_url ?? undefined,
        };
      });
    },

    async fetchList<T extends ListItem>(coll: string): Promise<T[]> {
      const { data, error } = await sb.from(coll).select('id, data, sort').order('sort', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(r => {
        const row = r as { id: string; data: Record<string, unknown> };
        return { ...(row.data ?? {}), id: row.id } as T;
      });
    },

    async syncList<T extends ListItem>(coll: string, prev: T[], next: T[], uid: string | null) {
      const { inserts, updates, moves, deletes } = diffList(prev, next);
      const toRow = ({ item, sort }: { item: T; sort: number }) => {
        const { authorId, visibility, editorIds } = metaOf(item, uid, visFloorOf(coll, item));
        return { id: item.id, data: item, author_id: authorId, visibility, editor_ids: editorIds, sort };
      };
      const bySize = (rows: { item: T; sort: number }[]) => {
        const parts: { item: T; sort: number }[][] = [];
        let cur: { item: T; sort: number }[] = [];
        let bytes = 0;
        for (const r of rows) {
          const size = JSON.stringify(r.item).length + 200;
          if (cur.length && bytes + size > 4_000_000) { parts.push(cur); cur = []; bytes = 0; }
          cur.push(r); bytes += size;
        }
        if (cur.length) parts.push(cur);
        return parts;
      };
      for (const part of bySize(inserts)) {
        const { error } = await sb.from(coll).insert(part.map(toRow));
        if (error) throw error;
      }
      for (const part of bySize(updates)) {
        const { error } = await sb.from(coll).upsert(part.map(toRow), { onConflict: 'id' });
        if (error) throw error;
      }
      for (let i = 0; i < moves.length; i += 25) {
        const errs = await Promise.all(moves.slice(i, i + 25).map(m =>
          sb.from(coll).update({ sort: m.sort }).eq('id', m.id).then(r => r.error)));
        const bad = errs.find(Boolean);
        if (bad) throw bad;
      }
      if (deletes.length) {
        const { error } = await sb.from(coll).delete().in('id', deletes);
        if (error) throw error;
      }
    },

    async refreshVis<T extends ListItem>(coll: string, items: T[], uid: string | null): Promise<number> {
      const byKey = new Map<string, { vis: string; editorIds: string[]; ids: string[] }>();
      items.forEach(it => {
        const { visibility, editorIds } = metaOf(it, uid, visFloorOf(coll, it));
        const key = visibility + '|' + JSON.stringify(editorIds);
        const g = byKey.get(key) ?? { vis: visibility, editorIds, ids: [] };
        g.ids.push(it.id);
        byKey.set(key, g);
      });
      let n = 0;
      for (const { vis, editorIds, ids } of byKey.values()) {
        for (let i = 0; i < ids.length; i += 200) {
          const part = ids.slice(i, i + 200);
          const { error } = await sb.from(coll).update({ visibility: vis, editor_ids: editorIds }).in('id', part);
          if (error) throw error;
          n += part.length;
        }
      }
      return n;
    },

    subscribe(coll, onChange) {
      const channelName = `ohome:${coll}:${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const ch = sb.channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: coll }, () => onChange());
      
      ch.subscribe();

      return () => { void sb.removeChannel(ch); };
    },

    async fetchSetting<T>(key: string) {
      const { data, error } = await sb.from('site_settings').select('value').eq('key', key).maybeSingle();
      if (error) throw error;
      return (data?.value ?? null) as T | null;
    },

    async saveSetting(key, value) {
      const { error } = await sb.from('site_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    },

    async fetchAllSettings() {
      const { data, error } = await sb.from('site_settings').select('key, value');
      if (error) throw error;
      const out: Record<string, unknown> = {};
      (data ?? []).forEach(r => { out[(r as { key: string }).key] = (r as { value: unknown }).value; });
      return out;
    },

    async uploadFile(blob, ext) {
      const path = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from(BUCKET)
        .upload(path, blob, {
          contentType: blob.type || 'application/octet-stream',
          cacheControl: '31536000',
          upsert: false,
        });
      if (error) throw error;
      return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    },

    async listFiles() {
      const out: { ref: string; size: number }[] = [];
      const PAGE = 100;
      for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await sb.storage.from(BUCKET).list('', { limit: PAGE, offset });
        if (error) throw error;
        const rows = data ?? [];
        rows.forEach(f => out.push({
          ref: sb.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
          size: (f.metadata as { size?: number } | null)?.size ?? 0,
        }));
        if (rows.length < PAGE) break;
      }
      return out;
    },

    async deleteFile(ref) {
      const name = decodeURIComponent(ref.split('?')[0].split('/').pop() ?? '');
      if (!name) return;
      const { error } = await sb.storage.from(BUCKET).remove([name]);
      if (error) throw error;
    },

    async deleteMember(id) {
      const { error } = await sb.from('profiles').delete().eq('id', id);
      if (error) throw error;
    },
  };
}
