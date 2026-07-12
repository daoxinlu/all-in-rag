/**
 * 抽卡模拟器 — 主入口
 * 职责：初始化 / 事件绑定 / 抽卡开箱 / PWA
 */
import { state, saveState, gachaEngine, chestEngine, setChestEngine, getCurrentChestItems, getCurrentChestStats, freshChestStats, RARITY_META, Rarity, genId, switchChestType } from './state.js';
import { ChestEngine, calcPityFromItems } from './gacha.js';
import { recordPull, calcLifetimeLucky, calcRecentLucky, getFortuneLevel, freshNoneuState, checkAchievements, getAchievementInfo } from './noneu.js';
import {
  renderAll, renderPity, renderGachaStats, renderChestStats, renderChestPity, renderChestSettings,
  renderItemPreview, renderItemList, renderCharList, renderCharPreview,
  renderChestTypeTabs, renderFeaturedChar, renderNoneuBar,
} from './render.js';
import {
  showResults, showListResults, closeResultModal,
  showHistory, showStats, showGuide,
  openItemModal, saveItem, setSelectedItemRarity,
  openCharModal, saveChar, deleteChar,
  addChestType,
} from './modals.js';

// ═══ DOM 引用 ═══
const $ = id => document.getElementById(id);
const els = {
  panels: document.querySelectorAll('.panel'), tabs: document.querySelectorAll('.tab'),
  gachaPanel: $('gachaPanel'), chestPanel: $('chestPanel'), settingsPanel: $('settingsPanel'),
  featuredChar: $('featuredChar'),
  pityBar5: $('pityBar5'), pityText5: $('pityText5'), pityBar4: $('pityBar4'), pityText4: $('pityText4'), guaranteeText: $('guaranteeText'),
  singlePullBtn: $('singlePullBtn'), tenPullBtn: $('tenPullBtn'), pull99Btn: $('pull99Btn'), pull999Btn: $('pull999Btn'),
  resetGachaAllBtn: $('resetGachaAllBtn'),
  statTotal: $('statTotal'), stat5: $('stat5'), stat4: $('stat4'),
  chestVisual: $('chestVisual'), chestHint: $('chestHint'),
  itemPreview: $('itemPreview'), itemList: $('itemList'),
  openChestBtn: $('openChestBtn'), openTenChestBtn: $('openTenChestBtn'), open99ChestBtn: $('open99ChestBtn'), open999ChestBtn: $('open999ChestBtn'),
  resetChestAllBtn: $('resetChestAllBtn'),
  chestStatTotal: $('chestStatTotal'), chestStat5: $('chestStat5'), chestStat4: $('chestStat4'), chestStat3: $('chestStat3'),
  chestItemStatsBtn: $('chestItemStatsBtn'),
  rate5Slider: $('rate5Slider'), rate5Input: $('rate5Input'), rate4Slider: $('rate4Slider'), rate4Input: $('rate4Input'),
  pity5Slider: $('pity5Slider'), pity5Input: $('pity5Input'), softPitySlider: $('softPitySlider'), softPityInput: $('softPityInput'),
  fiftyFiftyToggle: $('fiftyFiftyToggle'), pityEnabledToggle: $('pityEnabledToggle'),
  resetPityBtn: $('resetPityBtn'), resetStatsBtn: $('resetStatsBtn'), resetAllBtn: $('resetAllBtn'),
  charList: $('charList'), charPreview: $('charPreview'), addCharBtn: $('addCharBtn'),
  gotoSettingsFromGacha: $('gotoSettingsFromGacha'), gotoSettingsBtn: $('gotoSettingsBtn'),
  chestPityEl: $('chestPityEl'), gachaPityInChest: $('gachaPityInChest'),
  chestTypeTabs: $('chestTypeTabs'), settingsChestTabs: $('settingsChestTabs'),
  addChestTypeBtn: $('addChestTypeBtn'), delChestTypeBtn: $('delChestTypeBtn'),
  chestPityChestName: $('chestPityChestName'),
  chestPity5Toggle: $('chestPity5Toggle'), chestPity5Slider: $('chestPity5Slider'), chestPity5Input: $('chestPity5Input'),

  resultModal: $('resultModal'), resultCards: $('resultCards'), resultCloseBtn: $('resultCloseBtn'),
  listResultModal: $('listResultModal'), listResultTitle: $('listResultTitle'), listSummary: $('listSummary'), listItems: $('listItems'), listResultCloseBtn: $('listResultCloseBtn'),
  historyModal: $('historyModal'), historyList: $('historyList'), historyBtn: $('historyBtn'), statsBtn: $('statsBtn'), guideBtn: $('guideBtn'), noneuBtn: $('noneuBtn'),
  gachaNoneu: $('gachaNoneu'), chestNoneu: $('chestNoneu'),
  noneuEnabledToggle: $('noneuEnabledToggle'),
  statsModal: $('statsModal'), statsDetail: $('statsDetail'),
  itemModal: $('itemModal'), itemModalTitle: $('itemModalTitle'), itemName: $('itemName'), itemWeight: $('itemWeight'), raritySelect: $('raritySelect'), saveItemBtn: $('saveItemBtn'), addItemBtn: $('addItemBtn'),
  installBtn: $('installBtn'),
};

