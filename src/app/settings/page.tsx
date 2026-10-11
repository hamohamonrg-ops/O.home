'use client';
// 환경설정 (기획서 5장) — 0차: 「디자인」 탭(테마) 실동작.
// 나머지 카테고리는 해당 기능 마일스톤에서 함께 구현.
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, inviteCode, setInviteCode } from '@/lib/auth';
import { useMembers } from '@/lib/members';
import { useTheme } from '@/lib/ThemeProvider';
import { ThemeVars } from '@/lib/theme';
import { ColorField } from '@/components/ui/ColorField';
import { KStep, KToggle, KInput, LiveInput, KTextarea, KSelect, KCheck, Pager } from '@/components/ui/Kit';
import { DragList } from '@/components/ui/DragList';
import { useMainStore, WidgetConf, WIDGET_META, MULTI_TYPES, widgetLabel } from '@/lib/mainStore';
import { useConfirmDelete, ConfirmModal, Modal } from '@/components/ui/Modal';
import { exportBackup, importBackup, resetGroups, RESET_CONTENT, RESET_EXTRA } from '@/lib/backup';
import { DiaryPost, DIARY_SEED } from '@/lib/diaryStore';
import { newId } from '@/lib/postStore';
import { useCommSettings, badgeStyle, CommBadge, CommSettings } from '@/lib/commStore';
import {
  useBoardSettings, boardBadgeStyle, BoardBadge, galleryCatsOf,
  useBoards, Board, BoardSkin, BoardPerm, DEFAULT_BOARD_CATS, MAIN_BOARD_ID,
} from '@/lib/boardStore';
import { useThreadSettings, ThreadWork, THREAD_SEED, ThreadCat, threadBadgeStyle, threadCats, threadCatsPatch } from '@/lib/threadStore';
import { useTrpgSettings, DOTORI_STATUS_KEYS, DotoriStatus, dotoriBadgeStyle } from '@/lib/galleryStore';
import { useMemoSettings } from '@/lib/memoStore';
import {
  useMenuSettings, MenuSettings, MenuPerm, MenuVis, PLAYLOG_COLS,
  MenuGroupNode, MenuLeaf, defaultTree, newGroupId, menuLabelFor, extraBoardHref, boardEntries,
  IMG_PROTECT_AREAS,
} from '@/lib/menuStore';
import { FEATURES } from '@/lib/menu';
import { SectionsBlock } from '@/components/settings/SectionList';
import { useSections, sectionsOf, sectionMenuEntries, MAIN_SEC, inSection } from '@/lib/sectionStore';
import { useCustomLinks, linkEntries, toInternalPath } from '@/lib/linkStore';
import { useSiteDraft } from '@/lib/siteStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCursorSettings, CursorState, CURSOR_STATE_LABEL } from '@/lib/cursorStore';
import { RelQuestionSet, RELQ_SEED, RELQ_KEY, CP_LABEL } from '@/lib/relqStore';
import { SymbolInput } from '@/components/ui/SymbolInput';
import { allBlobs, putBlobAs, useBlobUrl, getBlob } from '@/lib/blobStore';
import { parseAni } from '@/lib/aniCursor';
import { fileDrop } from '@/lib/dnd';
import { Character, CHAR_SEED, Relation, REL_SEED } from '@/lib/charStore';
import { useLocalList } from '@/lib/postStore';
import { Mood, MOOD_SEED, moodTint } from '@/lib/diaryStore';
import {
  TextSettingEditor, DdayEditor, TodoEditor, BannerEditor, DecoEditor,
} from '@/components/main/widgetEditors';
import { useBgm, BgmTrack, parseVideoId } from '@/lib/bgmStore';
import { useFonts, fontCssUrl, FontDef, FontRole, ROLE_LABEL, FOLLOW_MENU, FOLLOW_TITLE } from '@/lib/fontStore';
import { useToast } from '@/components/ui/Toast';
import { PageTitle, EditableDesc, getPageText, setPageText } from '@/components/ui/PageText';
import { putBlob } from '@/lib/blobStore';
import { getSetting, setSetting, pushLocalSettings, unsyncedSettingKeys, SETTING_KEYS } from '@/lib/settingStore';
import { isServerMode, createBackend, backend } from '@/lib/backend';
import type { BackendConfig, BackendKind } from '@/lib/backend/types';
import { CONTENT_COLLECTIONS } from '@/lib/backend/types';
import { visFloorOf } from '@/lib/visFloor';
import { validateConfig, configFileText, saveLocalConfig, parseFirebaseSnippet, serverConfig, serverConfigSource } from '@/lib/serverConfig';
import { migrateTo, findOrphanFiles } from '@/lib/transfer';
import { FIRESTORE_RULES, STORAGE_RULES } from '@/lib/firebaseRules';
import { SCHEMA_SQL } from '@/lib/schemaSql';

const CATEGORIES = [
  '디자인', '메인 페이지', '위젯', '메뉴 관리', '게시판 관리', '자관 질문', '커미션', 'TRPG', '감상타래', '메모장',
  '폰트', '마우스 커서', 'BGM', '무드 리스트', '회원/보안', '데이터 백업',
] as const;

/** 색 항목 한 쌍 렌더 헬퍼 */
function CP({ label, k, def }: { label?: string; k: keyof ThemeVars; def?: string }) {
  const { state, setVar } = useTheme();
  return (
    <>
      {label && <span className="cp-lb">{label}</span>}
      <ColorField value={String(state.vars[k] ?? def ?? '#888888')} onChange={hex => setVar(k, hex as never)} />
    </>
  );
}

function WidgetStyleRow() {
  const { state, setVar } = useTheme();
  const v = state.vars;
  return (
    <div className="set-row" style={{ flexWrap: 'wrap' }}>
      <div className="l"><b>위젯</b>
        <small>메인·사이드에 얹히는 카드 — 비워 두면 카드 색을 그대로 따라갑니다</small></div>
      <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
        <div className="cp-grid2">
          <CP label="배경" k="wgBg" def={v.cardBg ?? '#fbfbfc'} />
          <CP label="타이틀" k="wgTitle" def={v.pageDesc ?? '#8a8f98'} />
          <CP label="본문" k="wgFg" def={v.cardFg ?? '#1d2025'} />
        </div>
        <div className="cf-row" style={{ justifyContent: 'flex-end' }}>
          <KCheck label="테두리" checked={!!v.wgBorder} onChange={b => setVar('wgBorder', b)} />
          {v.wgBorder && <CP label="색" k="wgBd" def="#e6e8ec" />}
        </div>
      </div>
    </div>
  );
}

function FontRoleRow({ role }: { role: FontRole }) {
  const { fonts, roles, setRole, familyOf } = useFonts();
  const cfg = roles[role];
  const wBtn = (w: number | undefined, label: string) => (
    <button className={cfg.weight === w ? 'on' : ''} onClick={() => setRole(role, { weight: w })}>{label}</button>
  );
  return (
    <div className="set-row" style={{ flexWrap: 'wrap' }}>
      <div className="l"><b>{ROLE_LABEL[role].label}</b>{ROLE_LABEL[role].desc && <small>{ROLE_LABEL[role].desc}</small>}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <KSelect minWidth={170} value={cfg.id} onChange={v => setRole(role, { id: v })}
          options={[
            ...(role === 'dropdown' ? [{ value: FOLLOW_MENU, label: <span>메뉴 폰트와 동일</span> }] : []),
            ...(role === 'pagetitle' ? [{ value: FOLLOW_TITLE, label: <span>타이틀 폰트와 동일</span> }] : []),
            ...fonts.map(f => ({ value: f.id, label: <span style={{ fontFamily: familyOf(f.id) }}>{f.name}</span> })),
          ]} />
        <div className="mini-seg">
          {wBtn(undefined, '기본')}
          {wBtn(300, '가늘게')}
          {wBtn(400, '보통')}
          {wBtn(700, '굵게')}
        </div>
        <KStep value={cfg.scale ?? 100} min={80} max={130} step={5} suffix="%"
          onChange={v => setRole(role, { scale: v })} />
      </div>
    </div>
  );
}

function DesignPane() {
  const {
    state, dirty: themeDirty, setMode, setPointAccent, setPointTone, setVar,
    resetMode, save, discard, presets, savePreset, applyPreset, removePreset,
  } = useTheme();
  const siteDraft = useSiteDraft();
  const { rolesDirty, saveRoles, discardRoles } = useFonts();
  const dirty = themeDirty || siteDraft.dirty || rolesDirty;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const toast = useToast();
  const del = useConfirmDelete();
  const [resetOpen, setResetOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetSel, setPresetSel] = useState('');
  const modeBtn = (m: typeof state.mode, label: string) => (
    <button className={state.mode === m ? 'on' : ''} onClick={() => setMode(m)}>{label}</button>
  );

  return (
    <div className="set-sec">
      <h3>테마</h3>
      <div className="d">변경은 미리보기로만 반영 — [SAVE]를 눌러야 저장 · 모드마다 수정값을 따로 기억합니다</div>

      <div className="set-row">
        <div className="l"><b>모드</b><small>전환해도 각 모드의 수정값은 유지 — 초기화는 [선택 리셋]에서 모드별로</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="seg in-panel">
            {modeBtn('light', '라이트')}
            {modeBtn('dark', '다크')}
            {modeBtn('point', '포인트 자동')}
            {modeBtn('custom', '커스텀')}
          </div>
          <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 11 }}
            onClick={() => setResetOpen(true)}>선택 리셋</button>
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>저장</b><small>화면에는 바로 보이지만 <b>SAVE를 눌러야 실제로 저장</b>됩니다 — 색·폰트·로고·탭 제목 모두</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dirty && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>저장 안 된 변경</span>}
          <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11, opacity: dirty ? 1 : 0.45 }}
            disabled={!dirty} onClick={() => { discard(); siteDraft.discard(); discardRoles(); toast('저장된 테마로 되돌렸습니다'); }}>변경 취소</button>
          <button className="btn btn-dark" style={{ padding: '0 18px', fontSize: 11, opacity: dirty ? 1 : 0.45 }}
            disabled={!dirty} onClick={() => { save(); siteDraft.save(); saveRoles(); toast('테마가 저장되었습니다'); }}>SAVE</button>
        </div>
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>테마 저장해두기</b><small>현재 색 구성을 이름으로 보관 — 적용하면 커스텀 모드에 불러옵니다</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {presets.length > 0 && (
            <>
              <KSelect minWidth={140} value={presetSel} onChange={setPresetSel}
                options={[{ value: '', label: '저장한 테마' }, ...presets.map(p => ({ value: p.id, label: p.name }))]} />
              <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
                onClick={() => { if (presetSel) { applyPreset(presetSel); toast('커스텀 모드에 적용했습니다 — 저장하려면 SAVE'); } }}>APPLY</button>
              <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11, marginRight: 10 }}
                onClick={() => {
                  const p = presets.find(x => x.id === presetSel);
                  if (p) del.ask(`테마 「${p.name}」를 삭제하시겠습니까?`, () => { removePreset(p.id); setPresetSel(''); });
                }}>DELETE</button>
            </>
          )}
          <KInput placeholder="테마 이름" value={presetName} onChange={e => setPresetName(e.target.value)}
            style={{ width: 120, height: 35, boxSizing: 'border-box' }} />
          <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
            onClick={() => {
              if (!presetName.trim()) { toast('테마 이름을 입력해 주세요'); return; }
              savePreset(presetName.trim());
              setPresetName('');
              toast('테마가 보관함에 저장되었습니다');
            }}>KEEP</button>
        </div>
      </div>

      <ConfirmModal open={resetOpen} wide title="어떤 테마를 초기화할까요?"
        body="선택한 모드의 수정값만 초기 상태로 돌아갑니다. 확정은 [SAVE]를 눌러야 저장됩니다."
        onClose={() => setResetOpen(false)}
        buttons={[
          { label: '라이트', kind: 'ghost', onClick: () => { resetMode('light'); setResetOpen(false); } },
          { label: '다크', kind: 'ghost', onClick: () => { resetMode('dark'); setResetOpen(false); } },
          { label: '포인트 자동', kind: 'ghost', onClick: () => { resetMode('point'); setResetOpen(false); } },
          { label: '커스텀', kind: 'ghost', onClick: () => { resetMode('custom'); setResetOpen(false); } },
          { label: 'CANCEL', kind: 'dark', onClick: () => setResetOpen(false) },
        ]} />
      {del.element}

      <div className="set-row">
        <div className="l"><b>포인트 자동 톤</b><small>포인트 자동 모드를 다크 느낌으로 깔지, 라이트 느낌으로 깔지</small></div>
        <div className="mini-seg">
          <button className={state.pointTone === 'dark' ? 'on' : ''} onClick={() => setPointTone('dark')}>다크 느낌</button>
          <button className={state.pointTone === 'light' ? 'on' : ''} onClick={() => setPointTone('light')}>라이트 느낌</button>
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>포인트 컬러</b><small>포인트 자동 모드의 기준색 — 변경 즉시 전체 재파생</small></div>
        <div className="cp-group">
          <ColorField value={state.vars.accent}
            onChange={hex => state.mode === 'point' ? setPointAccent(hex) : setVar('accent', hex)} />
        </div>
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>배경</b><small>그라데이션(시작→끝·각도) 또는 이미지(업로드·블러)</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="mini-seg">
            <button className={(state.vars.bgType ?? 'gradient') === 'gradient' ? 'on' : ''}
              onClick={() => setVar('bgType', 'gradient')}>그라데이션</button>
            <button className={state.vars.bgType === 'image' ? 'on' : ''}
              onClick={() => setVar('bgType', 'image')}>이미지</button>
          </div>
          {(state.vars.bgType ?? 'gradient') === 'gradient' ? (
            <>
              <CP k="bgG1" />
              <span style={{ color: 'var(--faint)', fontSize: 11 }}>→</span>
              <CP k="bgG2" />
              <span className="cp-lb">각도</span>
              <KStep value={state.vars.bgAngle ?? 180} min={0} max={360} step={15} suffix="°"
                onChange={v => setVar('bgAngle', v)} />
            </>
          ) : (
            <>
              <input id="themeBgFile" type="file" accept="image/*" style={{ display: 'none' }}
                onChange={async e => {
                  const f = e.target.files?.[0];
                  if (f) setVar('bgImageId', await putBlob(f));
                  e.target.value = '';
                }} />
              <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
                onClick={() => document.getElementById('themeBgFile')?.click()}>
                {state.vars.bgImageId ? 'CHANGE' : 'UPLOAD'}
              </button>
              {state.vars.bgImageId && (
                <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
                  onClick={() => setVar('bgImageId', undefined)}>REMOVE</button>
              )}
              <span className="cp-lb">블러</span>
              <KStep value={state.vars.bgBlur ?? 0} min={0} max={30} step={2} suffix="px"
                onChange={v => setVar('bgBlur', v)} />
            </>
          )}
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>카드</b><small>패널·게시판 리스트·필터 카드의 배경과 글씨색 — 보조 글씨색은 자동 파생</small></div>
        <div className="cp-group">
          <CP label="배경" k="cardBg" />
          <CP label="글씨" k="cardFg" />
        </div>
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>브라우저 탭 제목</b><small>탭·즐겨찾기에 표시되는 이름 — 비우면 「로고 텍스트 — 개인홈」</small></div>
        <DocTitleControl />
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>브라우저 탭 아이콘</b><small>탭·즐겨찾기에 표시되는 작은 그림 — 정사각형 PNG 권장, 비우면 기본 아이콘</small></div>
        <FaviconControl />
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>크롤링 설명 문구</b><small>카톡·디스코드 등에 링크 공유 시 제목 아래 뜨는 한 줄 — 비우면 서브타이틀, 그것도 비었으면 기본 문구</small></div>
        <CrawlDescControl />
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>로고</b><small>상단바 로고 텍스트·아랫줄 서브타이틀·정렬</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 }}>
          <LogoControls />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <CP label="글씨" k="topBrand" />
          </div>
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>상단메뉴</b></div>
        <div className="cp-group">
          <CP label="배경" k="topBg" />
          <CP label="글씨" k="topFg" />
          <CP label="호버 글씨" k="topHv" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>하위메뉴 드롭다운</b></div>
        <div className="cp-group">
          <CP label="배경" k="ddBg" />
          <CP label="글씨" k="ddFg" />
          <CP label="호버" k="ddHv" />
        </div>
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>페이지 타이틀</b><small>각 메뉴 상단 큰 제목과 설명 문구</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="mini-seg">
            {(['both', 'title', 'desc', 'none'] as const).map(m => (
              <button key={m} className={(state.vars.pageHead ?? 'both') === m ? 'on' : ''}
                onClick={() => setVar('pageHead', m)}>
                {m === 'both' ? '둘 다' : m === 'title' ? '제목만' : m === 'desc' ? '설명만' : '안 띄움'}
              </button>
            ))}
          </div>
          <span className="cp-lb">모바일</span>
          <div className="mini-seg">
            <button className={(state.vars.pageHeadM ?? 'same') === 'same' ? 'on' : ''}
              onClick={() => setVar('pageHeadM', 'same')}>동일</button>
            <button className={state.vars.pageHeadM === 'none' ? 'on' : ''}
              onClick={() => setVar('pageHeadM', 'none')}>생략</button>
          </div>
          <CP label="제목" k="pageTitle" />
          <CP label="설명" k="pageDesc" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>BGM 플레이어</b></div>
        <div className="cp-group">
          <CP label="배경" k="bgmBg" />
          <CP label="글씨" k="bgmFg" />
          <CP label="아이콘" k="bgmIc" />
          <CP label="볼륨바" k="bgmVol" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>캐릭터 탭 리스트</b><small>캐릭터 상세 좌측 아이콘 탭</small></div>
        <div className="cp-grid2">
          <CP label="배경" k="tabBg" />
          <CP label="글씨" k="tabFg" />
          <CP label="선택 배경" k="tabOnBg" />
          <CP label="선택 글씨" k="tabOnFg" />
        </div>
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>입력 포커스</b><small>인풋·드롭다운을 선택했을 때의 테두리색과 강조 링</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 }}>
          <KInput style={{ width: 130, marginRight: 'auto' }} defaultValue="포커스 미리보기" />
          <CP label="색" k="focusColor" def={state.vars.accent} />
          <div className="mini-seg">
            <button data-tip="은은하게 번지는 링" className={(state.vars.focusRing ?? 'glow') === 'glow' ? 'on' : ''}
              onClick={() => setVar('focusRing', 'glow')}>번짐</button>
            <button data-tip="선명한 실선 링" className={state.vars.focusRing === 'line' ? 'on' : ''}
              onClick={() => setVar('focusRing', 'line')}>라인</button>
            <button data-tip="링 없이 테두리 색만 바뀜" className={state.vars.focusRing === 'none' ? 'on' : ''}
              onClick={() => setVar('focusRing', 'none')}>테두리만</button>
          </div>
          {(state.vars.focusRing ?? 'glow') !== 'none' && (
            <>
              <span className="cp-lb">두께</span>
              <KStep value={state.vars.focusW ?? 3} min={1} max={6} step={1} suffix="px"
                onChange={v => setVar('focusW', v)} />
            </>
          )}
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>이미지 편집 배경</b><small>썸네일·헤더 위치 지정 화면의 판 — 투명 이미지에서 보임</small></div>
        <div className="cp-group">
          <CP label="배경" k="cropBg" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>스티커 메모 보드</b><small>메모장 배치 판과 메인 미니보드 위젯의 배경</small></div>
        <div className="cp-group">
          <CP label="배경" k="memoBoard" />
          <CP label="테두리" k="memoBoardBd" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>스크롤바</b></div>
        <div className="cp-group">
          <CP label="색" k="sbThumb" />
          <CP label="테두리" k="sbBd" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>검색창</b><small>게시판·리스트 공통 검색 인풋 — 라이트/다크 전환 시 자동 연동</small></div>
        <div className="cp-grid2">
          <CP label="배경" k="searchBg" />
          <CP label="글씨" k="searchFg" />
          <CP label="아이콘" k="searchIc" />
          <CP label="테두리" k="searchBd" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>스위치 탭</b><small>게시판 말머리·갤러리 보기 전환 등 — 고른 쪽은 아래 진한 버튼색을 그대로 따라갑니다</small></div>
        <div className="cp-group">
          <CP label="배경" k="segBg" />
          <CP label="글씨" k="segFg" />
        </div>
      </div>

      <WidgetStyleRow />

      <div className="set-row">
        <div className="l"><b>진한 버튼</b><small>등록·저장 버튼과 체크박스·선택 필터 칩 공통</small></div>
        <div className="cp-group">
          <CP label="버튼" k="btnDark" />
          <CP label="글씨" k="btnDarkFg" />
          <CP label="호버" k="btnDarkHv" />
        </div>
      </div>

      <FontRoleRow role="title" />
      <FontRoleRow role="pagetitle" />
      <FontRoleRow role="subtitle" />
      <FontRoleRow role="logosub" />
      <FontRoleRow role="menu" />
      <FontRoleRow role="dropdown" />
      <FontRoleRow role="body" />

      <div className="set-row">
        <div className="l"><b>모서리 둥글기</b><small>카드/버튼 radius</small></div>
        <KStep value={state.vars.radius} min={0} max={30} onChange={v => setVar('radius', v)} />
      </div>

      <div className="set-row">
        <div className="l"><b>블록 그림자</b><small>패널·카드·배너·모달의 드롭섀도우 세기 — 0%는 그림자 없음</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
          <span className="cp-lb" style={{ marginLeft: 'auto' }}>색</span>
          <ColorField value={state.vars.shColor ?? '#000000'} onChange={hex => setVar('shColor', hex)} />
          <div className="mini-seg" style={{ marginLeft: 10 }}>
            {(['없음', 0], ['약하게', 30], ['보통', 50], ['강하게', 100] as const).map(([label, v]) => (
              <button key={label} className={state.vars.shadow === v ? 'on' : ''}
                onClick={() => setVar('shadow', v)}>{label}</button>
            ))}
          </div>
          <KStep value={state.vars.shadow} min={0} max={200} step={10} suffix="%" onChange={v => setVar('shadow', v)} />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>드롭다운 그림자</b><small>하위메뉴·프로필 메뉴·셀렉트 팝업·달력 — 블록 그림자와 별개, 없음도 가능</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="mini-seg">
            {(['없음', 0], ['약하게', 30], ['보통', 50], ['강하게', 100] as const).map(([label, v]) => (
              <button key={label} className={(state.vars.ddShadow ?? 100) === v ? 'on' : ''}
                onClick={() => setVar('ddShadow', v)}>{label}</button>
            ))}
          </div>
          <KStep value={state.vars.ddShadow ?? 100} min={0} max={200} step={10} suffix="%" onChange={v => setVar('ddShadow', v)} />
        </div>
      </div>

      <SpellCheckRow />
    </div>
  );
}