// ═══ 事件绑定 ═══
function bindEvents() {
  els.tabs.forEach(t => t.addEventListener('click', () => switchMode(t.dataset.mode)));
  els.chestVisual.addEventListener('click', () => doOpenChest(1));
  els.chestItemStatsBtn.addEventListener('click', showChestItemStats);
  els.gotoSettingsBtn.addEventListener('click', () => switchMode('settings'));
  els.gotoSettingsFromGacha.addEventListener('click', () => switchMode('settings'));
  els.addChestTypeBtn.addEventListener('click', addChestType);

  bindSlider(els.rate5Slider, els.rate5Input, 'rate5', 100);
  bindSlider(els.rate4Slider, els.rate4Input, 'rate4', 100);
  bindSlider(els.pity5Slider, els.pity5Input, 'pity5Hard');
  bindSlider(els.softPitySlider, els.softPityInput, 'pity5Soft');

  // 宝箱保底滑块
  bindChestSlider(els.chestPity5Slider, els.chestPity5Input, 'pity5Hard');

  // 宝箱保底开关（per-chest）
  els.chestPity5Toggle.addEventListener('change', () => {
    getCurrentPity().pity5Enabled = els.chestPity5Toggle.checked;
    state.chestTypes[state.currentChestId].pityCustomized = true;
    chestEngine.config = { ...getCurrentPity() };
    if (!getCurrentPity().pity5Enabled) { chestEngine.resetPity(); state.chestPity[state.currentChestId] = chestEngine.exportPity(); }
    saveState(); renderChestPity(els);
  });

  els.fiftyFiftyToggle.addEventListener('change', () => { state.config.fiftyFifty = els.fiftyFiftyToggle.checked; gachaEngine.config = { ...state.config }; saveState(); });
  els.pityEnabledToggle.addEventListener('change', () => {
    state.config.pityEnabled = els.pityEnabledToggle.checked;
    gachaEngine.config = { ...state.config };
    if (!state.config.pityEnabled) { gachaEngine.pity5 = 0; gachaEngine.pity4 = 0; state.engineState = gachaEngine.exportState(); }
    renderPity(els); saveState();
  });

  els.singlePullBtn.addEventListener('click', () => doPull(false));
  els.tenPullBtn.addEventListener('click', () => doPull(true));
  els.pull99Btn.addEventListener('click', () => doPullMany(99));
  els.pull999Btn.addEventListener('click', () => doPullMany(999));
  els.openChestBtn.addEventListener('click', () => doOpenChest(1));
  els.openTenChestBtn.addEventListener('click', () => doOpenChest(10));
  els.open99ChestBtn.addEventListener('click', () => doOpenChest(99));
  els.open999ChestBtn.addEventListener('click', () => doOpenChest(999));

  // 祈愿面板快捷重置（保底 + 统计一起）
  els.resetGachaAllBtn.addEventListener('click', () => showConfirm('将重置祈愿保底计数、统计数据和欧气值。', '重置祈愿数据', () => {
    gachaEngine.resetPity();
    state.engineState = gachaEngine.exportState();
    state.stats.gacha = { total: 0, r5: 0, r4: 0, r3: 0 };
    state.noneu = freshNoneuState();
    saveState();
    renderPity(els);
    renderGachaStats(els);
    renderNoneuBar(els);
  }));

  // 宝箱面板快捷重置（保底 + 统计一起）
  els.resetChestAllBtn.addEventListener('click', () => showConfirm('将重置当前宝箱的保底计数、统计数据和欧气值。', '重置宝箱数据', () => {
    chestEngine.resetPity();
    state.chestPity[state.currentChestId] = chestEngine.exportPity();
    state.stats.chest[state.currentChestId] = freshChestStats();
    state.noneu = freshNoneuState();
    saveState();
    renderChestPity(els);
    renderChestStats(els);
    renderNoneuBar(els);
  }));

  els.resetPityBtn.addEventListener('click', () => showConfirm('将重置所有保底计数。', '重置保底', resetPity));
  els.resetStatsBtn.addEventListener('click', () => showConfirm('将清空所有统计数据、欧气值和成就。此操作不可恢复。', '清空统计', resetStats));
  els.resetAllBtn.addEventListener('click', () => showConfirm('将删除所有本地数据并刷新页面。', '重置全部', resetAll));

  els.resultCloseBtn.addEventListener('click', () => closeResultModal(els));
  els.listResultCloseBtn.addEventListener('click', () => els.listResultModal.classList.remove('show'));

  // 自定义确认弹窗事件
  $('confirmCancelBtn').addEventListener('click', () => { confirmCallback = null; $('confirmModal').classList.remove('show'); });
  $('confirmOkBtn').addEventListener('click', () => { if (confirmCallback) { confirmCallback(); confirmCallback = null; } $('confirmModal').classList.remove('show'); });
  $('confirmModal').addEventListener('keydown', e => { if (e.key === 'Enter' && confirmCallback) { confirmCallback(); confirmCallback = null; $('confirmModal').classList.remove('show'); } });

  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.remove('show')));
  document.querySelectorAll('.modal-overlay').forEach(o => { if (o.id === 'resultModal') return; o.addEventListener('click', e => { if (e.target === o) o.classList.remove('show'); }); });

  // 点击成就弹窗手动关闭
  $('achToast').addEventListener('click', () => {
    if (achToastTimer) { clearTimeout(achToastTimer); achToastTimer = null; }
    $('achToast').classList.remove('show');
  });

  els.historyBtn.addEventListener('click', () => showHistory(els));
  els.statsBtn.addEventListener('click', () => showStats(els));
  els.guideBtn.addEventListener('click', () => showGuide(els));
  els.noneuBtn.addEventListener('click', () => showNoneuModal());
  els.noneuEnabledToggle.addEventListener('change', () => {
    state.noneu.settings.enabled = els.noneuEnabledToggle.checked;
    saveState();
    renderNoneuBar(els);
  });

  els.addItemBtn.addEventListener('click', () => openItemModal(els));
  els.saveItemBtn.addEventListener('click', () => saveItem(els));
  els.raritySelect.querySelectorAll('.rarity-opt').forEach(btn => btn.addEventListener('click', () => {
    els.raritySelect.querySelectorAll('.rarity-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setSelectedItemRarity(parseInt(btn.dataset.rarity));
  }));
  els.itemList.addEventListener('click', e => {
    const b = e.target.closest('[data-edit]'); if (b) openItemModal(els, b.dataset.edit);
    const d = e.target.closest('[data-del]'); if (d) {
      if (state.chestTypes[state.currentChestId]?.locked) {
        alert('🔒 标准宝箱为预设宝箱，不可编辑。请切换到其他宝箱后编辑。');
        return;
      }
      chestEngine.removeItem(d.dataset.del);
      state.chestTypes[state.currentChestId].items = chestEngine.items;
      saveState();
      renderItemList(els); renderItemPreview(els);
    }
  });

  // 角色池管理暂未开放
  // els.addCharBtn.addEventListener('click', () => openCharModal(els));
  document.getElementById('saveCharBtn').addEventListener('click', () => saveChar(els));
  document.getElementById('charModal').querySelectorAll('.rarity-opt').forEach(btn => btn.addEventListener('click', () => {
    document.getElementById('charModal').querySelectorAll('.rarity-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }));
  els.charList.addEventListener('click', e => {
    const b = e.target.closest('[data-edit-char]'); if (b) { const [r, i] = b.dataset.editChar.split(':').map(Number); openCharModal(els, r, i); }
    const d = e.target.closest('[data-del-char]'); if (d) { const [r, i] = d.dataset.delChar.split(':').map(Number); deleteChar(els, r, i); }
  });

  document.getElementById('saveChestTypeBtn').addEventListener('click', saveChestType);
  document.getElementById('chestTypeName').addEventListener('keydown', e => { if (e.key === 'Enter') saveChestType(); });
  els.delChestTypeBtn.addEventListener('click', deleteChestType);

  els.installBtn.addEventListener('click', triggerInstall);
}

// ═══ 滑块 ═══
function bindSlider(slider, numInput, configKey, divider) {
  const d = divider || 1;

  function syncUI(raw) { slider.value = raw; numInput.value = raw; }
  function apply(raw) { state.config[configKey] = raw / d; gachaEngine.config = { ...state.config }; saveState(); }

  syncUI(state.config[configKey] * d);

  slider.addEventListener('input', () => { const raw = parseFloat(slider.value); numInput.value = raw; apply(raw); });
  numInput.addEventListener('input', () => { const raw = parseFloat(numInput.value); if (!isNaN(raw)) { slider.value = raw; apply(raw); } });
  numInput.addEventListener('blur', () => { const raw = parseFloat(numInput.value); if (isNaN(raw)) syncUI(state.config[configKey] * d); });
}

// ═══ 自定义确认弹窗（替换原生 confirm）═══
let confirmCallback = null;
function showConfirm(msg, title, onOk) {
  confirmCallback = onOk;
  $('confirmTitle').textContent = title || '确认操作';
  $('confirmMsg').textContent = msg;
  $('confirmOkBtn').textContent = title || '确认删除';
  $('confirmModal').classList.add('show');
  $('confirmCancelBtn').focus();
}

// 获取当前宝箱的保底配置（per-chest）
function getCurrentPity() {
  const ct = state.chestTypes[state.currentChestId];
  if (!ct.pity) ct.pity = { pity5Enabled: true, pity5Hard: 100 };
  return ct.pity;
}

/** 绑定宝箱保底滑块 + 数字输入 */
function bindChestSlider(slider, numInput, configKey) {
  function syncUI(raw) { slider.value = raw; numInput.value = raw; }
  function apply(raw) { getCurrentPity()[configKey] = parseInt(raw); state.chestTypes[state.currentChestId].pityCustomized = true; chestEngine.config = { ...getCurrentPity() }; saveState(); renderChestPity(els); }

  syncUI(getCurrentPity()[configKey]);

  slider.addEventListener('input', () => { const raw = parseInt(slider.value); numInput.value = raw; apply(raw); });
  numInput.addEventListener('input', () => { const raw = parseInt(numInput.value); if (!isNaN(raw)) { slider.value = raw; apply(raw); } });
  numInput.addEventListener('blur', () => { const raw = parseInt(numInput.value); if (isNaN(raw)) syncUI(getCurrentPity()[configKey]); });
}

// ═══ 模式切换 ═══
function switchMode(mode) {
  els.tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  els.panels.forEach(p => p.classList.remove('active'));
  const panel = els[mode + 'Panel']; if (panel) panel.classList.add('active');
  // 切换到宝箱面板时刷新角色祈愿进度
  if (mode === 'chest') renderChestPity(els);
  if (mode === 'settings' && els.noneuEnabledToggle) els.noneuEnabledToggle.checked = state.noneu?.settings?.enabled;
  renderNoneuBar(els);
  if (mode === 'gacha') renderPity(els);
}

// ═══ 抽卡 ═══
function doPull(isTen) {
  els.singlePullBtn.disabled = els.tenPullBtn.disabled = true;
  const results = isTen ? gachaEngine.pullTen() : [gachaEngine.pull()];
  state.engineState = gachaEngine.exportState();
  results.forEach(r => {
    state.stats.gacha.total++;
    if (r.rarity === Rarity.FIVE) { state.stats.gacha.r5++; recordPull(state, 'gacha', { rarity:5, count:r._prePity5, isUp:r.isFeatured, timestamp:Date.now() }); }
    else if (r.rarity === Rarity.FOUR) { state.stats.gacha.r4++; recordPull(state, 'gacha', { rarity:4, count:r._prePity5, isUp:false, timestamp:Date.now() }); }
    else state.stats.gacha.r3++;
    state.history.unshift({ id: genId(), mode: 'gacha', name: r.character.name, icon: r.character.icon, rarity: r.rarity, time: Date.now() });
  });
  if (state.history.length > 200) state.history = state.history.slice(0, 200);
  saveState(); renderGachaStats(els); renderPity(els); renderNoneuBar(els);
  const newAch = checkAchievements(state.noneu, 'gacha');
  if (newAch.length > 0) { saveState(); newAch.forEach(showAchToast); }
  showResults(els, results, 'gacha');
  setTimeout(() => { els.singlePullBtn.disabled = els.tenPullBtn.disabled = false; }, 600);
}

function doPullMany(count) {
  els.singlePullBtn.disabled = els.tenPullBtn.disabled = els.pull99Btn.disabled = els.pull999Btn.disabled = true;
  const results = gachaEngine.pullMany(count);
  state.engineState = gachaEngine.exportState();
  results.forEach(r => {
    state.stats.gacha.total++;
    if (r.rarity === Rarity.FIVE) { state.stats.gacha.r5++; recordPull(state, 'gacha', { rarity:5, count:r._prePity5, isUp:r.isFeatured, timestamp:Date.now() }); }
    else if (r.rarity === Rarity.FOUR) { state.stats.gacha.r4++; recordPull(state, 'gacha', { rarity:4, count:r._prePity5, isUp:false, timestamp:Date.now() }); }
    else state.stats.gacha.r3++;
    state.history.unshift({ id: genId(), mode: 'gacha', name: r.character.name, icon: r.character.icon, rarity: r.rarity, time: Date.now() });
  });
  if (state.history.length > 200) state.history = state.history.slice(0, 200);
  saveState(); renderGachaStats(els); renderPity(els); renderNoneuBar(els);
  const newAch2 = checkAchievements(state.noneu, 'gacha');
  if (newAch2.length > 0) { saveState(); newAch2.forEach(showAchToast); }
  showListResults(els, results, 'gacha');
  setTimeout(() => { els.singlePullBtn.disabled = els.tenPullBtn.disabled = els.pull99Btn.disabled = els.pull999Btn.disabled = false; }, 300);
}

// ═══ 宝箱 ═══
function doOpenChest(count) {
  setChestBtns(true);
  const results = chestEngine.openMany(count);
  const cs = getCurrentChestStats();
  results.forEach(r => {
    cs.total++;
    if (r.rarity === Rarity.FIVE) { cs.r5++; recordPull(state, 'chest', { chestId:state.currentChestId, rarity:5, name:r.item.name, count:r._pityBefore, timestamp:Date.now() }); }
    else if (r.rarity === Rarity.FOUR) { cs.r4++; recordPull(state, 'chest', { chestId:state.currentChestId, rarity:4, name:r.item.name, count:r._pityBefore, timestamp:Date.now() }); }
    else cs.r3++;
    // 物品级追踪（全稀有度）
    if (r.item?.id) {
      if (!cs.items) cs.items = {};
      cs.items[r.item.id] = (cs.items[r.item.id] || 0) + 1;
    }
    // 提前出5星统计
    if (r.rarity === Rarity.FIVE) {
      if (!cs.early5) cs.early5 = { total: 0, sum: 0, min: null, natural: 0, pity: 0 };
      const pityAtPull = r._pityBefore || 0;
      const pityHard = state.chestTypes[state.currentChestId]?.pity?.pity5Hard || 100;
      const isPity = pityAtPull >= pityHard - 1;
      cs.early5.total++;
      cs.early5.sum += pityAtPull;
      if (cs.early5.min === null || pityAtPull < cs.early5.min) cs.early5.min = pityAtPull;
      if (isPity) cs.early5.pity++;
      else cs.early5.natural++;
    }
    state.history.unshift({ id: genId(), mode: 'chest', name: r.item.name, icon: RARITY_META[r.rarity]?.icon || '⭐', rarity: r.rarity, time: Date.now() });
  });
  if (state.history.length > 200) state.history = state.history.slice(0, 200);
  state.chestPity[state.currentChestId] = chestEngine.exportPity();
  saveState(); renderChestStats(els); renderChestPity(els); renderNoneuBar(els);
  const newAch3 = checkAchievements(state.noneu, 'chest', state.currentChestId);
  if (newAch3.length > 0) { saveState(); newAch3.forEach(showAchToast); }
  els.chestVisual.classList.add('opening'); els.chestHint.textContent = '开启中...';
  setTimeout(() => {
    els.chestVisual.classList.remove('opening'); els.chestHint.textContent = '点击宝箱开启';
    (count <= 10 ? showResults : showListResults)(els, results, 'chest');
    setChestBtns(false);
  }, 700);
}
function setChestBtns(d) { els.openChestBtn.disabled = els.openTenChestBtn.disabled = els.open99ChestBtn.disabled = els.open999ChestBtn.disabled = d; }

// ═══ 来测测你的欧气吧弹窗 ═══
function showNoneuModal() {
  const ne = state.noneu;
  const chr5 = ne?.character?.fiveStarHistory || [];
  const chrLifetime = calcLifetimeLucky(chr5);
  const chrRecent = calcRecentLucky(chr5);
  const chrLevel = getFortuneLevel(chrLifetime);

  const chestId = state.currentChestId;
  const chest5 = ne?.chests?.[chestId]?.fiveStarHistory || [];
  const chestLifetime = calcLifetimeLucky(chest5);
  const chestLevel = getFortuneLevel(chestLifetime);

  $('noneuBody').innerHTML = `
    <div class="stats-section-title">🎴 角色祈愿</div>
    <div class="stats-row"><span>欧气值</span><span class="stats-value">${chrLifetime}</span></div>
    <div class="stats-row"><span>近期幸运值</span><span class="stats-value">${chrRecent} (最近10次)</span></div>
    <div class="stats-row"><span>非欧等级</span><span class="stats-value" style="color:${chrLevel.color}">${chrLevel.icon} ${chrLevel.name}</span></div>
    <div class="stats-row"><span>五星总数</span><span class="stats-value">${chr5.length}</span></div>
    <div style="height:12px"></div>
    <div class="stats-section-title">🎁 当前宝箱 · ${state.chestTypes[state.currentChestId]?.name || '—'}</div>
    <div class="stats-row"><span>欧气值</span><span class="stats-value">${chestLifetime}</span></div>
    <div class="stats-row"><span>非欧等级</span><span class="stats-value" style="color:${chestLevel.color}">${chestLevel.icon} ${chestLevel.name}</span></div>
    <div class="stats-row"><span>五星总数</span><span class="stats-value">${chest5.length}</span></div>
    <div style="height:12px"></div>
    <div class="stats-section-title">🏅 祈愿成就</div>
    ${(ne.character?.achievements || []).length > 0
      ? (ne.character.achievements || []).map(id => {
          const a = getAchievementInfo(id);
          return `<div class="stats-row" style="flex-wrap:wrap;gap:4px"><span>${a.icon} ${a.name}</span><span style="font-size:0.65rem;color:var(--text-muted)">${a.desc}</span></div>`;
        }).join('')
      : '<div class="stats-row"><span style="color:var(--text-muted);font-size:0.75rem">暂无 · 多抽卡解锁</span></div>'
    }
    <div style="height:8px"></div>
    <div class="stats-section-title">🏅 宝箱成就</div>
    ${(ne.chests?.[chestId]?.achievements || []).length > 0
      ? (ne.chests[chestId].achievements || []).map(id => {
          const a = getAchievementInfo(id);
          return `<div class="stats-row" style="flex-wrap:wrap;gap:4px"><span>${a.icon} ${a.name}</span><span style="font-size:0.65rem;color:var(--text-muted)">${a.desc}</span></div>`;
        }).join('')
      : '<div class="stats-row"><span style="color:var(--text-muted);font-size:0.75rem">暂无 · 多开宝箱解锁</span></div>'
    }
  `;
  $('noneuModal').classList.add('show');
}

// ═══ 物品统计弹窗 ═══
function showChestItemStats() {
  const cs = getCurrentChestStats();
  const items = cs.items || {};
  const entries = Object.entries(items).filter(([,c]) => c > 0);

  // 按物品名称查 rarity
  const allItems = chestEngine.items || [];
  const nameMap = {};
  for (const it of allItems) nameMap[it.id] = { name: it.name, rarity: it.rarity };

  // 按稀有度排序
  const sorted = entries.sort((a, b) => {
    const ra = nameMap[a[0]]?.rarity || 3;
    const rb = nameMap[b[0]]?.rarity || 3;
    return rb - ra || (a[0] < b[0] ? -1 : 1);
  });

  // 提前出5星分析
  const e5 = cs.early5 || {};
  const earlyLines = [];
  if (e5.total > 0) {
    earlyLines.push(`<span style="color:var(--gold)">🎯 五星共 ${e5.total} 次</span>`);
    earlyLines.push(`提前出货 ${e5.natural || 0} 次 &nbsp;│&nbsp; 保底出货 ${e5.pity || 0} 次`);
    const avgAt = Math.round(e5.sum / e5.total);
    const minP = e5.min === null || e5.min === undefined ? '—' : e5.min;
    earlyLines.push(`平均第 ${avgAt + 1} 抽 &nbsp;│&nbsp; 最早${e5.min === null ? '—' : '第'+(parseInt(e5.min)+1)+'抽'}`);
  }

  let html = `<div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-muted)">
    总开箱：${cs.total || 0} 次 &nbsp;|&nbsp; 五星：${cs.r5 || 0} &nbsp;|&nbsp; 四星：${cs.r4 || 0}</div>`;
  if (earlyLines.length > 0) {
    html += `<div style="background:var(--bg-card);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:0.78rem;color:var(--text-secondary);line-height:1.5">
      ${earlyLines.join(' &nbsp;│&nbsp; ')}
    </div>`;
  }

  if (entries.length === 0) {
    html += '<div class="empty-state">暂无物品获得记录</div>';
  } else {
    html += '<div style="max-height:360px;overflow-y:auto">';
    for (const [id, count] of sorted) {
      const info = nameMap[id] || {};
      const meta = RARITY_META[info.rarity] || {};
      const pct = cs.total > 0 ? ((count / cs.total) * 100).toFixed(3) : '0';
      html += `<div class="stats-row">
        <span class="stats-label"><span style="color:${meta.color}">${meta.icon || ''}</span> ${info.name || id}</span>
        <span class="stats-value">${count} 次 <span style="font-size:0.7rem;color:var(--text-muted)">${pct}%</span></span>
      </div>`;
    }
    html += '</div>';
  }

  document.getElementById('chestItemStatsTitle').textContent = `📊 ${state.chestTypes[state.currentChestId]?.name || ''} - 获得统计`;
  document.getElementById('chestItemStatsBody').innerHTML = html;
  document.getElementById('chestItemStatsModal').classList.add('show');
}

// ═══ 宝箱类型 CRUD ═══
function saveChestType() {
  const name = document.getElementById('chestTypeName').value.trim();
  if (!name) return;
  const id = 'chest_' + Date.now();
  state.chestTypes[id] = { name, pity: calcPityFromItems(chestEngine.items), items: JSON.parse(JSON.stringify(chestEngine.items)) };
  state.stats.chest[id] = freshChestStats();
  state.chestPity[id] = { pity5: 0 };
  state.currentChestId = id;
  setChestEngine(new ChestEngine(getCurrentChestItems(), getCurrentPity()));
  saveState(); renderChestTypeTabs(els); renderItemPreview(els); renderChestStats(els); renderChestPity(els); renderItemList(els);
  document.getElementById('chestTypeModal').classList.remove('show');
}

function deleteChestType() {
  if (state.currentChestId === 'default') { alert('🔒 标准宝箱为预设宝箱，不可删除'); return; }
  const ids = Object.keys(state.chestTypes);
  if (ids.length <= 1) { alert('至少保留一个宝箱类型'); return; }

  // 自定义确认弹窗（替换原生 confirm）
  showConfirm(`确定删除「${state.chestTypes[state.currentChestId]?.name}」？统计数据和物品配置将永久丢失。`, '确认删除', () => {
    delete state.chestTypes[state.currentChestId];
    delete state.stats.chest[state.currentChestId];
    delete state.chestPity[state.currentChestId];
    state.currentChestId = ids.filter(i => i !== state.currentChestId)[0] || ids[0];
    setChestEngine(new ChestEngine(getCurrentChestItems(), getCurrentPity()));
    if (state.chestPity[state.currentChestId]) chestEngine.restorePity(state.chestPity[state.currentChestId]);
    saveState(); renderChestTypeTabs(els); renderItemPreview(els); renderChestStats(els); renderChestPity(els); renderItemList(els);
  });
}

// ═══ 重置 ═══
function resetPity() { gachaEngine.resetPity(); state.engineState = gachaEngine.exportState(); chestEngine.resetPity(); state.chestPity[state.currentChestId] = chestEngine.exportPity(); saveState(); renderPity(els); renderChestPity(els); }
function resetStats() {
  state.stats = { gacha: { total: 0, r5: 0, r4: 0, r3: 0 }, chest: {} };
  for (const id of Object.keys(state.chestTypes)) state.stats.chest[id] = freshChestStats();
  for (const id of Object.keys(state.chestTypes)) state.chestPity[id] = { pity5: 0 };
  chestEngine.resetPity();
  state.history = [];
  if (state.noneu) state.noneu = freshNoneuState();
  saveState(); renderGachaStats(els); renderChestStats(els); renderChestPity(els); renderNoneuBar(els);
  if (els.noneuEnabledToggle) els.noneuEnabledToggle.checked = state.noneu?.settings?.enabled;
}
function resetAll() {
  localStorage.removeItem('gacha-sim-state');
  location.reload();
}

// ═══ PWA ═══
let deferredPrompt = null;
function registerPWA() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; els.installBtn.style.display = 'flex'; });
  window.addEventListener('appinstalled', () => { els.installBtn.style.display = 'none'; deferredPrompt = null; });
}
function triggerInstall() { if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then(() => { deferredPrompt = null; els.installBtn.style.display = 'none'; }); } }