function SpellCheckRow() {
  const { site, set } = useSiteDraft();
  const off = !!site.noSpell;
  return (
    <div className="set-row">
      <div className="l"><b>맞춤법 검사 밑줄</b><small>입력칸·에디터에 브라우저가 그리는 빨간 물결줄 — 끄면 사이트 전체에서 보이지 않습니다</small></div>
      <div className="mini-seg">
        <button className={!off ? 'on' : ''} onClick={() => set({ noSpell: false })}>표시</button>
        <button className={off ? 'on' : ''} onClick={() => set({ noSpell: true })}>숨김</button>
      </div>
    </div>
  );
}

function MainPagePane() {
  const { state, setMobileOff, setMobileOrder, resetMain } = useMainStore();
  const toast = useToast();
  const [resetAsk, setResetAsk] = useState(false);
  const orderable = state.mobileOrder
    .map(id => state.widgets.find(w => w.id === id))
    .filter((w): w is NonNullable<typeof w> => !!w && !w.fixed);

  return (
    <div className="set-sec">
      <div style={{ position: 'relative' }}>
        <h3>메인 페이지</h3>
        <button className="btn btn-ghost" style={{ position: 'absolute', right: 0, top: -3, padding: '6px 14px', fontSize: 11 }}
          onClick={() => setResetAsk(true)}>기본 구성</button>
      </div>
      <ConfirmModal open={resetAsk} title="메인 페이지를 기본 구성으로 되돌릴까요?"
        body="추가한 위젯과 배치·크기·모바일 순서가 전부 처음 상태로 돌아갑니다. 되돌린 뒤에는 복구할 수 없습니다."
        onClose={() => setResetAsk(false)}
        buttons={[
          { label: 'RESET', kind: 'accent', onClick: () => { resetMain(); setResetAsk(false); toast('메인 페이지가 기본 구성으로 돌아갔습니다'); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setResetAsk(false) },
        ]} />
      <div className="d">모바일 표시 여부 + 모바일 세로 나열 순서 — ⠿ 드래그로 순서 변경</div>

      <DragList
        items={orderable}
        keyOf={w => w.id}
        onReorder={list => setMobileOrder(list.map(w => w.id))}
        render={(w, i) => (
          <div className="set-row" style={{ width: '100%' }}>
            <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <span className="mw-no">{i + 1}</span>
              <span className="drag-h">⠿</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <b>{widgetLabel(state.widgets, w)}</b>
                  {MULTI_TYPES.includes(w.type) && <span className="pill">중복 추가 가능</span>}
                </div>
                <small>{WIDGET_META[w.type].desc}</small>
              </div>
            </div>
            <KToggle checked={!w.mOff} onChange={v => setMobileOff(w.id, !v)} />
          </div>
        )}
      />
      <p className="hint">토글을 끄면 <b>모바일에서만</b> 빠지고 PC 메인에는 그대로 표시됩니다 · 순서는 <b>모바일 세로 나열 순서</b> — PC 배치는 메인에서 편집모드로 자유 조정</p>
      <p className="hint">메인에서 위젯을 완전히 빼거나 더하려면 편집모드에서 — 추가는 상단바 [＋ 위젯], 삭제는 위젯 우클릭 → 위젯 삭제</p>
      <p className="hint">고정 요소: 슬라이드 배너(최상단) · 회원정보창 — 순서 목록에 포함되지 않음</p>
    </div>
  );
}

function WidgetsPane() {
  const { state } = useMainStore();
  const editable = state.widgets.filter(w =>
    (['banner', 'memo', 'dday', 'todo', 'freetext', 'deco'] as const).some(t => t === w.type));

  const editorOf = (w: WidgetConf) => {
    switch (w.type) {
      case 'memo':
      case 'freetext': return <TextSettingEditor conf={w} />;
      case 'dday': return <DdayEditor conf={w} />;
      case 'todo': return <TodoEditor conf={w} />;
      case 'deco': return <DecoEditor conf={w} />;
      case 'banner': return <BannerEditor conf={w} />;
      default: return null;
    }
  };

  return (
    <div className="set-sec">
      <h3>위젯</h3>
      <div className="d">메인 위젯의 내용·설정값 관리 — 메인 페이지의 관리 모달과 같은 데이터라서 어느 쪽에서 바꿔도 즉시 반영</div>

      {editable.map(w => (
        <div key={w.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <b style={{ fontSize: 13, letterSpacing: '.04em' }}>{widgetLabel(state.widgets, w)}</b>
            {MULTI_TYPES.includes(w.type) && <span className="pill">중복 추가 가능</span>}
            <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>{WIDGET_META[w.type].desc}</small>
            {w.mOff && <span className="pill" style={{ marginLeft: 'auto' }}>모바일 제외</span>}
          </div>
          {editorOf(w)}
        </div>
      ))}
      <p className="hint">DIARY·LATEST·UPCOMING은 일기·로드뷰·스케줄 실데이터를 그대로 보여주는 위젯이라 별도 설정값이 없습니다 · 위젯 켜기/끄기와 순서는 「메인 페이지」 카테고리에서</p>
    </div>
  );
}

function BoardPane() {
  const {
    st, patchSystem, patchGallery,
    patchGalleryCat, addGalleryCat, removeGalleryCat, setGalleryCats,
  } = useBoardSettings();
  const { boards, setBoards, patchBoard } = useBoards();
  const [catBoard, setCatBoard] = useState(MAIN_BOARD_ID);
  const { list: secList } = useSections();
  const galSecs = secList('gallery');
  const [galSecSel, setGalSec] = useState(MAIN_SEC);
  const galSec = galSecs.some(s2 => s2.id === galSecSel) ? galSecSel : MAIN_SEC;
  const galCats = galleryCatsOf(st, galSec);
  const del = useConfirmDelete();

  const sel = boards.find(b => b.id === catBoard) ?? boards[0];
  const setCats = (cats: BoardBadge[]) => patchBoard(sel.id, { cats });
  const patchCat = (id: string, p: Partial<BoardBadge>) =>
    patchBoard(sel.id, { cats: sel.cats.map(c => (c.id === id ? { ...c, ...p } : c)) });

  const colorCells = (b: BoardBadge, patch: (p: Partial<BoardBadge>) => void) => (
    <>
      <span className="cp-lb">배경</span>
      <ColorField value={b.bg} onChange={hex => patch({ bg: hex })} />
      <span className="cp-lb">테두리</span>
      <ColorField value={b.border} onChange={hex => patch({ border: hex })} />
      <span className="cp-lb">글씨</span>
      <ColorField value={b.fg} onChange={hex => patch({ fg: hex })} />
    </>
  );

  return (
    <div className="set-sec">
      <h3>게시판 관리</h3>
      <div className="d">게시판 생성·삭제와 게시판별 스킨·권한·말머리 — 변경 즉시 메뉴·목록·글쓰기에 반영</div>

      <h3 style={{ marginTop: 20 }}>게시판 목록</h3>
      <div className="d">⠿ 드래그로 메뉴 순서 · 이름은 상단 메뉴와 페이지 타이틀에 그대로 표시 · 리스트 스킨(기본형/티켓형) 게시판마다 지정 — 글쓰기·댓글 권한은 메뉴 관리에서</div>
      <DragList items={boards} keyOf={b => b.id} onReorder={setBoards}
        render={b => (
          <div className="set-row" style={{ width: '100%' }}>
            <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <span className="drag-h">⠿</span>
              <KInput value={b.name} onChange={e => patchBoard(b.id, { name: e.target.value })}
                style={{ width: 110 }} />
              {b.id === MAIN_BOARD_ID && <span className="pill">기본</span>}
            </div>
            <div className="cp-group" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <div className="mini-seg">
                {(['list', 'ticket'] as BoardSkin[]).map(s => (
                  <button key={s} className={b.skin === s ? 'on' : ''}
                    onClick={() => patchBoard(b.id, { skin: s })}>{s === 'list' ? '기본형' : '티켓형'}</button>
                ))}
              </div>
              <span className="cp-lb">글씨</span>
              <ColorField value={b.fg ?? '#2c3037'} onChange={hex => patchBoard(b.id, { fg: hex })} />
              {b.fg && (
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                  onClick={() => patchBoard(b.id, { fg: undefined })}>기본색</button>
              )}
              {b.id !== MAIN_BOARD_ID && (
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                  onClick={() => del.ask(`게시판 「${b.name}」를 삭제하시겠습니까?`, () => {
                    setBoards(boards.filter(x => x.id !== b.id));
                    if (catBoard === b.id) setCatBoard(MAIN_BOARD_ID);
                  }, '메뉴에서 사라지지만 이 게시판에 쓴 글 데이터는 보존됩니다 (3장 원칙).')}>DELETE</button>
              )}
            </div>
          </div>
        )} />
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
          onClick={() => setBoards([...boards, {
            id: newId(), name: '새 게시판', desc: '게시판 설명을 입력하세요',
            skin: 'list', permWrite: 'member', permComment: 'member', cats: DEFAULT_BOARD_CATS,
          }])}>＋ ADD BOARD</button>
      </div>

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1.5px solid var(--line)' }} />

      <h3>말머리</h3>
      <div className="d">게시판을 고른 뒤 ⠿ 드래그로 순서 · 이름 수정 · 추가/삭제 — 이름을 바꿔도 기존 글은 이전 이름으로 남습니다</div>
      {boards.length > 1 && (
        <div className="mini-seg" style={{ marginBottom: 12 }}>
          {boards.map(b => (
            <button key={b.id} className={sel.id === b.id ? 'on' : ''} onClick={() => setCatBoard(b.id)}>{b.name}</button>
          ))}
        </div>
      )}
      <DragList items={sel.cats} keyOf={c => c.id} onReorder={setCats}
        render={c => (
          <div className="set-row" style={{ width: '100%' }}>
            <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <span className="drag-h">⠿</span>
              <span style={boardBadgeStyle(c)}>{c.label || '말머리'}</span>
            </div>
            <div className="cp-group" style={{ justifyContent: 'flex-end' }}>
              <KInput value={c.label} onChange={e => patchCat(c.id, { label: e.target.value })}
                style={{ width: 90, textAlign: 'right' }} />
              {colorCells(c, p => patchCat(c.id, p))}
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                onClick={() => del.ask(`말머리 「${c.label}」를 삭제하시겠습니까?`, () =>
                  patchBoard(sel.id, { cats: sel.cats.filter(x => x.id !== c.id) }),
                  '이 말머리로 쓴 기존 글은 유지되며 중립색 뱃지로 표시됩니다.')}>DELETE</button>
            </div>
          </div>
        )} />
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
          onClick={() => setCats([...sel.cats, { id: newId(), label: '새 말머리', bg: '#eef0f2', border: '#d7dae0', fg: '#5d636d' }])}>＋ ADD</button>
      </div>

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1.5px solid var(--line)' }} />

      <h3>시스템 뱃지</h3>
      <div className="d">공지 · 비밀 · 접힘 — 색만 수정 (삭제 불가)</div>
      {st.system.map(b => (
        <div key={b.id} className="set-row">
          <div className="l"><span style={boardBadgeStyle(b)}>{b.label}</span></div>
          <div className="cp-group" style={{ justifyContent: 'flex-end' }}>
            {colorCells(b, p => patchSystem(b.id, p))}
          </div>
        </div>
      ))}

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1.5px solid var(--line)' }} />

      <h3>갤러리 유형 뱃지</h3>
      <div className="d">그림백업의 로그/단일 표시 — 라벨·색 수정 (삭제 불가)</div>
      {st.gallery.map(b => (
        <div key={b.id} className="set-row">
          <div className="l"><span style={boardBadgeStyle(b)}>{b.label || '유형'}</span></div>
          <div className="cp-group" style={{ justifyContent: 'flex-end' }}>
            <KInput value={b.label} onChange={e => patchGallery(b.id, { label: e.target.value })}
              style={{ width: 90, textAlign: 'right' }} />
            {colorCells(b, p => patchGallery(b.id, p))}
          </div>
        </div>
      ))}

      <h3 style={{ marginTop: 20 }}>갤러리 말머리</h3>
      <div className="d">
        그림백업 글쓰기에서 고르는 말머리 — ⠿ 드래그로 순서 · 추가·수정·삭제 자유
        {galSecs.length > 1 && <><br />갤러리마다 따로 정합니다 — <b>손대기 전까지는 기본 갤러리의 말머리를 그대로 씁니다</b></>}
      </div>
      {galSecs.length > 1 && (
        <div className="mini-seg" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
          {galSecs.map(s2 => (
            <button key={s2.id} className={galSec === s2.id ? 'on' : ''} onClick={() => setGalSec(s2.id)}>{s2.name}</button>
          ))}
        </div>
      )}
      <DragList items={galCats} keyOf={c => c.id} onReorder={next => setGalleryCats(galSec, next)}
        render={c => (
          <div className="set-row" style={{ width: '100%' }}>
            <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <span className="drag-h">⠿</span>
              <span style={boardBadgeStyle(c)}>{c.label || '말머리'}</span>
            </div>
            <div className="cp-group" style={{ justifyContent: 'flex-end' }}>
              <KInput value={c.label} onChange={e => patchGalleryCat(galSec, c.id, { label: e.target.value })}
                style={{ width: 100, textAlign: 'right' }} />
              {colorCells(c, p => patchGalleryCat(galSec, c.id, p))}
              <span className="fx" data-tip="말머리 삭제"
                onClick={() => del.ask(`말머리 「${c.label}」를 삭제하시겠습니까?`,
                  () => removeGalleryCat(galSec, c.id),
                  '이미 이 말머리로 등록된 글은 그대로 남습니다.')}>✕</span>
            </div>
          </div>
        )} />
      <button className="btn btn-ghost" style={{ marginTop: 8, padding: '7px 14px', fontSize: 11 }}
        onClick={() => addGalleryCat(galSec)}>＋ 말머리 추가</button>

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1.5px solid var(--line)' }} />
      <SectionsBlock />

      {del.element}
    </div>
  );
}

function RelQPane() {
  const [sets, setSets] = useLocalList<RelQuestionSet>(RELQ_KEY, RELQ_SEED);
  const [selId, setSelId] = useState<string | null>(null);
  const del = useConfirmDelete();
  const relqToast = useToast();
  const txtRef = useRef<HTMLInputElement>(null);
  const sel = sets.find(s => s.id === selId) ?? sets[0];
  const patchSet = (id: string, p: Partial<RelQuestionSet>) =>
    setSets(sets.map(s => (s.id === id ? { ...s, ...p } : s)));

  const PER_Q = 12;
  const [qPage, setQPage] = useState(1);
  const qTotal = sel?.questions.length ?? 0;
  const qPages = Math.max(1, Math.ceil(qTotal / PER_Q));
  const qCur = Math.min(qPage, qPages);
  useEffect(() => { setQPage(1); }, [sel?.id]);
  const qStart = (qCur - 1) * PER_Q;
  const qShown = (sel?.questions ?? []).slice(qStart, qStart + PER_Q);

  return (
    <div className="set-sec">
      <h3>자관 질문</h3>
      <div className="d">질문 세트를 CP(커플)/NCP(커플 아님)로 구분해 관리 — 자관 상세에서 QUESTIONS 섹션을 추가할 때 세트를 골라 넣습니다</div>

      <h3 style={{ marginTop: 20 }}>질문 세트</h3>
      <div className="d">이름은 자유 수정 · CP/NCP 구분 · ⠿ 드래그로 순서</div>
      <DragList items={sets} keyOf={s => s.id} onReorder={setSets}
        render={s => (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '3px 0' }}>
            <span className="drag-h" style={{ fontSize: 11 }}>⠿</span>
            <KInput value={s.name} onChange={e => patchSet(s.id, { name: e.target.value })}
              style={{ width: 140, fontSize: 12, padding: '5px 10px' }} />
            <div className="mini-seg">
              {(['cp', 'ncp'] as const).map(t => (
                <button key={t} className={s.cat === t ? 'on' : ''}
                  onClick={() => patchSet(s.id, { cat: t })}>{CP_LABEL[t]}</button>
              ))}
            </div>
            <small style={{ marginLeft: 'auto', color: 'var(--faint)', fontSize: 10.5 }}>질문 {s.questions.length}개</small>
            <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 10.5 }}
              onClick={() => del.ask(`세트 「${s.name}」를 삭제하시겠습니까?`,
                () => setSets(sets.filter(x => x.id !== s.id)),
                '이미 자관에 넣은 질문들은 그대로 유지됩니다.')}>DELETE</button>
          </div>
        )} />
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
          onClick={() => setSets([...sets, { id: newId(), name: '새 세트', cat: 'cp', questions: [] }])}>＋ ADD SET</button>
      </div>

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1.5px solid var(--line)' }} />

      <h3>질문 목록</h3>
      <div className="d">txt 파일은 줄바꿈을 기준으로 질문을 카운트합니다.</div>
      {sets.length > 1 && (
        <div className="mini-seg" style={{ marginBottom: 12 }}>
          {sets.map(s => (
            <button key={s.id} className={sel?.id === s.id ? 'on' : ''} onClick={() => setSelId(s.id)}>{s.name}</button>
          ))}
        </div>
      )}
      {sel && (
        <>
          <DragList items={qShown.map((q, i) => ({ q, key: `${sel.id}-${qStart + i}` }))} keyOf={x => x.key}
            onReorder={list => patchSet(sel.id, {
              questions: [
                ...sel.questions.slice(0, qStart),
                ...list.map(x => x.q),
                ...sel.questions.slice(qStart + PER_Q),
              ],
            })}
            render={({ q }, i) => {
              const gi = qStart + i;
              return (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '2px 0' }}>
                <span className="drag-h" style={{ fontSize: 11 }}>⠿</span>
                <small style={{ color: 'var(--faint)', fontSize: 10, minWidth: 26, textAlign: 'right' }}>{gi + 1}</small>
                <KInput value={q}
                  onChange={e => patchSet(sel.id, { questions: sel.questions.map((x, j) => (j === gi ? e.target.value : x)) })}
                  style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '5px 10px' }} />
                <span className="fx" style={{ fontSize: 10, padding: '2px 4px' }}
                  onClick={() => {
                    const remove = () => patchSet(sel.id, { questions: sel.questions.filter((_, j) => j !== gi) });
                    if (q.trim()) del.ask(`질문을 삭제하시겠습니까?`, remove, `"${q.slice(0, 40)}${q.length > 40 ? '…' : ''}"`);
                    else remove();
                  }}>✕</span>
              </div>
              );
            }} />
          {qTotal > PER_Q && (
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
              <span />
              <Pager page={qCur} total={qPages} onChange={setQPage} />
              <small style={{ color: 'var(--faint)', fontSize: 10.5, justifySelf: 'end' }}>총 {qTotal}개</small>
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <input ref={txtRef} type="file" accept=".txt,text/plain" style={{ display: 'none' }}
              onChange={async e => {
                const f = e.target.files?.[0]; e.target.value = '';
                if (!f) return;
                const lines = (await f.text()).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                if (lines.length === 0) { relqToast('파일에서 질문을 찾지 못했습니다'); return; }
                patchSet(sel.id, { questions: [...sel.questions, ...lines] });
                relqToast(`질문 ${lines.length}개를 불러왔습니다`);
              }} />
            <button className="btn btn-dark" style={{ padding: '5px 12px', fontSize: 11 }}
              onClick={() => txtRef.current?.click()}>↑ TXT 업로드</button>
            <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
              onClick={() => {
                patchSet(sel.id, { questions: [...sel.questions, ''] });
                setQPage(Math.ceil((qTotal + 1) / PER_Q));
              }}>＋ ADD</button>
          </div>
        </>
      )}
      {del.element}
    </div>
  );
}

function MemberPane() {
  const toast = useToast();
  const del = useConfirmDelete();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [codeLoaded, setCodeLoaded] = useState(false);
  const [regVer, setRegVer] = useState(0);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  useEffect(() => { setCode(inviteCode()); setCodeLoaded(true); }, []);
  void regVer;

  const members = useMembers();
  const serverOn2 = isServerMode();
  const authConsoleUrl = (() => {
    const c = serverConfig();
    if (c?.kind === 'firebase') return `https://console.firebase.google.com/project/${c.projectId}/authentication/users`;
    if (c?.kind === 'supabase') {
      const m = c.url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
      return m ? `https://supabase.com/dashboard/project/${m[1]}/auth/users` : '';
    }
    return '';
  })();
  const [delMember, setDelMember] = useState<{ id: string; nickname: string } | null>(null);
  const registry = (() => {
    try { return JSON.parse(localStorage.getItem('ohome.mockreg.v1') ?? '{}') as Record<string, unknown>; } catch { return {}; }
  })();

  const PER_MEMBERS = 10;
  const [mq, setMq] = useState('');
  const [mPage, setMPage] = useState(1);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [mTags, setMTags] = useState<Record<string, string[]>>({});
  const [tagFor, setTagFor] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => { setMTags(getSetting<Record<string, string[]>>('ohome.membertags.v1', {})); }, []);
  const saveTags = (userId: string, tags: string[]) => {
    setMTags(prev => {
      const n = { ...prev };
      if (tags.length) n[userId] = tags; else delete n[userId];
      setSetting('ohome.membertags.v1', n);
      return n;
    });
  };
  const allTags = [...new Set(Object.values(mTags).flat())];
  const isAdminOf = (m: { id: string; role?: string }) => m.role === 'admin' || m.id === 'admin';
  const filteredMembers = members.filter(m => {
    if (removedIds.includes(m.id)) return false;
    const k = mq.trim().toLowerCase();
    const tags = mTags[m.id] ?? [];
    if (filterTag && !tags.includes(filterTag)) return false;
    return !k || m.nickname.toLowerCase().includes(k) || m.id.toLowerCase().includes(k)
      || tags.some(t => t.toLowerCase().includes(k));
  })
    .sort((a, b) => (isAdminOf(a) ? 0 : 1) - (isAdminOf(b) ? 0 : 1) || a.nickname.localeCompare(b.nickname));
  const pageMembers = filteredMembers.slice((mPage - 1) * PER_MEMBERS, mPage * PER_MEMBERS);

  return (
    <div className="set-sec">
      <h3>회원/보안</h3>
      <div className="d">가입코드와 회원 목록 관리</div>

      <div className="set-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <div className="l"><b>가입코드</b><small>회원가입 시 입력해야 하는 초대코드 — 아는 사람에게만 공유</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <KInput value={code} onChange={e => setCode(e.target.value)} style={{ width: 220 }} />
          <button className="btn btn-dark" disabled={!codeLoaded}
            onClick={() => {
              if (!code.trim()) { toast('가입코드를 입력해 주세요'); return; }
              setInviteCode(code);
              toast('가입코드가 변경되었습니다');
            }}>SAVE</button>
        </div>
      </div>

      <h3 style={{ marginTop: 26 }}>회원 목록</h3>
      <div className="d">기본 계정(관리자·지인회원)은 삭제할 수 없습니다 — 태그로 그룹화</div>
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l">
          {allTags.length > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {allTags.map(t => (
                <span key={t} className={`pill${filterTag === t ? ' dark' : ''}`} style={{ cursor: 'var(--cur-pointer,pointer)' }}
                  onClick={() => { setFilterTag(f => (f === t ? null : t)); setMPage(1); }}>{t}</span>
              ))}
            </div>
          ) : <b>태그 필터</b>}
        </div>
        <KInput placeholder="닉네임·아이디·태그 검색" value={mq}
          onChange={e => { setMq(e.target.value); setMPage(1); }}
          style={{ width: 200, fontSize: 12 }} />
      </div>
      {pageMembers.map(m => {
        const isBase = m.id === 'admin' || m.id === 'guest';
        const myTags = mTags[m.id] ?? [];
        return (
          <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 12.5, cursor: 'var(--cur-pointer,pointer)' }} data-tip="회원 정보 보기"
              onClick={() => router.push(`/members/${m.id}`)}>{m.nickname}</b>
            <small style={{ color: 'var(--faint)', fontSize: 10.5 }} data-tip={m.id.length > 7 ? m.id : undefined}>
              {m.id.length > 7 ? `${m.id.slice(0, 7)}…` : m.id}
            </small>
            {myTags.map(t => (
              <span key={t} className="pill" style={{ cursor: 'var(--cur-pointer,pointer)' }} data-tip="태그 제거"
                onClick={() => del.ask(`태그 「${t}」를 제거하시겠습니까?`,
                  () => saveTags(m.id, myTags.filter(x => x !== t)),
                  `${m.nickname} 회원에게서만 제거됩니다.`)}>
                {t} <span style={{ fontSize: 8 }}>✕</span>
              </span>
            ))}
            {tagFor === m.id ? (
              <KInput autoFocus placeholder="태그" value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onBlur={() => setTagFor(null)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    saveTags(m.id, [...new Set([...myTags, tagInput.trim()])]);
                    setTagInput(''); setTagFor(null);
                  }
                  if (e.key === 'Escape') setTagFor(null);
                }}
                style={{ width: 90, fontSize: 11, padding: '3px 8px' }} />
            ) : (
              <span className="fx" style={{ fontSize: 10 }} data-tip="태그 추가"
                onClick={() => { setTagFor(m.id); setTagInput(''); }}>＋</span>
            )}
            <span className="pill" style={{ marginLeft: 'auto' }}>{isAdminOf(m) ? '관리자' : '회원'}</span>
            {!isBase && !isAdminOf(m) && (
              <button className="btn btn-ghost" style={{ padding: '4px 11px', fontSize: 10.5, borderRadius: 20, lineHeight: 'normal', letterSpacing: '.04em' }}
                onClick={() => {
                  if (serverOn2) { setDelMember({ id: m.id, nickname: m.nickname }); return; }
                  del.ask(`회원 「${m.nickname}」 계정을 삭제하시겠습니까?`, () => {
                    const reg = { ...registry };
                    delete reg[m.id];
                    try { localStorage.setItem('ohome.mockreg.v1', JSON.stringify(reg)); } catch { /* 무시 */ }
                    setRegVer(v => v + 1);
                    toast('계정이 삭제되었습니다');
                  }, '이 계정으로 다시 로그인할 수 없게 됩니다. 작성한 글은 그대로 남습니다.');
                }}>DELETE</button>
            )}
          </div>
        );
      })}
      {filteredMembers.length === 0 && (
        <p className="hint" style={{ margin: '10px 0 0' }}>조건에 맞는 회원이 없습니다</p>
      )}
      {filteredMembers.length > PER_MEMBERS && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
          <Pager page={mPage} total={Math.ceil(filteredMembers.length / PER_MEMBERS)} onChange={setMPage} />
        </div>
      )}
      <ConfirmModal open={delMember !== null} title={`회원 「${delMember?.nickname ?? ''}」 내보내기`}
        wide
        body={
          <div style={{ display: 'grid', gap: 10 }}>
            <p style={{ margin: 0 }}>
              <b>① 먼저 로그인 계정을 지웁니다.</b><br />
              계정 삭제는 관리자 권한이 필요한 작업이라 홈에서는 할 수 없습니다
              (그럴 수 있게 만들면 홈에 넣은 관리자 키가 공개돼 누구나 남의 계정을 지울 수 있게 됩니다).
              아래 버튼으로 콘솔을 열어 <b>{delMember?.nickname}</b> 계정을 지워 주세요.
            </p>
            <p style={{ margin: 0 }}>
              <b>② 그다음 목록에서 지웁니다.</b><br />
              계정을 지우지 않고 목록에서만 지우면 <b>그 사람은 계속 로그인할 수 있습니다.</b>
              작성한 글은 어느 쪽이든 그대로 남습니다.
            </p>
          </div>
        }
        onClose={() => setDelMember(null)}
        buttons={[
          ...(authConsoleUrl ? [{
            label: '① 콘솔에서 계정 지우기 ↗', kind: 'dark' as const,
            onClick: () => window.open(authConsoleUrl, '_blank', 'noopener'),
          }] : []),
          {
            label: '② 목록에서 지우기', kind: 'accent' as const,
            onClick: () => {
              const t = delMember;
              setDelMember(null);
              if (!t) return;
              void backend()?.deleteMember(t.id)
                .then(() => { setRemovedIds(v => [...v, t.id]); toast('회원 목록에서 지웠습니다'); })
                .catch(() => toast('지우지 못했습니다 — 관리자 계정으로 로그인했는지 확인해 주세요'));
            },
          },
          { label: 'CANCEL', kind: 'ghost' as const, onClick: () => setDelMember(null) },
        ]} />
      {del.element}
      {serverOn2 && <ConfigScopeWarnRow />}
      {serverOn2 && <ForkUpdateRow />}
      {serverOn2 && <SecurityRulesRow />}
    </div>
  );
}

function ConfigScopeWarnRow() {
  const src = serverConfigSource();
  const cfg = serverConfig();
  if (src !== 'local' || !cfg) return null;
  const download = () => {
    const blob = new Blob([configFileText(cfg)], { type: 'application/json' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u; a.download = 'ohome.config.json';
    a.click();
    URL.revokeObjectURL(u);
  };
  return (
    <div className="set-sec" style={{ marginTop: 26, border: '1.5px solid var(--accent)', borderRadius: 12, padding: 16 }}>
      <h3 style={{ color: 'var(--accent)' }}>방문자에게는 아직 설치 화면이 보입니다</h3>
      <div className="d" style={{ lineHeight: 1.7 }}>
        데이터베이스 연결이 <b>지금 이 브라우저에만</b> 저장돼 있습니다 — 다른 사람이 배포 주소로 들어오면
        홈이 아니라 「처음 여는 중」 설치 화면이 뜹니다. 아래 파일을 내려받아 <b>저장소의 public 폴더</b>에
        올리고 커밋하면(1~2분 뒤 자동 재배포) 방문자도 같은 홈을 봅니다. 공개용 값이라 노출돼도 안전합니다.
        <br />
        적용됐는지는 <b>내 배포 주소/ohome.config.json</b>을 열어 값이 보이면 성공입니다.
      </div>
      <div className="setup-row" style={{ marginTop: 10 }}>
        <button className="btn btn-dark" onClick={download}>ohome.config.json 내려받기</button>
      </div>
      <p className="hint" style={{ margin: '8px 0 0' }}>
        파일 대신 Vercel → Settings → Environment Variables에 환경변수로 넣는 방법도 있습니다 — 설치 화면 마지막 단계와 같습니다.
      </p>
    </div>
  );
}

function ForkUpdateRow() {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setUrl(getSetting<string>('ohome.repo.v1', '')); setLoaded(true); }, []);
  const trimmed = url.trim();
  const valid = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/i.test(trimmed);
  return (
    <div className="set-sec" style={{ marginTop: 26 }}>
      <h3>포크 업데이트</h3>
      <div className="d">
        내 포크 주소를 저장해 두면, 원본에 업데이트가 올라왔을 때 GitHub의 [Sync fork] 화면으로 바로 이동할 수 있습니다
      </div>
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>내 포크 주소</b><small>GitHub에서 포크한 저장소의 주소</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <KInput placeholder="https://github.com/내아이디/O.home" value={url} onChange={e => setUrl(e.target.value)} style={{ width: 250 }} />
          <button className="btn btn-ghost" disabled={!loaded}
            onClick={() => { setSetting('ohome.repo.v1', trimmed); toast('저장되었습니다'); }}>SAVE</button>
          <button className="btn btn-dark" disabled={!valid}
            onClick={() => window.open(trimmed, '_blank', 'noopener')}>내 포크로 이동 ↗</button>
        </div>
      </div>
    </div>
  );
}

function SecurityRulesRow() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const cfg = serverConfig();
  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setOpen(true);
    }
  };
  return (
    <div className="set-sec" style={{ marginTop: 26 }}>
      <h3>보안 규칙</h3>
      <div className="d">
        앱이 업데이트되며 규칙이 바뀔 때가 있습니다 — 새 기능이 갑자기 안 보이거나 목록이 비어 보이거나
        저장이 거부되면 아래를 다시 적용해 보세요.{' '}
        {cfg?.kind === 'firebase'
          ? 'Firestore 콘솔의 규칙 화면에 그대로 덮어써도 안전합니다(기존 컬렉션 권한은 그대로 유지).'
          : 'Supabase 콘솔 → SQL Editor에 통째로 붙여넣고 Run — 여러 번 실행해도 안전합니다(이미 있으면 건너뜀, 쌓아 둔 글·회원은 그대로).'}
      </div>
      {cfg?.kind === 'firebase' ? (
        <div className="setup-row">
          <button className="btn btn-dark" onClick={() => copy(FIRESTORE_RULES, 'fs')}>
            {copied === 'fs' ? '복사됨 ✓' : 'Firestore 규칙 복사'}
          </button>
          <button className="btn btn-dark" onClick={() => copy(STORAGE_RULES, 'st')}>
            {copied === 'st' ? '복사됨 ✓' : 'Storage 규칙 복사'}
          </button>
          <button className="btn btn-ghost" onClick={() => setOpen(o => !o)}>{open ? '내용 접기' : '내용 보기'}</button>
        </div>
      ) : (
        <div className="setup-row">
          <button className="btn btn-dark" onClick={() => copy(SCHEMA_SQL, 'sql')}>
            {copied === 'sql' ? '복사됨 ✓' : '설치 SQL 복사'}
          </button>
          <button className="btn btn-ghost" onClick={() => setOpen(o => !o)}>{open ? '내용 접기' : '내용 보기'}</button>
        </div>
      )}
      {open && (cfg?.kind === 'firebase' ? (
        <>
          <pre className="setup-sql">{FIRESTORE_RULES}</pre>
          <pre className="setup-sql">{STORAGE_RULES}</pre>
        </>
      ) : (
        <pre className="setup-sql">{SCHEMA_SQL}</pre>
      ))}
    </div>
  );
}