// ═══ 成就弹窗 ═══
let achToastTimer = null;

function showAchToast(achId) {
  const info = getAchievementInfo(achId);
  const isNon = achId.startsWith('non');
  const toast = $('achToast');
  $('achToastIcon').textContent = info.icon;
  $('achToastName').textContent = info.name;
  $('achToastDesc').textContent = info.desc;
  toast.classList.toggle('non-eu', isNon);

  // 清除旧定时器，防止竞态
  if (achToastTimer) {
    clearTimeout(achToastTimer);
    achToastTimer = null;
  }

  // 先移除再添加，强制回流触发 CSS transition 重新播放
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');

  // 保存定时器引用，2800ms后自动关闭
  achToastTimer = setTimeout(() => {
    toast.classList.remove('show');
    achToastTimer = null;
  }, 2800);
}

// ═══ 宝箱标签切换（容器级委托，innerHTML重渲染不丢）═══
function handleTabSwitch(e, container) {
  const t = e.target.closest('.chest-type-tab');
  if (!t) return;
  const chestId = t.dataset.chestId;
  if (chestId === state.currentChestId) return;

  // 切换前清除当前宝箱所有数据
  state.stats.chest[state.currentChestId] = freshChestStats();
  chestEngine.resetPity();
  state.chestPity[state.currentChestId] = chestEngine.exportPity();
  state.chestTypes[state.currentChestId].items = chestEngine.items;
  // 切换到新宝箱
  switchChestType(chestId);
  saveState();

  [container, els.chestTypeTabs, els.settingsChestTabs].forEach(c => {
    if (!c) return;
    c.querySelectorAll('.chest-type-tab').forEach(tb => tb.classList.toggle('active', tb.dataset.chestId === chestId));
  });
  renderItemPreview(els);
  renderChestStats(els);
  renderItemList(els);
  renderChestPity(els);
  renderChestSettings(els);
  renderNoneuBar(els);
}

// ═══ 启动 ═══
function init() {
  bindEvents();
  renderAll(els);
  // 宝箱标签栏 — 容器级事件委托（innerHTML重渲染后不丢事件）
  els.chestTypeTabs.addEventListener('click', e => handleTabSwitch(e, els.chestTypeTabs));
  if (els.settingsChestTabs) els.settingsChestTabs.addEventListener('click', e => handleTabSwitch(e, els.settingsChestTabs));
  registerPWA();
}
init();