function MoodPane() {
  const [moods, setMoods] = useLocalList<Mood>('ohome.moods.v1', MOOD_SEED);
  const [diaries] = useLocalList<DiaryPost>('ohome.diary.v1', DIARY_SEED);
  const del = useConfirmDelete();
  const patchMood = (id: string, p: Partial<Mood>) =>
    setMoods(moods.map(m => (m.id === id ? { ...m, ...p } : m)));
  return (
    <div className="set-sec">
      <h3>무드 리스트</h3>
      <div className="d">다이어리에서 고를 무드 — 이름 · 아이콘(이모지/특수문자) · 색 · ⠿ 드래그로 순서</div>

      <DragList items={moods} keyOf={m => m.id} onReorder={setMoods}
        render={m => (
          <div className="set-row" style={{ width: '100%' }}>
            <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <span className="drag-h">⠿</span>
              <span style={{
                width: 30, height: 30, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                background: moodTint(m.color), color: m.color, fontSize: 14,
              }}>{m.icon}</span>
            </div>
            <div className="cp-group" style={{ justifyContent: 'flex-end' }}>
              <SymbolInput value={m.icon} onChange={v => patchMood(m.id, { icon: v })}
                style={{ width: 46, textAlign: 'center' }} />
              <KInput value={m.name} onChange={e => patchMood(m.id, { name: e.target.value })}
                style={{ width: 110 }} />
              <ColorField value={m.color} onChange={hex => patchMood(m.id, { color: hex })} />
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                onClick={() => {
                const used = diaries.filter(d => d.moodId === m.id).length;
                del.ask(`무드 「${m.name}」를 삭제하시겠습니까?`, () => setMoods(moods.filter(x => x.id !== m.id)),
                  used > 0 ? `이 무드로 쓴 일기 ${used}개는 유지되지만 아이콘이 기본 표시로 바뀝니다.` : undefined);
              }}>DELETE</button>
            </div>
          </div>
        )} />
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
          onClick={() => setMoods([...moods, { id: newId(), name: '새 무드', icon: '✦', color: '#8a8f98' }])}>
          ＋ ADD MOOD
        </button>
      </div>
      {del.element}
    </div>
  );
}

function DocTitleControl() {
  const { site, set } = useSiteDraft();
  return (
    <LiveInput value={site.docTitle ?? ''} onValue={v => set({ docTitle: v })}
      placeholder={`${site.title} — 개인홈`}
      style={{ width: 260, height: 35, boxSizing: 'border-box' }} />
  );
}

function CrawlDescControl() {
  const { site, set } = useSiteDraft();
  return (
    <LiveInput value={site.crawlDesc ?? ''} onValue={v => set({ crawlDesc: v })}
      placeholder="자캐놀이용 개인 아카이브"
      style={{ width: 260, height: 35, boxSizing: 'border-box' }} />
  );
}

function FaviconControl() {
  const { site, set } = useSiteDraft();
  const toast = useToast();
  const url = useBlobUrl(site.favicon);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{
        width: 35, height: 35, borderRadius: 'var(--radius-s)', border: '1px solid var(--line)',
        background: 'var(--panel)', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0,
      }}>
        {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span style={{ fontSize: 10, color: 'var(--faint)' }}>기본</span>}
      </span>
      <input id="siteFavicon" type="file" accept="image/png,image/x-icon,image/svg+xml,image/webp,.ico"
        style={{ display: 'none' }}
        onChange={async e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try { set({ favicon: await putBlob(f) }); } catch (err) {
            toast(`아이콘을 저장소에 올리지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`);
          }
        }} />
      <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
        onClick={() => document.getElementById('siteFavicon')?.click()}>
        {site.favicon ? 'CHANGE' : 'UPLOAD'}
      </button>
      {site.favicon && (
        <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
          onClick={() => set({ favicon: undefined })}>REMOVE</button>
      )}
    </div>
  );
}

function LogoControls() {
  const { site, set } = useSiteDraft();
  return (
    <>
      <LiveInput value={site.title} onValue={v => set({ title: v })}
        style={{ width: 130, height: 35, boxSizing: 'border-box' }} />
      <LiveInput value={site.subtitle} onValue={v => set({ subtitle: v })}
        style={{ width: 160, height: 35, boxSizing: 'border-box' }} />
      <div className="mini-seg">
        {(['left', 'center', 'right'] as const).map(a => (
          <button key={a} className={site.align === a ? 'on' : ''} onClick={() => set({ align: a })}>
            {a === 'left' ? '왼쪽' : a === 'center' ? '가운데' : '오른쪽'}
          </button>
        ))}
      </div>
    </>
  );
}

async function fitCursorImage(f: File): Promise<{ blob: Blob; resized: boolean }> {
  if (/\.(cur|ani)$/i.test(f.name)) return { blob: f, resized: false };
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i); i.onerror = no; i.src = url;
    });
    const max = Math.max(img.width, img.height);
    if (max <= 128) return { blob: f, resized: false };
    const k = 128 / max;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>(ok => c.toBlob(ok, 'image/png'));
    return blob ? { blob, resized: true } : { blob: f, resized: false };
  } catch {
    return { blob: f, resized: false };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function CursorRow({ state }: { state: CursorState }) {
  const [st, patch] = useCursorSettings();
  const toast = useToast();
  const entry = st.states[state];
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!entry?.imgId) { setUrl(null); return; }
    let cancelled = false;
    let obj: string | null = null;
    getBlob(entry.imgId).then(async b => {
      if (!b || cancelled) return;
      const ani = parseAni(await b.arrayBuffer());
      if (cancelled) return;
      obj = URL.createObjectURL(ani ? ani.frames[0] : b);
      setUrl(obj);
    });
    return () => { cancelled = true; if (obj) URL.revokeObjectURL(obj); };
  }, [entry?.imgId]);

  const inputId = `curFile-${state}`;
  const setEntry = (p: Partial<{ imgId: string; hx: number; hy: number }>) =>
    patch({ states: { ...st.states, [state]: { imgId: entry?.imgId ?? '', hx: 0, hy: 0, ...entry, ...p } } });

  return (
    <div className="set-row" style={{ flexWrap: 'wrap' }}>
      <div className="l" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{
          width: 36, height: 36, borderRadius: 9, border: '1.5px dashed var(--line)',
          display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0,
        }}>
          {url ? <img src={url} alt="" style={{ maxWidth: 32, maxHeight: 32 }} /> : <span style={{ color: 'var(--faint)', fontSize: 14 }}>✛</span>}
        </span>
        <div><b>{CURSOR_STATE_LABEL[state].label}</b><small>{CURSOR_STATE_LABEL[state].desc}</small></div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input id={inputId} type="file" accept="image/png,image/gif,image/webp,image/x-icon,.cur,.ani" style={{ display: 'none' }}
          onChange={async e => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const { blob, resized } = await fitCursorImage(f);
            setEntry({ imgId: await putBlob(blob) });
            if (resized) toast('커서로 쓸 수 있게 128px 이내로 줄였습니다 (원본이 너무 컸음)');
          }} />
        <button className="btn btn-ghost" style={{ height: 33, padding: '0 12px', fontSize: 11 }}
          onClick={() => document.getElementById(inputId)?.click()}>{entry ? 'CHANGE' : 'UPLOAD'}</button>
        {entry && (
          <>
            <span className="cp-lb">핫스팟 X</span>
            <KStep value={entry.hx} min={0} max={32} step={1} onChange={v => setEntry({ hx: v })} />
            <span className="cp-lb">Y</span>
            <KStep value={entry.hy} min={0} max={32} step={1} onChange={v => setEntry({ hy: v })} />
            <button className="btn btn-ghost" style={{ height: 33, padding: '0 12px', fontSize: 11 }}
              onClick={() => {
                const next = { ...st.states };
                delete next[state];
                patch({ states: next });
              }}>REMOVE</button>
          </>
        )}
      </div>
    </div>
  );
}

function CursorPane() {
  const [st, patch] = useCursorSettings();
  return (
    <div className="set-sec">
      <h3>마우스 커서</h3>
      <div className="d">상태별 커서 등록 (png·gif·cur·ani — 32px 내외 권장) + 클릭 지점(핫스팟) — ani는 애니메이션 재생 · cur/ani는 내장 핫스팟 사용 · 등록하지 않은 상태는 기본 커서</div>
      <p className="hint" style={{ margin: '-6px 0 10px' }}>
        브라우저는 128px가 넘는 이미지를 커서로 쓰지 못합니다 — 큰 이미지를 올리면 자동으로 줄여서 등록합니다
      </p>
      <div className="set-row">
        <div className="l"><b>커스텀 커서 사용</b><small>끄면 전부 기본 커서로 (등록 이미지는 보존)</small></div>
        <KToggle checked={st.enabled} onChange={v => patch({ enabled: v })} />
      </div>
      {(Object.keys(CURSOR_STATE_LABEL) as CursorState[]).map(s => <CursorRow key={s} state={s} />)}
    </div>
  );
}

function DataPane() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetAsk, setResetAsk] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [pushing, setPushing] = useState(false);
  const serverOn = isServerMode();
  const [unsynced, setUnsynced] = useState<string[]>([]);

  useEffect(() => { setUnsynced(unsyncedSettingKeys()); }, []);

  const [orphans, setOrphans] = useState<{ ref: string; size: number }[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cleanAsk, setCleanAsk] = useState(false);
  const orphanMB = (orphans ?? []).reduce((s, f) => s + f.size, 0) / 1048576;

  const scanOrphans = async () => {
    const be = backend();
    if (!be) { toast('서버에 연결돼 있지 않습니다'); return; }
    setScanning(true);
    try {
      const rows = await findOrphanFiles(be);
      setOrphans(rows);
      toast(rows.length ? `쓰지 않는 이미지 ${rows.length}개를 찾았습니다` : '정리할 이미지가 없습니다');
    } catch (e) {
      toast(e instanceof Error && e.message
        ? e.message
        : '이미지 목록을 읽지 못했습니다 — 저장소 권한(규칙)을 확인해 주세요');
    }
    setScanning(false);
  };

  const cleanOrphans = async () => {
    const be = backend();
    if (!be || !orphans) return;
    setScanning(true);
    let n = 0;
    for (const f of orphans) {
      try { await be.deleteFile(f.ref); n += 1; } catch {}
    }
    setOrphans(null);
    setScanning(false);
    toast(`이미지 ${n}개를 지웠습니다`);
  };

  const [chars, setChars] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [rels] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const [charAsk, setCharAsk] = useState(false);
  const orphanChars = useMemo(() => {
    const used = new Set<string>();
    rels.forEach(r => r.members.forEach(m => used.add(m.charId)));
    return chars.filter(c => !c.own && !used.has(c.id));
  }, [chars, rels]);

  const cleanChars = () => {
    const gone = new Set(orphanChars.map(c => c.id));
    setChars(chars.filter(c => !gone.has(c.id)));
    toast(`상대 캐릭터 ${gone.size}명을 지웠습니다`);
  };

  const doPush = async () => {
    setPushing(true);
    try {
      const n = await pushLocalSettings(SETTING_KEYS);
      toast(n > 0 ? `설정 ${n}건을 서버에 올렸습니다 — 방문자에게도 같은 모습으로 보입니다` : '올릴 설정이 없습니다');
      setUnsynced(unsyncedSettingKeys());
    } catch {
      toast('설정 업로드에 실패했습니다 — 관리자 계정으로 로그인했는지 확인해 주세요');
    }
    setPushing(false);
  };
  const toggle = (k: string, v: boolean) => setPicked(p => (v ? [...new Set([...p, k])] : p.filter(x => x !== k)));

  const [migOpen, setMigOpen] = useState(false);
  const [migKind, setMigKind] = useState<BackendKind>('supabase');
  const [migSb, setMigSb] = useState({ url: '', anonKey: '' });
  const [migFb, setMigFb] = useState({ apiKey: '', authDomain: '', projectId: '', storageBucket: '', appId: '' });
  const [migState, setMigState] = useState<'idle' | 'checking' | 'ready' | 'running' | 'done'>('idle');
  const [migMsg, setMigMsg] = useState('');

  const migCfg = (): BackendConfig => (migKind === 'firebase'
    ? {
        kind: 'firebase',
        apiKey: migFb.apiKey.trim(),
        authDomain: migFb.authDomain.trim() || `${migFb.projectId.trim()}.firebaseapp.com`,
        projectId: migFb.projectId.trim(),
        storageBucket: migFb.storageBucket.trim() || `${migFb.projectId.trim()}.appspot.com`,
        appId: migFb.appId.trim(),
      }
    : { kind: 'supabase', url: migSb.url.trim(), anonKey: migSb.anonKey.trim() });

  const migCheck = async () => {
    const bad = validateConfig(migCfg());
    if (bad) { setMigMsg(bad); setMigState('idle'); return; }
    setMigState('checking'); setMigMsg('');
    try {
      const be = await createBackend(migCfg());
      const r = await be.check();
      setMigMsg(r.message);
      setMigState(r.ok ? 'ready' : 'idle');
    } catch (e) {
      setMigMsg(`연결에 실패했습니다 — ${(e as { message?: string })?.message ?? ''}`);
      setMigState('idle');
    }
  };

  const migRun = async () => {
    setMigState('running');
    try {
      const target = await createBackend(migCfg());
      const r = await migrateTo(target, (m, done, total) => {
        setMigMsg(total ? `${m} (${done}/${total})` : m);
      });
      setMigMsg(`이전 완료 — 항목 ${r.items}건 · 이미지 ${r.files}개. 아래 설정 파일을 저장소에 올리면 방문자도 새 DB를 봅니다.`);
      setMigState('done');
    } catch (e) {
      setMigMsg(`이전에 실패했습니다 — ${(e as { message?: string })?.message ?? ''}`);
      setMigState('ready');
    }
  };

  const migDownloadConfig = () => {
    const blob = new Blob([configFileText(migCfg())], { type: 'application/json' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u; a.download = 'ohome.config.json';
    a.click();
    URL.revokeObjectURL(u);
  };

  const migSwitch = () => {
    saveLocalConfig(migCfg());
    toast('새 데이터베이스로 전환합니다 — 새로고침');
    setTimeout(() => window.location.reload(), 700);
  };

  const doExport = async (includeMembers: boolean) => {
    setBusy(true);
    try {
      const { blob, dataCount, blobCount } = await exportBackup(includeMembers);
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = `ohome-backup${includeMembers ? '-with-members' : ''}-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(u);
      toast(`백업 완료 — 데이터 ${dataCount}건 · 이미지 ${blobCount}개${includeMembers ? ' · 회원 포함' : ''}`);
    } catch {
      toast('백업 생성에 실패했습니다');
    }
    setBusy(false);
  };

  const doImport = async () => {
    if (!importFile) return;
    setBusy(true);
    try {
      await importBackup(importFile);
      toast('복원 완료 — 새로고침합니다');
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast('복원에 실패했습니다 — 파일을 확인해 주세요');
      setBusy(false);
    }
  };

  return (
    <div className="set-sec">
      <h3>데이터 백업</h3>
      <div className="d">글·캐릭터·자관·역극 등 모든 데이터(JSON)와 이미지 전부를 zip 하나로 — 다른 브라우저/PC 이전용</div>

      {serverOn && unsynced.length > 0 && (
        <div className="set-row" style={{ flexWrap: 'wrap' }}>
          <div className="l"><b>서버에 올리지 않은 설정 {unsynced.length}건</b><small>서버를 붙이기 전에 이 브라우저에서 꾸민 설정입니다 — 올려야 방문자에게도 같은 모습으로 보입니다</small></div>
          <button className="btn btn-ghost" style={{ padding: '9px 18px', opacity: pushing ? 0.5 : 1 }}
            disabled={pushing} onClick={doPush}>{pushing ? '올리는 중…' : '↑ 설정 올리기'}</button>
        </div>
      )}
      {serverOn && (
        <div className="set-row" style={{ flexWrap: 'wrap' }}>
          <div className="l"><b>쓰지 않는 이미지 정리</b>
            <small>글을 지워도 이미지는 저장소에 남습니다 — 어디에서도 쓰지 않는 파일만 골라 지웁니다</small></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {orphans && (
              <span className="hint">
                {orphans.length > 0 ? `${orphans.length}개 · ${orphanMB.toFixed(1)}MB` : '정리할 것 없음'}
              </span>
            )}
            <button className="btn btn-ghost" style={{ padding: '9px 18px', opacity: scanning ? 0.5 : 1 }}
              disabled={scanning} onClick={scanOrphans}>{scanning ? '확인 중…' : '찾아보기'}</button>
            {orphans && orphans.length > 0 && (
              <button className="btn btn-accent" style={{ padding: '9px 18px', opacity: scanning ? 0.5 : 1 }}
                disabled={scanning} onClick={() => setCleanAsk(true)}>{orphans.length}개 지우기</button>
            )}
          </div>
        </div>
      )}
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>등록되지 않은 상대 캐릭터 정리</b>
          <small>자관을 지워도 상대 캐릭터는 남습니다(실수로 지웠을 때를 위해) — 어느 자관에도 없는 캐릭터만 골라 지웁니다</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="hint">
            {orphanChars.length > 0 ? `${orphanChars.length}명` : '정리할 것 없음'}
          </span>
          {orphanChars.length > 0 && (
            <button className="btn btn-accent" style={{ padding: '9px 18px' }}
              onClick={() => setCharAsk(true)}>{orphanChars.length}명 지우기</button>
          )}
        </div>
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>백업 내보내기</b><small>글·캐릭터·설정 + 이미지 → zip · 회원 계정(가입자·가입코드) 포함 여부 선택</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-accent" style={{ padding: '9px 18px', opacity: busy ? 0.5 : 1 }}
            disabled={busy} onClick={() => doExport(false)}>↓ 데이터만</button>
          <button className="btn btn-ghost" style={{ padding: '9px 18px', opacity: busy ? 0.5 : 1 }}
            disabled={busy} onClick={() => doExport(true)}>↓ 회원까지</button>
        </div>
      </div>
      {serverOn && backend()?.kind === 'firebase' && (
        <p className="hint" style={{ margin: '10px 0 16px' }}>
          Firebase는 <b>저장소 CORS를 한 번 열어야</b> 백업 zip에 이미지가 담깁니다 — 안 하면 글·설정만 담깁니다.
          설치 가이드의 「백업」 항목에 브라우저에서 끝내는 방법이 있습니다.
        </p>
      )}
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>백업 가져오기 (복원)</b><small>현재 데이터를 백업 내용으로 덮어씁니다 — 복원 후 자동 새로고침</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input id="bkImport" type="file" accept=".zip" style={{ display: 'none' }}
            onChange={e => { setImportFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
            onClick={() => document.getElementById('bkImport')?.click()}>
            {importFile ? importFile.name : '파일 선택'}
          </button>
          {importFile && (
            <button className="btn btn-dark" style={{ padding: '0 18px', fontSize: 11, opacity: busy ? 0.5 : 1 }}
              disabled={busy} onClick={doImport}>RESTORE</button>
          )}
        </div>
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>데이터베이스 이전</b><small>다른 프로젝트나 다른 서비스(Supabase ↔ Firebase)로 글·설정·이미지를 통째로 옮깁니다</small></div>
        <button className="btn btn-ghost" style={{ padding: '9px 20px' }}
          onClick={() => { setMigOpen(true); setMigState('idle'); setMigMsg(''); }}>이전하기</button>
      </div>

      <Modal open={migOpen} onClose={() => setMigOpen(false)} title="데이터베이스 이전"
        desc="옮길 곳의 연결 정보를 넣고 확인한 뒤 시작합니다 — 지금 데이터는 그대로 두고 복사합니다"
        actions={<>
          <button className="btn btn-ghost" onClick={() => setMigOpen(false)}>CLOSE</button>
          {migState === 'ready' && <button className="btn btn-accent" onClick={migRun}>이전 시작</button>}
          {migState === 'done' && <button className="btn btn-accent" onClick={migSwitch}>새 DB로 전환</button>}
        </>}>
        <div className="mini-seg" style={{ marginBottom: 12 }}>
          <button className={migKind === 'supabase' ? 'on' : ''} onClick={() => setMigKind('supabase')}>Supabase</button>
          <button className={migKind === 'firebase' ? 'on' : ''} onClick={() => setMigKind('firebase')}>Firebase</button>
        </div>

        {migKind === 'supabase' ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <label className="k-label">Project URL</label>
            <KInput value={migSb.url} onChange={e => setMigSb(s => ({ ...s, url: e.target.value }))} placeholder="https://xxxx.supabase.co" />
            <label className="k-label">anon public key</label>
            <KInput value={migSb.anonKey} onChange={e => setMigSb(s => ({ ...s, anonKey: e.target.value }))} />
            <p className="hint" style={{ margin: 0 }}>새 프로젝트라면 먼저 스키마 SQL을 실행해 두세요 — 설치 화면과 같은 내용입니다.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <label className="k-label">설정 붙여넣기 (firebaseConfig)</label>
            <KTextarea style={{ minHeight: 84, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 11.5 }}
              onChange={e => {
                const v = parseFirebaseSnippet(e.target.value);
                if (v) setMigFb(f => ({
                  apiKey: v.apiKey ?? f.apiKey, authDomain: v.authDomain ?? f.authDomain,
                  projectId: v.projectId ?? f.projectId, storageBucket: v.storageBucket ?? f.storageBucket,
                  appId: v.appId ?? f.appId,
                }));
              }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label className="k-label">apiKey</label><KInput value={migFb.apiKey} onChange={e => setMigFb(f => ({ ...f, apiKey: e.target.value }))} /></div>
              <div><label className="k-label">projectId</label><KInput value={migFb.projectId} onChange={e => setMigFb(f => ({ ...f, projectId: e.target.value }))} /></div>
            </div>
            <div><label className="k-label">appId</label><KInput value={migFb.appId} onChange={e => setMigFb(f => ({ ...f, appId: e.target.value }))} /></div>
            <p className="hint" style={{ margin: 0 }}>새 프로젝트라면 Firestore·Storage 보안 규칙을 먼저 붙여넣어 두세요.</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-dark" style={{ height: 33, padding: '0 16px', fontSize: 11 }}
            disabled={migState === 'checking' || migState === 'running'} onClick={migCheck}>
            {migState === 'checking' ? '확인 중…' : '연결 확인'}
          </button>
          {migState === 'done' && (
            <button className="btn btn-ghost" style={{ height: 33, padding: '0 14px', fontSize: 11 }}
              onClick={migDownloadConfig}>ohome.config.json 내려받기</button>
          )}
        </div>
        {migMsg && (
          <p className={migState === 'done' || migState === 'ready' ? 'setup-ok' : 'setup-err'} style={{ marginTop: 10 }}>
            {migMsg}
          </p>
        )}
      </Modal>

      <div className="set-row">
        <div className="l"><b>초기화</b><small>지울 항목을 골라서 — 메뉴별 데이터 / 사이트 설정 / 이미지 / 회원 계정 (복구 불가, 백업을 먼저 내보내 두세요)</small></div>
        <button className="btn btn-ghost" style={{ padding: '9px 20px', color: 'var(--accent)' }}
          onClick={() => { setPicked([]); setResetOpen(true); }}>RESET</button>
      </div>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="초기화할 항목 선택"
        desc="체크한 항목만 삭제됩니다 — 회원 계정을 빼면 가입 회원·관리자 계정은 그대로 유지됩니다"
        actions={<>
          <button className="btn btn-ghost" onClick={() => setResetOpen(false)}>CANCEL</button>
          <button className="btn btn-accent" disabled={picked.length === 0}
            style={{ opacity: picked.length === 0 ? 0.45 : 1 }}
            onClick={() => { setResetOpen(false); setResetAsk(true); }}>선택 항목 초기화</button>
        </>}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
            onClick={() => setPicked(RESET_CONTENT.map(g => g.key))}>메뉴 데이터 전체</button>
          <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
            onClick={() => setPicked([...RESET_CONTENT, ...RESET_EXTRA].map(g => g.key))}>전부 선택</button>
          <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11, marginLeft: 'auto' }}
            onClick={() => setPicked([])}>전부 해제</button>
        </div>
        <label className="k-label">메뉴별 데이터</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '6px 0 4px' }}>
          {RESET_CONTENT.map(g => (
            <KCheck key={g.key} label={g.label} checked={picked.includes(g.key)}
              onChange={v => toggle(g.key, v)} />
          ))}
        </div>
        <div style={{ height: 1, background: 'var(--line)', margin: '14px 0 12px' }} />
        <div style={{ display: 'grid', gap: 9 }}>
          {RESET_EXTRA.map(g => (
            <KCheck key={g.key} checked={picked.includes(g.key)} onChange={v => toggle(g.key, v)}
              label={<span>
                <b style={{ fontSize: 12.5 }}>{g.label}</b>{' '}
                <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>{g.desc}</small>
              </span>} />
          ))}
        </div>
      </Modal>

      <ConfirmModal open={cleanAsk} title={`쓰지 않는 이미지 ${orphans?.length ?? 0}개를 지울까요?`}
        body={`저장소에서 ${orphanMB.toFixed(1)}MB를 비웁니다. 지금 글·캐릭터·설정 어디에서도 참조하지 않는 파일만 골랐지만, 지운 파일은 복구할 수 없습니다. 걱정되면 먼저 백업을 받아 두세요.`}
        onClose={() => setCleanAsk(false)}
        buttons={[
          { label: '지우기', kind: 'accent', onClick: () => { setCleanAsk(false); void cleanOrphans(); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setCleanAsk(false) },
        ]} />

      <ConfirmModal open={charAsk} title={`상대 캐릭터 ${orphanChars.length}명을 지울까요?`}
        body={`${orphanChars.slice(0, 12).map(c => c.name).join(', ')}${orphanChars.length > 12 ? ` 외 ${orphanChars.length - 12}명` : ''} — 어느 자관에도 등록돼 있지 않은 캐릭터입니다. 지우면 복구할 수 없습니다.`}
        onClose={() => setCharAsk(false)}
        buttons={[
          { label: '지우기', kind: 'accent', onClick: () => { setCharAsk(false); cleanChars(); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setCharAsk(false) },
        ]} />

      <ConfirmModal open={resetAsk} title="선택한 항목을 초기화할까요?"
        body={`지울 항목: ${[...RESET_CONTENT, ...RESET_EXTRA].filter(g => picked.includes(g.key)).map(g => g.label).join(' · ')}\n삭제한 내용은 복구할 수 없습니다.`}
        onClose={() => setResetAsk(false)}
        buttons={[
          { label: '초기화', kind: 'accent', onClick: () => {
            setResetAsk(false);
            toast('초기화하는 중…');
            void resetGroups(picked)
              .then(r => {
                if (r.failed.length) {
                  toast(`${r.failed.length}건을 서버에서 지우지 못했습니다 — 로그인·보안 규칙을 확인해 주세요`);
                } else if (serverOn) {
                  const part = [`글 ${r.rows}건`];
                  if (r.files) part.push(`이미지 ${r.files}개`);
                  if (r.members) part.push(`회원 ${r.members}명`);
                  toast(`서버에서 ${part.join(' · ')}를 지웠습니다${r.members ? ' (로그인 계정은 콘솔에서 지워 주세요)' : ''}`);
                } else {
                  toast('선택한 항목을 초기화했습니다 — 새로고침합니다');
                }
              })
              .catch(() => { toast('초기화에 실패했습니다 — 로그인 상태를 확인해 주세요'); })
              .finally(() => setTimeout(() => window.location.reload(), 1400));
          } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setResetAsk(false) },
        ]} />
    </div>
  );
}

function MemberPickModal({ initial, onApply, onClose, desc }: {
  initial: string[]; onApply: (ids: string[]) => void; onClose: () => void;
  desc?: string;
}) {
  const pool = useMembers().filter(p => p.id !== 'admin' && p.role !== 'admin');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>(initial);
  const t = q.trim().toLowerCase();
  const list = pool.filter(p => !t || p.nickname.toLowerCase().includes(t) || p.id.toLowerCase().includes(t));
  return (
    <Modal open small title="멤버 선택" onClose={onClose}
      desc={desc ?? '체크한 회원(그리고 관리자)에게만 이 메뉴가 보이고 열립니다 — 비우면 로그인한 모든 회원'}
      actions={<>
        <button className="btn btn-ghost" onClick={onClose}>CANCEL</button>
        <button className="btn btn-accent" onClick={() => { onApply(sel); onClose(); }}>적용</button>
      </>}>
      <div style={{ display: 'grid', gap: 9 }}>
        <KInput placeholder="닉네임·아이디 검색" value={q} onChange={e => setQ(e.target.value)} />
        <div style={{ maxHeight: 240, overflow: 'auto', display: 'grid', gap: 4, alignContent: 'start' }}>
          {list.map(p => (
            <KCheck key={p.id}
              label={<span style={{ fontSize: 12.5 }}>{p.nickname} <small style={{ color: 'var(--faint)' }}>{p.id}</small></span>}
              checked={sel.includes(p.id)}
              onChange={v => setSel(s => (v ? [...s, p.id] : s.filter(x => x !== p.id)))} />
          ))}
          {list.length === 0 && (
            <p className="hint" style={{ margin: 0 }}>
              {pool.length === 0 ? '가입한 회원이 없습니다' : '검색과 일치하는 회원이 없습니다'}
            </p>
          )}
        </div>
        {sel.some(id => !pool.some(p => p.id === id)) && (
          <p className="hint" style={{ margin: 0 }}>
            회원 목록에 없는 선택 {sel.filter(id => !pool.some(p => p.id === id)).length}건이 있습니다 — 적용하면 그대로 유지됩니다
          </p>
        )}
      </div>
    </Modal>
  );
}

function MenuPane() {
  const [ms, patch, msLoaded] = useMenuSettings();
  const { user } = useAuth();
  const [visBusy, setVisBusy] = useState(false);
  const [openAsk, setOpenAsk] = useState<(() => void) | null>(null);
  const [visAsk, setVisAsk] = useState(false);
  const [memAsk, setMemAsk] = useState<{ ids: string[]; apply: (ids: string[]) => void; desc?: string } | null>(null);
  const [commSet, patchComm] = useCommSettings();
  const { boards, loaded: bLoaded, patchBoard } = useBoards();
  const toast = useToast();
  const del = useConfirmDelete();
  const saved = ms.tree ?? defaultTree();
  const { map: secMap } = useSections();
  const { links, setLinks } = useCustomLinks();
  const [nlName, setNlName] = useState('');
  const [nlHref, setNlHref] = useState('');
  const extraAll = [...boardEntries(boards), ...sectionMenuEntries(secMap), ...linkEntries(links)];
  const defLabel = (href: string) => menuLabelFor(href, extraAll) ?? href;

  const [draft, setDraft] = useState<MenuGroupNode[] | null>(null);
  const [draftRemoved, setDraftRemoved] = useState<string[] | null>(null);
  const tree = draft ?? saved;
  const removed = draftRemoved ?? ms.removedBoards;
  const dirty = draft !== null && (
    JSON.stringify(draft) !== JSON.stringify(saved)
    || JSON.stringify(removed) !== JSON.stringify(ms.removedBoards));

  const savedKey = JSON.stringify([saved, ms.removedBoards]);
  useEffect(() => {
    if (!msLoaded || !bLoaded) return;
    if (!dirty) { setDraft(saved); setDraftRemoved(ms.removedBoards); }
  }, [savedKey, msLoaded, bLoaded]);

  const setTree = (t: MenuGroupNode[]) => setDraft(t);
  const saveAll = () => { patch({ tree, removedBoards: removed }); toast('메뉴가 저장되었습니다'); };

  const applyVis = async () => {
    const be = backend();
    if (!be) { toast('서버에 연결돼 있지 않습니다 — 브라우저 저장 모드에는 서버 권한 자체가 없습니다'); return; }
    setVisBusy(true);
    try {
      let n = 0;
      for (const coll of CONTENT_COLLECTIONS) {
        const rows = await be.fetchList(coll);
        const targets = rows.filter(r => visFloorOf(coll, r) !== 'public');
        if (targets.length) n += await be.refreshVis(coll, targets, user?.id ?? null);
      }
      toast(n ? `글 ${n}건을 서버에서도 가렸습니다` : '비공개로 둔 메뉴에 글이 없습니다');
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : '적용하지 못했습니다');
    }
    setVisBusy(false);
  };
  const revert = () => { setDraft(saved); setDraftRemoved(ms.removedBoards); };

  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const [leaveAsk, setLeaveAsk] = useState(false);
  const pendingClick = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const onCapture = (e: MouseEvent) => {
      if (!dirtyRef.current) return;
      const t = e.target as HTMLElement | null;
      const hit = t?.closest?.('.topbar a, .topbar button, .topbar .brand, .set-nav button') as HTMLElement | null;
      if (!hit) return;
      e.preventDefault(); e.stopPropagation();
      pendingClick.current = hit; setLeaveAsk(true);
    };
    document.addEventListener('click', onCapture, true);
    return () => document.removeEventListener('click', onCapture, true);
  }, []);
  const [resetAsk, setResetAsk] = useState(false);
  const [mtab, setMtab] = useState<'basic' | 'perm'>('basic');
  const [rpGate, setRpGate] = useState('');
  useEffect(() => { setRpGate(getPageText('rp-gate-desc', '역극은 로그인한 참여자에게만 표시됩니다')); }, []);
  const leaveWith = (action: 'save' | 'discard') => {
    if (action === 'save') patch({ tree, removedBoards: removed });
    else revert();
    dirtyRef.current = false;
    setLeaveAsk(false);
    const el = pendingClick.current;
    pendingClick.current = null;
    setTimeout(() => el?.click(), 30);
  };

  useEffect(() => {
    if (!msLoaded || !bLoaded) return;
    let next: MenuGroupNode[] = saved
      .map(g => (g.href
        ? (menuLabelFor(g.href, extraAll) === null ? null : g)
        : { ...g, items: g.items.filter(it => menuLabelFor(it.href, extraAll) !== null) }))
      .filter((g): g is MenuGroupNode => !!g);
    if (JSON.stringify(next) !== JSON.stringify(saved)) patch({ tree: next });
  }, [msLoaded, bLoaded, boards, ms.tree]);

  const placedSet = new Set(tree.flatMap(g => (g.href ? [g.href] : g.items.map(i => i.href))));
  const unplaced = [
    ...FEATURES.filter(f => !placedSet.has(f.href)),
    ...extraAll.map(b => ({ href: b.href, label: b.name })).filter(x => !placedSet.has(x.href)),
  ];

  const patchGroup = (id: string, p: Partial<MenuGroupNode>) =>
    setTree(tree.map(g => (g.id === id ? { ...g, ...p } : g)));

  const markRemoved = (hrefs: string[]) => {
    const known = new Set(extraAll.map(b => b.href));
    const bs = hrefs.filter(h => known.has(h));
    if (bs.length) setDraftRemoved([...new Set([...removed, ...bs])]);
  };
  const removeGroup = (g: MenuGroupNode) => {
    setTree(tree.filter(x => x.id !== g.id));
    markRemoved(g.href ? [g.href] : g.items.map(i => i.href));
  };
  const askRemoveGroup = (g: MenuGroupNode) => del.ask(
    g.href ? `단독 메뉴 「${g.label}」를 메뉴에서 빼시겠습니까?` : `상위 메뉴 「${g.label}」를 삭제하시겠습니까?`,
    () => removeGroup(g),
    `${g.href ? '이 기능은' : '하위 메뉴는'} 미배치 목록으로 이동하며 데이터는 보존됩니다. SAVE를 눌러야 실제 메뉴에 반영됩니다.`);
  const removeItem = (gid: string, href: string) => {
    setTree(tree.map(g => (g.id === gid ? { ...g, items: g.items.filter(i => i.href !== href) } : g)));
    markRemoved([href]);
  };
  const moveItem = (fromGid: string, it: MenuLeaf, to: string) => {
    const stripped = tree.map(g => (g.id === fromGid ? { ...g, items: g.items.filter(i => i.href !== it.href) } : g));
    if (to === 'solo') {
      setTree([...stripped, { id: newGroupId(), label: it.label ?? defLabel(it.href), href: it.href, items: [], pageTitle: it.pageTitle }]);
    } else {
      setTree(stripped.map(g => (g.id === to ? { ...g, items: [...g.items, it] } : g)));
    }
  };
  const placeUnplaced = (href: string, to: string) => {
    if (to === 'solo') setTree([...tree, { id: newGroupId(), label: defLabel(href), href, items: [] }]);
    else setTree(tree.map(g => (g.id === to ? { ...g, items: [...g.items, { href }] } : g)));
    if (href.startsWith('/board?b=')) setDraftRemoved(removed.filter(h => h !== href));
  };
  const groupOptions = (excludeId?: string) => [
    ...tree.filter(g => !g.href && g.id !== excludeId).map(g => ({ value: g.id, label: `→ ${g.label}` })),
    { value: 'solo', label: '→ 단독 메뉴' },
  ];

  const permSel = (label: string, value: MenuPerm, onChange: (v: MenuPerm) => void) => (
    <KSelect minWidth={110} value={value} onChange={v => onChange(v as MenuPerm)}
      options={[
        { value: 'guest', label: `${label}: 방문자` },
        { value: 'member', label: `${label}: 가입자` },
        { value: 'admin', label: `${label}: 관리자` },
      ]} />
  );

  const extraFor = (href: string) => {
    switch (href) {
      case '/gallery': return (
        <div className="mini-seg">
          <button className={ms.backupView === 'gal' ? 'on' : ''} onClick={() => patch({ backupView: 'gal' })}>기본: 갤러리</button>
          <button className={ms.backupView === 'list' ? 'on' : ''} onClick={() => patch({ backupView: 'list' })}>기본: 리스트</button>
        </div>
      );
      case '/comm': return (
        <div className="mini-seg">
          <button className={commSet.ratio === '3:4' ? 'on' : ''} onClick={() => patchComm({ ratio: '3:4' })}>비율 3:4</button>
          <button className={commSet.ratio === '4:3' ? 'on' : ''} onClick={() => patchComm({ ratio: '4:3' })}>비율 4:3</button>
        </div>
      );
      case '/cal': return (
        <div className="mini-seg">
          <button className={(ms.calTitle ?? 'en') === 'en' ? 'on' : ''} onClick={() => patch({ calTitle: 'en' })}>AUGUST 2026</button>
          <button className={ms.calTitle === 'num' ? 'on' : ''} onClick={() => patch({ calTitle: 'num' })}>2026.08</button>
        </div>
      );
      default: return null;
    }
  };

// ── [수정] 캐릭터(/chars) 및 자관(/rels) 글쓰기/편집 권한 조건 강화 ──
  const extraPerm = (href: string) => {
    // /chars, /chars?s=..., /chars/ 등 캐릭터 관련 모든 경로 대응
    if (href === '/chars' || href.startsWith('/chars?') || href.startsWith('/chars/')) {
      const perm = ms.charWrite ?? 'admin';
      return (
        <KSelect minWidth={110} value={perm} onChange={v => patch({ charWrite: v as MenuPerm })}
          options={[
            { value: 'member', label: '글쓰기: 가입자' },
            { value: 'admin', label: '글쓰기: 관리자' },
          ]} />
      );
    }
    // /rels, /rels?s=..., /rels/ 등 자관 관련 모든 경로 대응
    if (href === '/rels' || href.startsWith('/rels?') || href.startsWith('/rels/')) {
      const perm = ms.relWrite ?? 'admin';
      return (
        <KSelect minWidth={110} value={perm} onChange={v => patch({ relWrite: v as MenuPerm })}
          options={[
            { value: 'member', label: '글쓰기: 가입자' },
            { value: 'admin', label: '글쓰기: 관리자' },
          ]} />
      );
    }
    if (href === '/rp') {
      return (
        <KInput value={rpGate}
          onChange={e => { setRpGate(e.target.value); setPageText('rp-gate-desc', e.target.value); }}
          placeholder="비밀번호 안내 문구" style={{ width: 210, fontSize: 12 }} />
      );
    }
    if (href === '/board' || href.startsWith('/board?b=')) {
      const bid = href === '/board' ? MAIN_BOARD_ID : href.slice('/board?b='.length);
      const bd = boards.find(b => b.id === bid);
      if (!bd) return null;
      return (
        <>
          <KSelect minWidth={110} value={bd.permWrite}
            onChange={v => patchBoard(bd.id, { permWrite: v as BoardPerm })}
            options={[
              { value: 'member', label: '글쓰기: 가입자' },
              { value: 'admin', label: '글쓰기: 관리자' },
            ]} />
          <KSelect minWidth={110} value={bd.permComment}
            onChange={v => patchBoard(bd.id, { permComment: v as BoardPerm })}
            options={[
              { value: 'guest', label: '댓글: 방문자' },
              { value: 'member', label: '댓글: 가입자' },
              { value: 'admin', label: '댓글: 관리자' },
            ]} />
        </>
      );
    }
    if (href === '/loadb') {
      return (
        <>
          {permSel('업로드', ms.roadUpload, v => patch({ roadUpload: v }))}
          {permSel('댓글', ms.roadComment, v => patch({ roadComment: v }))}
        </>
      );
    }
    if (href === '/gallery' || href.startsWith('/gallery?s=')) {
      const key = href === '/gallery' ? MAIN_SEC : href.slice('/gallery?s='.length);
      const gsec = sectionsOf(secMap, 'gallery').find(s2 => s2.id === key || s2.slug === key);
      if (!gsec) return null;
      const gw = ms.galWrite?.[gsec.id] ?? 'member';
      const gwIds = ms.galWriteMembers?.[gsec.id];
      return (
        <>
          {gw === 'member' && (
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
              onClick={() => setMemAsk({
                ids: gwIds ?? [],
                desc: '체크한 회원(그리고 관리자)만 이 갤러리에 글을 쓸 수 있습니다 — 비우면 로그인한 모든 회원',
                apply: n => {
                  const next = { ...ms.galWriteMembers };
                  if (n.length) next[gsec.id] = n; else delete next[gsec.id];
                  patch({ galWriteMembers: next });
                },
              })}>
              {gwIds?.length ? `글쓰기 멤버 ${gwIds.length}명` : '글쓰기 멤버'}
            </button>
          )}
          <KSelect minWidth={110} value={gw}
            onChange={v => {
              const next = { ...ms.galWriteMembers };
              if (v !== 'member') delete next[gsec.id];
              patch({ galWrite: { ...ms.galWrite, [gsec.id]: v as MenuPerm }, galWriteMembers: next });
            }}
            options={[
              { value: 'member', label: '글쓰기: 가입자' },
              { value: 'admin', label: '글쓰기: 관리자' },
            ]} />
        </>
      );
    }
    return null;
  };

  const openChk = (v: MenuVis | undefined, open: boolean | undefined, onChange: (nv: boolean) => void) => (
    (v ?? 'all') === 'all' ? null : (
      <KCheck label={<span style={{ fontSize: 11 }}>주소로는 열람 허용</span>} checked={!!open}
        onChange={nv => { if (nv) setOpenAsk(() => () => onChange(true)); else onChange(false); }} />
    )
  );

  const visSel = (v: MenuVis | undefined, onChange: (nv: MenuVis) => void) => (
    <KSelect minWidth={128} value={v ?? 'all'} onChange={nv => onChange(nv as MenuVis)}
      options={[
        { value: 'all', label: '전부 보임' },
        { value: 'member', label: '비로그인 숨김' },
        { value: 'admin', label: '관리자만' },
      ]} />
  );

  const memberBtn = (v: MenuVis | undefined, ids: string[] | undefined, apply: (ids: string[] | undefined) => void) => (
    v !== 'member' ? null : (
      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
        onClick={() => setMemAsk({ ids: ids ?? [], apply: n => apply(n.length ? n : undefined) })}>
        {ids?.length ? `멤버 ${ids.length}명` : '멤버 선택'}
      </button>
    )
  );

  return (
    <div className="set-sec">
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>메뉴 관리</h3>
        {dirty && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginTop: 3 }}>저장 안 된 변경</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 11 }}
            onClick={() => setResetAsk(true)}>기본 구성</button>
          <button className="btn btn-ghost" disabled={!dirty} style={{ opacity: dirty ? 1 : 0.45, padding: '6px 14px', fontSize: 11 }}
            onClick={() => { revert(); toast('저장된 메뉴로 되돌렸습니다'); }}>변경 취소</button>
          <button className="btn btn-dark" disabled={!dirty} style={{ opacity: dirty ? 1 : 0.45, padding: '6px 18px', fontSize: 11 }}
            onClick={saveAll}>SAVE</button>
        </div>
      </div>
      <div className="mini-seg" style={{ marginBottom: 14 }}>
        <button className={mtab === 'basic' ? 'on' : ''} onClick={() => setMtab('basic')}>기본</button>
        <button className={mtab === 'perm' ? 'on' : ''} onClick={() => setMtab('perm')}>권한</button>
      </div>

      {mtab === 'perm' ? (
        <div>
          <div className="d">
            공개범위는 메뉴 노출을 정합니다(전부 보임 / 비로그인 숨김 / 관리자만) — SAVE를 눌러야 반영 · 글쓰기·댓글 권한은 즉시 반영
            <br />
            「비로그인 숨김」 옆 <b>멤버 선택</b>으로 특정 회원에게만 보이게 좁힐 수 있습니다 — 비우면 로그인한 모든 회원
            <br />
            <b>주소로는 열람 허용</b>을 켜면 메뉴에서는 계속 감춰 두고 <b>주소를 아는 사람만 들어올 수 있는</b> 메뉴가 됩니다 — 링크로 돌릴 게시판에 씁니다
          </div>
          {tree.map(g => (
            <div key={g.id} style={{ borderBottom: '1px dashed var(--line)', padding: '9px 0' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13 }}>{g.label}</b>
                {g.href && <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>{g.href}</small>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* 단독 메뉴이거나 상위 메뉴에 href가 있는 경우 extraPerm 실행 */}
                  {g.href && extraPerm(g.href)}
                  {openChk(g.vis, g.open, nv => patchGroup(g.id, { open: nv || undefined }))}
                  {memberBtn(g.vis, g.visMembers, ids => patchGroup(g.id, { visMembers: ids }))}
                  {visSel(g.vis, nv => patchGroup(g.id, {
                    vis: nv === 'all' ? undefined : nv,
                    ...(nv === 'all' ? { open: undefined } : {}),
                    ...(nv !== 'member' ? { visMembers: undefined } : {}),
                  }))}
                </div>
              </div>
              
              {/* 상위 그룹 하위에 속한 캐릭터/자관 메뉴 렌더링 부분 */}
              {!g.href && g.items.map(it => (
                <div key={it.href} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0 0 22px' }}>
                  <span style={{ fontSize: 12.5 }}>{it.label ?? defLabel(it.href)}</span>
                  <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>{it.href}</small>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* ★ 하위 메뉴 항목에서도 extraPerm(it.href)가 호출되어야 함 */}
                    {extraPerm(it.href)}
                    {openChk(it.vis, it.open, nv => patchGroup(g.id, {
                      items: g.items.map(x => (x.href === it.href ? { ...x, open: nv || undefined } : x)),
                    }))}
                    {memberBtn(it.vis, it.visMembers, ids => patchGroup(g.id, {
                      items: g.items.map(x => (x.href === it.href ? { ...x, visMembers: ids } : x)),
                    }))}
                    {visSel(it.vis, nv => patchGroup(g.id, {
                      items: g.items.map(x => (x.href === it.href
                        ? {
                          ...x, vis: nv === 'all' ? undefined : nv,
                          ...(nv === 'all' ? { open: undefined } : {}),
                          ...(nv !== 'member' ? { visMembers: undefined } : {}),
                        } : x)),
                    }))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <b style={{ fontSize: 13 }}>열람 비공개 처리</b>
            <div className="d" style={{ marginTop: 4, lineHeight: 1.7 }}>
              위 공개범위는 <b>화면에서 가리는 것</b>이라, 주소나 API를 직접 부르면 글이 그대로 나옵니다.
              이 버튼을 누르면 <b>이미 올라간 글의 공개범위를 서버에 적용</b>해 서버가 아예 내주지 않게 합니다
              — 「비로그인 숨김」은 회원공개로, 「관리자만」은 비공개로.
              <br />
              <b>지금부터 쓰는 글은 누르지 않아도 그렇게 저장됩니다.</b>{' '}
              <span style={{ color: 'var(--accent)' }}>좁히기만 하고 넓히지는 않습니다</span> —
              나중에 다시 공개로 바꾸려면 각 글의 공개범위를 직접 되돌려야 합니다.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-dark" disabled={visBusy || dirty}
                onClick={() => setVisAsk(true)}>
                {visBusy ? '적용 중…' : dirty ? 'SAVE 먼저' : '글에도 적용'}
              </button>
            </div>
          </div>
          {memAsk && (
            <MemberPickModal initial={memAsk.ids} onApply={memAsk.apply} desc={memAsk.desc}
              onClose={() => setMemAsk(null)} />
          )}

          <ConfirmModal open={!!openAsk} title="주소가 있는 모두에게 공개됩니다"
            body={'메뉴에서는 계속 감춰지지만, 이 주소를 아는 사람은 로그인하지 않아도 들어와 볼 수 있습니다. 링크를 받은 사람이 다른 곳에 옮겨 적으면 그 사람들도 볼 수 있습니다. 정말 알려지면 안 되는 내용에는 쓰지 마세요.'}
            onClose={() => setOpenAsk(null)}
            buttons={[
              { label: 'CANCEL', kind: 'ghost', onClick: () => setOpenAsk(null) },
              { label: '알겠습니다', kind: 'dark', onClick: () => { openAsk?.(); setOpenAsk(null); } },
            ]} />

          <ConfirmModal open={visAsk} title="글 공개범위를 서버에 적용할까요?"
            body={'비공개로 둔 메뉴의 글이 서버에서도 가려집니다. 각 글의 공개범위가 바뀌므로, 되돌리려면 글마다 직접 고쳐야 합니다.'}
            onClose={() => setVisAsk(false)}
            buttons={[
              { label: 'CANCEL', kind: 'ghost', onClick: () => setVisAsk(false) },
              { label: '적용', kind: 'dark', onClick: () => { setVisAsk(false); void applyVis(); } },
            ]} />

          <div style={{ marginTop: 18 }}>
            <b style={{ fontSize: 13 }}>이미지 저장 방지</b>
            <div className="d" style={{ marginTop: 4 }}>체크한 영역에서 이미지 우클릭 저장·드래그 반출을 막습니다 — 관리자 계정은 제외 · 즉시 반영</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
              {IMG_PROTECT_AREAS.map(a => (
                <KCheck key={a.key} label={a.label}
                  checked={(ms.imgProtect ?? []).includes(a.key)}
                  onChange={v => patch({
                    imgProtect: v
                      ? [...(ms.imgProtect ?? []), a.key]
                      : (ms.imgProtect ?? []).filter(k => k !== a.key),
                  })} />
              ))}
            </div>
          </div>
        </div>
      ) : (
      <>
      <DragList items={tree} keyOf={g => g.id} onReorder={setTree}
        render={g => (
          <div style={{ width: '100%', borderBottom: '1px dashed var(--line)', padding: '10px 0' }}>
            <div className="set-row" style={{ border: 'none', padding: 0 }}>
              <div className="l" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="drag-h">⠿</span>
                <KInput value={g.label} onChange={e => patchGroup(g.id, { label: e.target.value })}
                  style={{ width: 110, fontWeight: 700 }} />
                {g.href ? (
                  <>
                    <span className="cp-lb">타이틀</span>
                    <KInput value={g.pageTitle ?? ''} placeholder="기본"
                      onChange={e => patchGroup(g.id, { pageTitle: e.target.value || undefined })}
                      style={{ width: 120, fontSize: 12 }} />
                    <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>단독 · {g.href}</small>
                  </>
                ) : <span className="pill">상위</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {g.href && extraFor(g.href)}
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                  onClick={() => askRemoveGroup(g)}>{g.href ? '빼기' : 'DELETE'}</button>
              </div>
            </div>
            {!g.href && (
              <div style={{ padding: '8px 0 0 34px' }}>
                <DragList items={g.items} keyOf={it => it.href}
                  onReorder={items => patchGroup(g.id, { items })}
                  render={it => (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', width: '100%', padding: '3px 0' }}>
                      <span className="drag-h" style={{ fontSize: 11 }}>⠿</span>
                      <KInput value={it.label ?? ''} placeholder={defLabel(it.href)}
                        onChange={e => patchGroup(g.id, {
                          items: g.items.map(x => (x.href === it.href
                            ? { ...x, label: e.target.value || undefined } : x)),
                        })}
                        style={{ width: 110, fontSize: 12 }} />
                      <span className="cp-lb">타이틀</span>
                      <KInput value={it.pageTitle ?? ''} placeholder="기본"
                        onChange={e => patchGroup(g.id, {
                          items: g.items.map(x => (x.href === it.href
                            ? { ...x, pageTitle: e.target.value || undefined } : x)),
                        })}
                        style={{ width: 120, fontSize: 12 }} />
                      <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>{it.href}</small>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {extraFor(it.href)}
                        <KSelect minWidth={104} value="" placeholder="이동"
                          onChange={v => moveItem(g.id, it, v)} options={groupOptions(g.id)} />
                        <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 10.5 }}
                          onClick={() => removeItem(g.id, it.href)}>빼기</button>
                      </div>
                    </div>
                  )} />
                {g.items.length === 0 && (
                  <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>하위 메뉴가 없으면 상단 메뉴에 표시되지 않습니다 — 아래 「미배치 기능」에서 추가</small>
                )}
              </div>
            )}
          </div>
        )} />
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
          onClick={() => setTree([...tree, { id: newGroupId(), label: '새 메뉴', items: [] }])}>＋ ADD MENU</button>
      </div>

      <h3 style={{ marginTop: 26 }}>미배치 기능</h3>
      <div className="d">트리에 넣지 않은 기능 — 메뉴에 노출되지 않지만 데이터는 보존됩니다. 넣을 위치를 고르면 바로 배치</div>
      {unplaced.map(f => {
        const link = links.find(l => l.href === f.href);
        return (
          <div key={f.href} className="set-row">
            <div className="l" style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <b style={{ fontSize: 12.5 }}>{f.label}</b>
              <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>{f.href}</small>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <KSelect minWidth={130} value="" placeholder="배치할 위치"
                onChange={v => placeUnplaced(f.href, v)} options={groupOptions()} />
              {link && (
                <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 10.5 }}
                  onClick={() => del.ask(`커스텀 링크 「${link.name}」를 지우시겠습니까?`,
                    () => setLinks(links.filter(x => x.id !== link.id)),
                    '링크만 사라집니다 — 가리키던 페이지 자체는 그대로입니다.')}>삭제</button>
              )}
            </div>
          </div>
        );
      })}
      {unplaced.length === 0 && (
        <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--faint)' }}>모든 기능이 메뉴에 배치되어 있습니다</div>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 22 }}>
        <h3 style={{ margin: 0 }}>커스텀 링크</h3>
      </div>
      <div className="d">
        자관·캐릭터처럼 목록에서 골라야 갈 수 있던 페이지를 메뉴에서 바로 — 주소를 적어 두면 됩니다.
        <br />
        <b>내 홈 주소</b>는 붙여 넣으면 사이트 안 이동으로 바뀌고(예: <code>…/rels/latte</code> → <code>/rels/latte</code>),
        <b>다른 사이트 주소</b>는 그대로 남아 새 창으로 열립니다.
        만든 링크는 위 <b>미배치</b>에 나타나며, 거기서 원하는 상위 메뉴에 넣어 주세요.
      </div>
      {links.map(l => (
        <div key={l.id} className="set-row">
          <div className="l" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <KInput value={l.name} placeholder="메뉴에 보일 이름"
              onChange={e => setLinks(links.map(x => (x.id === l.id ? { ...x, name: e.target.value } : x)))}
              style={{ width: 140 }} />
            <KInput value={l.href} placeholder="/rels/latte 또는 풀주소"
              onChange={e => setLinks(links.map(x => (x.id === l.id ? { ...x, href: e.target.value } : x)))}
              onBlur={e => setLinks(links.map(x => (x.id === l.id ? { ...x, href: toInternalPath(e.target.value) } : x)))}
              style={{ width: 260 }} />
          </div>
          <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
            onClick={() => del.ask(`커스텀 링크 「${l.name}」를 지우시겠습니까?`,
              () => {
                setLinks(links.filter(x => x.id !== l.id));
                setTree(tree.map(g => ({ ...g, items: g.items.filter(i => i.href !== l.href) })).filter(g => g.href !== l.href));
              },
              '메뉴에 배치해 두었다면 그 자리도 함께 비워집니다. 가리키던 페이지 자체는 그대로입니다.')}>DELETE</button>
        </div>
      ))}
      {links.length === 0 && (
        <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--faint)' }}>아직 없습니다 — 아래에 이름과 주소를 적고 ADD를 눌러 주세요</div>
      )}
      <div className="set-row" style={{ borderTop: '1px dashed var(--line)' }}>
        <div className="l" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <KInput value={nlName} placeholder="메뉴에 보일 이름" onChange={e => setNlName(e.target.value)} style={{ width: 140 }} />
          <KInput value={nlHref} placeholder="/rels/latte 또는 풀주소" onChange={e => setNlHref(e.target.value)} style={{ width: 260 }} />
        </div>
        <button className="btn btn-dark" style={{ padding: '4px 12px', fontSize: 10.5 }}
          onClick={() => {
            if (!nlName.trim()) { toast('메뉴에 보일 이름을 입력해 주세요'); return; }
            const href = toInternalPath(nlHref);
            if (!href || href === '/') { toast('이동할 주소를 입력해 주세요'); return; }
            setLinks([...links, { id: newId(), name: nlName.trim(), href }]);
            setNlName(''); setNlHref('');
            toast('링크가 만들어졌습니다 — 위 미배치에서 메뉴에 넣어 주세요');
          }}>＋ ADD</button>
      </div>
      </>
      )}

      {del.element}
      <ConfirmModal open={resetAsk} title="메뉴를 기본 구성으로 되돌리시겠습니까?"
        body="기본 제공 메뉴 구성(자놀·게시판·TRPG·커미션·기록·방명록)으로 편집 화면이 바뀝니다. SAVE를 눌러야 실제 메뉴에 반영됩니다."
        onClose={() => setResetAsk(false)}
        buttons={[
          { label: 'RESET', kind: 'dark', onClick: () => { setDraft(defaultTree()); setDraftRemoved([]); setResetAsk(false); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setResetAsk(false) },
        ]} />
      <ConfirmModal open={leaveAsk} title="메뉴가 저장되지 않았습니다"
        body="이대로 이동하면 편집 중인 메뉴 변경사항이 사라집니다."
        onClose={() => { pendingClick.current = null; setLeaveAsk(false); }}
        buttons={[
          { label: '저장 후 이동', kind: 'dark', onClick: () => leaveWith('save') },
          { label: '저장하지 않고 이동', kind: 'ghost', onClick: () => leaveWith('discard') },
          { label: 'CANCEL', kind: 'ghost', onClick: () => { pendingClick.current = null; setLeaveAsk(false); } },
        ]} />
    </div>
  );
}

function TrpgPane() {
  const [settings, patch] = useTrpgSettings();
  const [ms, patchMenu] = useMenuSettings();
  const [lockDesc, setLockDesc] = useState('');
  useEffect(() => { setLockDesc(getPageText('trpg-lock-desc', '비밀번호를 입력하면 열람할 수 있습니다')); }, []);
  const patchStatus = (k: DotoriStatus, p: Partial<(typeof settings.statuses)[DotoriStatus]>) =>
    patch({ statuses: { ...settings.statuses, [k]: { ...settings.statuses[k], ...p } } });

  const colToggle = (list: string[], k: keyof MenuSettings) => (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${PLAYLOG_COLS.length}, 1fr)`, gap: 6, justifyItems: 'center' }}>
      {PLAYLOG_COLS.map(c => (
        <KCheck key={c.key} label={c.label} checked={list.includes(c.key)}
          onChange={v => patchMenu({ [k]: v ? [...list, c.key] : list.filter(x => x !== c.key) } as Partial<MenuSettings>)} />
      ))}
    </div>
  );

  return (
    <div className="set-sec">
      <h3>로그 열람 안내 문구</h3>
      <div className="d">비밀번호를 건 로그에 들어갔을 때 보이는 문구입니다 — 관리자에게는 그 화면이 뜨지 않아 여기서 고칩니다</div>
      <div className="set-row" style={{ alignItems: 'center' }}>
        <div className="l"><b>비밀번호 안내</b><small>비우면 기본 문구로 표시됩니다</small></div>
        <KInput value={lockDesc}
          onChange={e => { setLockDesc(e.target.value); setPageText('trpg-lock-desc', e.target.value); }}
          placeholder="비밀번호를 입력하면 열람할 수 있습니다" style={{ width: 300 }} />
      </div>

      <h3>도토리 상태 카테고리</h3>
      <div className="d">라벨과 뱃지 색(배경/테두리/글씨) — 카드 뱃지는 공수표·일정 확정만 표시</div>
      {DOTORI_STATUS_KEYS.map(k => {
        const st = settings.statuses[k];
        return (
          <div key={k} className="set-row" style={{ alignItems: 'center' }}>
            <div className="l">
              <span className="dt-badge" style={{ ...dotoriBadgeStyle(st), position: 'static' }}>{st.label || '상태'}</span>
            </div>
            <div className="cp-group" style={{ justifyContent: 'flex-end' }}>
              <KInput value={st.label} onChange={e => patchStatus(k, { label: e.target.value })}
                style={{ width: 100, textAlign: 'right' }} />
              <span className="cp-lb">배경</span>
              <ColorField value={st.bg} onChange={hex => patchStatus(k, { bg: hex })} />
              <span className="cp-lb">테두리</span>
              <ColorField value={st.border} onChange={hex => patchStatus(k, { border: hex })} />
              <span className="cp-lb">글씨</span>
              <ColorField value={st.fg} onChange={hex => patchStatus(k, { fg: hex })} />
            </div>
          </div>
        );
      })}

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1.5px solid var(--line)' }} />
      <h3>플레이기록 표시 열</h3>
      <div className="d">PC와 모바일에서 보여줄 열을 각각 선택 (기본: PC 전체 7열 · 모바일 Date/Scenario/Role/Playtime)</div>
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l" style={{ width: 64, flexShrink: 0 }}><b>PC</b></div>
        {colToggle(ms.playlogPc, 'playlogPc')}
      </div>
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l" style={{ width: 64, flexShrink: 0 }}><b>모바일</b></div>
        {colToggle(ms.playlogMobile, 'playlogMobile')}
      </div>
    </div>
  );
}

function MemoPane() {
  const [settings, patch] = useMemoSettings();
  return (
    <div className="set-sec">
      <h3>스티커 메모장</h3>
      <div className="d">포스트잇 보드 옵션 — 배치·순서는 저장되어 모두에게 동일</div>
      <div className="set-row">
        <div className="l"><b>회원 작성 허용</b><small>끄면 관리자만 메모를 붙일 수 있습니다</small></div>
        <KToggle checked={settings.allowMember} onChange={v => patch({ allowMember: v })} />
      </div>
      <div className="set-row">
        <div className="l"><b>작성자 표시</b><small>포스트잇 상단에 작성자 닉네임 표시</small></div>
        <KToggle checked={settings.showAuthor} onChange={v => patch({ showAuthor: v })} />
      </div>
    </div>
  );
}

function ThreadPane() {
  const [settings, patch] = useThreadSettings();
  const [works] = useLocalList<ThreadWork>('ohome.threads.v1', THREAD_SEED);
  const del = useConfirmDelete();
  const { list } = useSections();
  const secs = list('threads');
  const [secId, setSecId] = useState(MAIN_SEC);
  const cur = secs.find(s => s.id === secId) ? secId : MAIN_SEC;
  const cats = threadCats(settings, cur);
  const setCats = (next: ThreadCat[]) => patch(threadCatsPatch(settings, cur, next));
  const patchCat = (id: string, p: Partial<ThreadCat>) =>
    setCats(cats.map(c => (c.id === id ? { ...c, ...p } : c)));

  return (
    <div className="set-sec">
      <h3>기본 보기</h3>
      <div className="d">감상타래 메뉴에 들어왔을 때 먼저 보일 보기</div>
      <div className="set-row">
        <div className="l"><b>첫 화면</b><small>타래 보기 / 리스트 보기(포스터 카드 그리드)</small></div>
        <div className="mini-seg">
          <button className={settings.defaultView === 'thread' ? 'on' : ''}
            onClick={() => patch({ defaultView: 'thread' })}>타래 보기</button>
          <button className={settings.defaultView === 'list' ? 'on' : ''}
            onClick={() => patch({ defaultView: 'list' })}>리스트 보기</button>
        </div>
      </div>

      <h3 style={{ marginTop: 26 }}>분류 리스트</h3>
      <div className="d">
        작품 분류 뱃지 — 이름 · 배경/테두리/글씨색 · ⠿ 드래그로 순서 · 추가/삭제
        {secs.length > 1 && <><br />감상타래마다 따로 정합니다 — <b>손대기 전까지는 기본 감상타래의 분류를 그대로 씁니다</b></>}
      </div>
      {secs.length > 1 && (
        <div className="mini-seg" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
          {secs.map(s => (
            <button key={s.id} className={cur === s.id ? 'on' : ''} onClick={() => setSecId(s.id)}>{s.name}</button>
          ))}
        </div>
      )}
      <DragList items={cats} keyOf={c => c.id} onReorder={next => setCats(next)}
        render={c => (
          <div className="set-row" style={{ width: '100%' }}>
            <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <span className="drag-h">⠿</span>
              <span className="pill" style={threadBadgeStyle(c)}>{c.label || '분류'}</span>
            </div>
            <div className="cp-group" style={{ justifyContent: 'flex-end' }}>
              <KInput value={c.label} onChange={e => patchCat(c.id, { label: e.target.value })}
                style={{ width: 100, textAlign: 'right' }} />
              <span className="cp-lb">배경</span>
              <ColorField value={c.bg ?? '#1d2025'} onChange={hex => patchCat(c.id, { bg: hex })} />
              <span className="cp-lb">테두리</span>
              <ColorField value={c.border ?? c.bg ?? '#1d2025'} onChange={hex => patchCat(c.id, { border: hex })} />
              <span className="cp-lb">글씨</span>
              <ColorField value={c.fg ?? '#ffffff'} onChange={hex => patchCat(c.id, { fg: hex })} />
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                onClick={() => {
                  const used = works.filter(w => w.catId === c.id && inSection(w.secId, cur)).length;
                  del.ask(`분류 「${c.label}」를 삭제하시겠습니까?`,
                    () => setCats(cats.filter(x => x.id !== c.id)),
                    used > 0 ? `이 분류의 타래 ${used}개는 유지되지만 분류가 「기타」로 표시됩니다.` : undefined);
                }}>DELETE</button>
            </div>
          </div>
        )} />
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
          onClick={() => setCats([...cats, { id: newId(), label: '새 분류' }])}>
          ＋ ADD
        </button>
      </div>
      {del.element}
    </div>
  );
}

function CommBadgeRows({ list, shape, onChange, fixedIds }: {
  list: CommBadge[]; shape: 'round' | 'pill';
  onChange: (next: CommBadge[]) => void;
  fixedIds: string[];
}) {
  const del = useConfirmDelete();
  const patch = (id: string, p: Partial<CommBadge>) =>
    onChange(list.map(b => (b.id === id ? { ...b, ...p } : b)));

  return (
    <>
      {list.map(b => (
        <div key={b.id} className="set-row" style={{ alignItems: 'center' }}>
          <div className="l"><span style={badgeStyle(b, shape)}>{b.label || '뱃지'}</span></div>
          <div className="cp-group" style={{ justifyContent: 'flex-end' }}>
            <KInput value={b.label} onChange={e => patch(b.id, { label: e.target.value })}
              style={{ width: 90, textAlign: 'right' }} />
            <span className="cp-lb">배경</span>
            <ColorField value={b.bg} onChange={hex => patch(b.id, { bg: hex })} />
            <span className="cp-lb">테두리</span>
            <ColorField value={b.border} onChange={hex => patch(b.id, { border: hex })} />
            <span className="cp-lb">글씨</span>
            <ColorField value={b.fg} onChange={hex => patch(b.id, { fg: hex })} />
            {!fixedIds.includes(b.id) && (
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                onClick={() => del.ask(`뱃지 「${b.label}」를 삭제하시겠습니까?`, () => onChange(list.filter(x => x.id !== b.id)), '이 뱃지를 쓰던 항목은 뱃지 없음으로 표시됩니다.')}>DELETE</button>
            )}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
          onClick={() => onChange([...list, { id: newId(), label: '새 뱃지', bg: '#5d636d', border: '#4a505a', fg: '#ffffff' }])}>
          ＋ ADD BADGE
        </button>
      </div>
      {del.element}
    </>
  );
}

function CommPane() {
  const [st, patch] = useCommSettings();
  return (
    <div className="set-sec">
      <h3>커미션</h3>
      <div className="d">커미션 리스트·상세·신청자 리스트의 뱃지와 슬롯 설정 — 변경 즉시 반영</div>

      <div className="set-row">
        <div className="l"><b>썸네일 비율</b><small>커미션 갤러리 전체에 일괄 적용</small></div>
        <div className="mini-seg">
          <button className={st.ratio === '3:4' ? 'on' : ''} onClick={() => patch({ ratio: '3:4' })}>3:4 세로</button>
          <button className={st.ratio === '4:3' ? 'on' : ''} onClick={() => patch({ ratio: '4:3' })}>4:3 가로</button>
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>뱃지 모양</b><small>커미션·신청자 뱃지 공통</small></div>
        <div className="mini-seg">
          <button className={st.badgeShape === 'round' ? 'on' : ''} onClick={() => patch({ badgeShape: 'round' })}>라운드 스퀘어</button>
          <button className={st.badgeShape === 'pill' ? 'on' : ''} onClick={() => patch({ badgeShape: 'pill' })}>동그란 필</button>
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>전체 슬롯</b><small>동시에 받을 수 있는 총 슬롯 — 리스트 상단에 남은/전체로 표시 (수동 갱신)</small></div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--sub)' }}>총</span>
          <KStep value={st.totalSlot} min={1} max={50} onChange={v => patch({ totalSlot: v, totalUsed: Math.min(st.totalUsed, v) })} />
          <span style={{ fontSize: 11.5, color: 'var(--sub)' }}>사용</span>
          <KStep value={st.totalUsed} min={0} max={st.totalSlot} onChange={v => patch({ totalUsed: v })} />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>슬롯 표시 기준</b><small>리스트·상세에 3/5로 적을 때 앞 숫자를 무엇으로 볼지 — 운영 방식에 따라 다릅니다</small></div>
        <div className="mini-seg">
          <button className={(st.slotDisplay ?? 'used') === 'used' ? 'on' : ''} onClick={() => patch({ slotDisplay: 'used' })}>채워진 슬롯</button>
          <button className={st.slotDisplay === 'remain' ? 'on' : ''} onClick={() => patch({ slotDisplay: 'remain' })}>남은 슬롯</button>
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>신청자 리스트 공개범위</b><small>리스트 자체의 공개 — 각 신청 내용은 별개(관리자/허용된 본인만)</small></div>
        <KSelect minWidth={130} value={st.applyVisibility} onChange={v => patch({ applyVisibility: v as CommSettings['applyVisibility'] })}
          options={[
            { value: 'public', label: '전체공개' },
            { value: 'member', label: '멤버공개' },
            { value: 'private', label: '비공개' },
          ]} />
      </div>

      <div className="set-row">
        <div className="l"><b>신청 휴지통 보관 기간</b><small>휴지통으로 옮긴 신청을 며칠 두었다가 없앨지 — 기간이 지나면 목록을 열 때 자동으로 사라집니다</small></div>
        <KStep value={st.trashDays ?? 30} min={1} max={365} suffix="일" onChange={v => patch({ trashDays: v })} />
      </div>

      <h3 style={{ marginTop: 26 }}>커미션 뱃지</h3>
      <div className="d">기본 3종(모집중·마감·준비중)은 고정 제공 — 글씨·색은 자유 수정</div>
      <CommBadgeRows list={st.commBadges} shape={st.badgeShape} fixedIds={['open', 'closed', 'ready']}
        onChange={next => patch({ commBadges: next })} />

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1.5px solid var(--line)' }} />

      <h3>신청자 리스트 뱃지</h3>
      <div className="d">대기·작업중·완료 — 커미션 뱃지와 색 변수 별도</div>
      <CommBadgeRows list={st.applyBadges} shape={st.badgeShape} fixedIds={['wait', 'working', 'done']}
        onChange={next => patch({ applyBadges: next })} />
    </div>
  );
}

function BgmTrackRow({ t, onPatch, onDelete }: {
  t: BgmTrack; onPatch: (p: Partial<BgmTrack>) => void; onDelete: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.title);
  const [desc, setDesc] = useState(t.desc);
  const [url, setUrl] = useState(t.videoId);

  if (editing) {
    return (
      <div style={{ display: 'grid', gap: 7, padding: '10px 0', borderBottom: '1px dashed var(--line)', width: '100%' }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <KInput placeholder="곡 제목" value={title} onChange={e => setTitle(e.target.value)} style={{ maxWidth: 150 }} />
          <KInput placeholder="설명 (선택)" value={desc} onChange={e => setDesc(e.target.value)} style={{ flex: 1, minWidth: 130 }} />
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <KInput placeholder="유튜브 URL 또는 영상 ID" value={url} onChange={e => setUrl(e.target.value)} />
          <button className="btn btn-dark" style={{ whiteSpace: 'nowrap' }}
            onClick={() => {
              const vid = parseVideoId(url);
              if (!title.trim() || !vid) { toast('제목과 올바른 유튜브 URL(또는 영상 ID)을 입력해 주세요'); return; }
              onPatch({ title: title.trim(), desc: desc.trim(), videoId: vid });
              setEditing(false);
              toast('곡이 수정되었습니다');
            }}>SAVE</button>
          <button className="btn btn-ghost" style={{ whiteSpace: 'nowrap' }}
            onClick={() => { setEditing(false); setTitle(t.title); setDesc(t.desc); setUrl(t.videoId); }}>CANCEL</button>
        </div>
      </div>
    );
  }

  return (
    <div className="set-row" style={{ width: '100%' }}>
      <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
        <span className="drag-h">⠿</span>
        <div><b>{t.title}</b><small>{t.desc || t.videoId}</small></div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
          onClick={() => setEditing(true)}>EDIT</button>
        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
          onClick={onDelete}>DELETE</button>
      </div>
    </div>
  );
}

function BgmPane() {
  const { state, setTracks, addTrack, removeTrack, setSettings } = useBgm();
  const toast = useToast();
  const del = useConfirmDelete();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [url, setUrl] = useState('');

  const add = () => {
    if (addTrack(title, desc, url)) {
      setTitle(''); setDesc(''); setUrl('');
      toast('곡이 추가되었습니다');
    } else {
      toast('제목과 올바른 유튜브 URL(또는 영상 ID)을 입력해 주세요');
    }
  };

  return (
    <div className="set-sec">
      <h3>BGM</h3>
      <div className="d">유튜브 곡 목록 관리 — 미니 플레이어 리스트에 노출 · 화면은 숨기고 소리만 재생</div>

      <DragList
        items={state.tracks}
        keyOf={t => t.id}
        onReorder={setTracks}
        render={t => (
          <BgmTrackRow t={t}
            onPatch={p => setTracks(state.tracks.map(x => (x.id === t.id ? { ...x, ...p } : x)))}
            onDelete={() => del.ask(`곡 「${t.title}」을 삭제하시겠습니까?`, () => removeTrack(t.id))} />
        )}
      />
      {del.element}

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <KInput placeholder="곡 제목" value={title} onChange={e => setTitle(e.target.value)} style={{ maxWidth: 150 }} />
        <KInput placeholder="설명 (선택)" value={desc} onChange={e => setDesc(e.target.value)} style={{ maxWidth: 130 }} />
        <KInput placeholder="유튜브 URL 또는 영상 ID" value={url} onChange={e => setUrl(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <button className="btn btn-dark" onClick={add}>＋ ADD</button>
      </div>

      <div className="set-row" style={{ marginTop: 16 }}>
        <div className="l"><b>기본 볼륨</b></div>
        <KStep value={state.settings.volume} min={0} max={100} suffix="%" onChange={v => setSettings({ volume: v })} />
      </div>
      <div className="set-row">
        <div className="l"><b>플레이어 위치</b><small>기본: 오른쪽 아래</small></div>
        <div className="mini-seg">
          <button className={state.settings.position === 'br' ? 'on' : ''} onClick={() => setSettings({ position: 'br' })}>오른쪽 아래</button>
          <button className={state.settings.position === 'bl' ? 'on' : ''} onClick={() => setSettings({ position: 'bl' })}>왼쪽 아래</button>
        </div>
      </div>
      <div className="set-row">
        <div className="l"><b>셔플</b></div>
        <KToggle checked={state.settings.shuffle} onChange={v => setSettings({ shuffle: v })} />
      </div>
      <div className="set-row">
        <div className="l"><b>반복 재생</b><small>목록 끝에서 처음으로</small></div>
        <KToggle checked={state.settings.repeat} onChange={v => setSettings({ repeat: v })} />
      </div>
      <div className="set-row">
        <div className="l"><b>플레이어 표시</b><small>끄면 사이트에서 BGM 플레이어가 사라짐</small></div>
        <KToggle checked={state.settings.enabled} onChange={v => setSettings({ enabled: v })} />
      </div>
      <div className="set-row">
        <div className="l"><b>재생 방식</b><small>자동: 접속 후 처음 클릭/키 입력하는 순간 재생 (브라우저 정책상 완전 무동작 자동재생은 불가) · 수동: 재생 버튼을 눌러야 재생</small></div>
        <div className="mini-seg">
          <button className={state.settings.autoplay ? 'on' : ''}
            onClick={() => setSettings({ autoplay: true })}>접속 시 자동 재생</button>
          <button className={!state.settings.autoplay ? 'on' : ''}
            onClick={() => setSettings({ autoplay: false })}>버튼 눌러야 재생</button>
        </div>
      </div>
    </div>
  );
}

function FontRow({ f }: { f: FontDef }) {
  const { fonts, familyOf, updateFont, removeFont, resetFont, setFontPair } = useFonts();
  const del = useConfirmDelete();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(f.name);
  const [family, setFamily] = useState(f.family);
  const [cssUrl, setCssUrl] = useState(fontCssUrl(f) ?? '');

  if (editing) {
    return (
      <div style={{ display: 'grid', gap: 7, padding: '10px 0', borderBottom: '1px dashed var(--line)' }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          <KInput placeholder="표시 이름" value={name} onChange={e => setName(e.target.value)} style={{ maxWidth: 160 }} />
          {f.fileId ? (
            <>
              <span className="cp-lb">한글 페어</span>
              <KSelect minWidth={150} value={f.pairId ?? ''}
                onChange={v => setFontPair(f.id, v || undefined)}
                options={[{ value: '', label: '페어 없음' },
                  ...fonts.filter(x => x.id !== f.id).map(x => ({ value: x.id, label: x.name }))]} />
            </>
          ) : (
            <>
              <KInput placeholder="font-family 값" value={family} onChange={e => setFamily(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
              <span className="cp-lb">한글 페어</span>
              <KSelect minWidth={140} value={f.pairId ?? ''}
                onChange={v => setFontPair(f.id, v || undefined)}
                options={[{ value: '', label: '페어 없음' },
                  ...fonts.filter(x => x.id !== f.id).map(x => ({ value: x.id, label: x.name }))]} />
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          {!f.fileId && <KInput placeholder="CSS URL" value={cssUrl} onChange={e => setCssUrl(e.target.value)} />}
          <button className="btn btn-dark" style={{ whiteSpace: 'nowrap', marginLeft: f.fileId ? 'auto' : undefined }}
            onClick={() => {
              if (updateFont(f.id, { name, family: f.fileId ? f.family : family, cssUrl: f.fileId ? '' : cssUrl })) { setEditing(false); toast('폰트가 수정되었습니다'); }
              else toast('이름과 font-family 값을 입력해 주세요');
            }}>SAVE</button>
          {f.builtin && (
            <button className="btn btn-ghost" style={{ whiteSpace: 'nowrap' }}
              onClick={() => {
                resetFont(f.id);
                setEditing(false);
                toast(`「${f.name}」를 처음 상태로 되돌렸습니다`);
              }}>기본값으로</button>
          )}
          <button className="btn btn-ghost" style={{ whiteSpace: 'nowrap' }}
            onClick={() => { setEditing(false); setName(f.name); setFamily(f.family); setCssUrl(fontCssUrl(f) ?? ''); }}>CANCEL</button>
        </div>
      </div>
    );
  }

  return (
    <div className="set-row">
      <div className="l" style={{ minWidth: 0 }}>
        <b style={{ fontFamily: familyOf(f.id), fontSize: 15 }}>{f.name} — 가나다 ABC 123</b>
        <small style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {f.fileId
            ? `업로드 파일 — ${f.fileName ?? '폰트 파일'}${f.pairId ? ` · 한글 페어: ${fonts.find(x => x.id === f.pairId)?.name ?? ''}` : ''}`
            : `${fontCssUrl(f) ?? (f.locked ? '사이트 기본 폰트 스택 — 별도 URL 없음' : '사이트 CSS에서 로드')}${f.pairId ? ` · 한글 페어: ${fonts.find(x => x.id === f.pairId)?.name ?? ''}` : ''}`}
        </small>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
          onClick={() => setEditing(true)}>EDIT</button>
        {!f.locked && (
          <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
            onClick={() => del.ask(`폰트 「${f.name}」를 삭제하시겠습니까?`, () => removeFont(f.id),
                f.builtin
                  ? '기본 폰트는 목록에서만 빠집니다 — 아래 [복원] 버튼으로 되살릴 수 있고, 이 폰트를 쓰던 항목 표시는 그대로입니다.'
                  : '직접 등록한 폰트는 복구할 수 없습니다. 이 폰트를 쓰도록 지정해 둔 자리(역할 폰트·한글 페어)는 기본값으로 되돌아갑니다.')}>DELETE</button>
        )}
      </div>
      {del.element}
    </div>
  );
}

function FontPane() {
  const { fonts, hiddenCount, addFont, addFontFile, restoreBuiltins } = useFonts();
  const toast = useToast();
  const [name, setName] = useState('');
  const [family, setFamily] = useState('');
  const [cssUrl, setCssUrl] = useState('');
  const [webPairOn, setWebPairOn] = useState(false);
  const [webPair, setWebPair] = useState('');
  const [upPair, setUpPair] = useState('');

  const uploadFontFile = async (f: File | undefined) => {
    if (!f) return;
    const name = f.name.replace(/\.(woff2?|ttf|otf)$/i, '');
    if (await addFontFile(name, f, upPair || undefined)) { setUpPair(''); toast(`「${name}」 폰트가 등록되었습니다`); }
  };

  return (
    <div className="set-sec">
      <h3>폰트 라이브러리</h3>
      <div className="d">캐릭터 프로필·자관 이름·시나리오 타이틀 등에서 이 목록 중 선택해 사용 — 원하는 폰트만 남기고 삭제 가능</div>

      {fonts.map(f => <FontRow key={f.id} f={f} />)}
      {hiddenCount > 0 && (
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }} onClick={restoreBuiltins}>
            삭제한 기본 폰트 {hiddenCount}개 복원
          </button>
        </div>
      )}
      <p className="hint">삭제해도 이미 그 폰트를 쓰고 있는 캐릭터·자관 표시는 깨지지 않습니다 — 선택 목록에서만 빠집니다</p>

      <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
        <label className="k-label" style={{ margin: 0 }}>웹폰트 추가 — 눈누/구글폰트의 CSS 링크(URL)와 font-family 값</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <KInput placeholder="표시 이름" value={name} onChange={e => setName(e.target.value)} style={{ maxWidth: 130 }} />
          <KInput placeholder="font-family 값" value={family}
            onChange={e => setFamily(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <KInput placeholder="CSS URL (https://fonts.googleapis.com/... 또는 눈누 링크)" value={cssUrl}
            onChange={e => setCssUrl(e.target.value)} />
          <button className="btn btn-dark" style={{ whiteSpace: 'nowrap' }}
            onClick={() => {
              if (addFont(name, family, cssUrl, webPairOn ? webPair || undefined : undefined)) {
                setName(''); setFamily(''); setCssUrl(''); setWebPairOn(false); setWebPair('');
                toast('폰트가 추가되었습니다');
              } else toast('이름과 font-family 값을 입력해 주세요');
            }}>＋ ADD</button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <KCheck label="한글 페어 지정" checked={webPairOn} onChange={setWebPairOn} />
          {webPairOn && (
            <KSelect minWidth={160} value={webPair} onChange={setWebPair}
              options={[{ value: '', label: '페어 없음' }, ...fonts.map(f => ({ value: f.id, label: f.name }))]} />
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
        <label className="k-label" style={{ margin: 0 }}>폰트 파일 업로드 — woff2·woff·ttf·otf</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="cp-lb">한글 페어</span>
          <KSelect minWidth={160} value={upPair} onChange={setUpPair}
            options={[{ value: '', label: '페어 없음' }, ...fonts.map(f => ({ value: f.id, label: f.name }))]} />
          <label className="btn btn-dark" style={{ whiteSpace: 'nowrap', cursor: 'var(--cur-pointer,pointer)' }}
            {...fileDrop(fl => uploadFontFile(fl[0]))}>
            ↑ 파일 선택
            <input type="file" accept=".woff2,.woff,.ttf,.otf" style={{ display: 'none' }}
              onChange={e => { uploadFontFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
        <p className="hint">표시 이름은 파일명 그대로 등록 — 목록의 [EDIT]에서 수정. 한글 미지원 폰트라면 한글 페어를 지정 — 한글 글자는 페어 폰트로 표시됩니다.</p>
      </div>
    </div>
  );
}

function SettingsInner() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTabState] = useState<(typeof CATEGORIES)[number]>('디자인');
  const urlTab = params.get('tab');

  useEffect(() => {
    if (urlTab && (CATEGORIES as readonly string[]).includes(urlTab)) setTabState(urlTab as (typeof CATEGORIES)[number]);
    else if (!urlTab) setTabState('디자인');
  }, [urlTab]);

  const setTab = (t: (typeof CATEGORIES)[number]) => {
    setTabState(t);
    router.push(`/settings?tab=${encodeURIComponent(t)}`);
  };

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:620px)');
    const f = () => setIsMobile(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);

  const { dirty: themeDirty, discard: themeDiscard, save: themeSave } = useTheme();
  const { rolesDirty, saveRoles, discardRoles } = useFonts();
  const siteDraft = useSiteDraft();
  const dirty = themeDirty || rolesDirty || siteDraft.dirty;
  const save = () => { themeSave(); saveRoles(); siteDraft.save(); };
  const discard = () => { themeDiscard(); discardRoles(); siteDraft.discard(); };
  const themeRef = useRef({ dirty, discard });
  themeRef.current = { dirty, discard };
  useEffect(() => () => { if (themeRef.current.dirty) themeRef.current.discard(); }, []);

  const [leaveAsk, setLeaveAsk] = useState(false);
  const pendingClick = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onCapture = (e: MouseEvent) => {
      if (!themeRef.current.dirty) return;
      const t = e.target as HTMLElement | null;
      const hit = t?.closest?.('.topbar a, .topbar button, .topbar .brand') as HTMLElement | null;
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      pendingClick.current = hit;
      setLeaveAsk(true);
    };
    document.addEventListener('click', onCapture, true);
    return () => document.removeEventListener('click', onCapture, true);
  }, []);

  const leaveWith = (action: 'save' | 'discard') => {
    if (action === 'save') save(); else discard();
    setLeaveAsk(false);
    const el = pendingClick.current;
    pendingClick.current = null;
    setTimeout(() => el?.click(), 30);
  };

  if (!isAdmin) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>SETTINGS</PageTitle><p>관리자 전용 페이지</p></div>
        <div className="panel" style={{ textAlign: 'center', padding: 56 }}>
          <p style={{ fontSize: 13, color: 'var(--faint)' }}>관리자로 로그인하면 환경설정을 사용할 수 있습니다.</p>
        </div>
      </section>
    );
  }
  if (isMobile) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>SETTINGS</PageTitle><p>PC 전용 페이지</p></div>
        <div className="panel" style={{ textAlign: 'center', padding: 56 }}>
          <p style={{ fontSize: 13, color: 'var(--faint)' }}>환경설정은 PC 화면에서 이용할 수 있습니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>SETTINGS</PageTitle>
        <EditableDesc k="settings-desc" def="노코드 커스터마이징 — 모든 컨트롤은 자체 UI 킷 (기본 브라우저 UI 미사용)" />
      </div>

      <ConfirmModal open={leaveAsk} title="테마가 저장되지 않았습니다"
        body="이대로 이동하면 미리보기 중인 변경사항이 사라지고 저장된 테마로 돌아갑니다."
        onClose={() => { pendingClick.current = null; setLeaveAsk(false); }}
        buttons={[
          { label: '저장 후 이동', kind: 'dark', onClick: () => leaveWith('save') },
          { label: '저장하지 않고 이동', kind: 'ghost', onClick: () => leaveWith('discard') },
          { label: 'CANCEL', kind: 'ghost', onClick: () => { pendingClick.current = null; setLeaveAsk(false); } },
        ]} />
      <div className="settings-layout">
        <div className="panel set-nav">
          {CATEGORIES.map(c => (
            <button key={c} className={tab === c ? 'on' : ''} onClick={() => setTab(c)}>{c}</button>
          ))}
        </div>
        <div className="panel" style={{ padding: 26 }}>
          {tab === '디자인' ? (
            <DesignPane />
          ) : tab === '메인 페이지' ? (
            <MainPagePane />
          ) : tab === '위젯' ? (
            <WidgetsPane />
          ) : tab === '메뉴 관리' ? (
            <MenuPane />
          ) : tab === '게시판 관리' ? (
            <BoardPane />
          ) : tab === '자관 질문' ? (
            <RelQPane />
          ) : tab === '커미션' ? (
            <CommPane />
          ) : tab === 'TRPG' ? (
            <TrpgPane />
          ) : tab === '감상타래' ? (
            <ThreadPane />
          ) : tab === '메모장' ? (
            <MemoPane />
          ) : tab === '무드 리스트' ? (
            <MoodPane />
          ) : tab === 'BGM' ? (
            <BgmPane />
          ) : tab === '폰트' ? (
            <FontPane />
          ) : tab === '마우스 커서' ? (
            <CursorPane />
          ) : tab === '회원/보안' ? (
            <MemberPane />
          ) : tab === '데이터 백업' ? (
            <DataPane />
          ) : (
            <div className="set-sec">
              <h3>{tab}</h3>
              <div className="d">설정 항목이 없습니다</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  return <Suspense fallback={<section className="page" />}><SettingsInner /></Suspense>;
}
