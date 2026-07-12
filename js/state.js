/**
 * 抽卡模拟器 — 状态管理 + 引擎实例
 * 被 app.js / render.js / modals.js 共享
 */
import {
  GachaEngine, ChestEngine,
  DEFAULT_CONFIG, DEFAULT_CHARACTERS, DEFAULT_CHEST_ITEMS, DEFAULT_CHEST_TYPES,
  freshChestStats, calcPityFromItems, RARITY_META, formatTime, genId, Rarity,
} from './gacha.js';
import { freshNoneuState } from './noneu.js';

export { freshChestStats, RARITY_META, formatTime, genId, Rarity };

export const STORAGE_KEY = 'gacha-sim-state';
export const STATE_VERSION = 1;

const defaultState = {
  version: STATE_VERSION,
  config: { ...DEFAULT_CONFIG },
  characters: JSON.parse(JSON.stringify(DEFAULT_CHARACTERS)),
  chestTypes: JSON.parse(JSON.stringify(DEFAULT_CHEST_TYPES)),
  currentChestId: 'default',
  engineState: { pity5: 0, pity4: 0, guaranteedFeatured: false },
  chestPity: {}, // {'default': {pity5:0}, ...}  每个宝箱的保底计数器
  stats: {
    gacha: { total: 0, r5: 0, r4: 0, r3: 0 },
    chest: {},
  },
  history: [],
  noneu: freshNoneuState(),
};

for (const id of Object.keys(defaultState.chestTypes)) {
  defaultState.stats.chest[id] = freshChestStats();
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.version) parsed.version = STATE_VERSION;
      if (!parsed.chestTypes && parsed.chestItems) {
        parsed.chestTypes = { 'default': { name: '标准宝箱', items: parsed.chestItems } };
        delete parsed.chestItems;
      }
      if (!parsed.currentChestId) parsed.currentChestId = 'default';

      // 旧版全局 chestConfig → per-chest pity 迁移
      if (parsed.chestConfig && parsed.chestTypes) {
        for (const id of Object.keys(parsed.chestTypes)) {
          if (!parsed.chestTypes[id].pity) {
            parsed.chestTypes[id].pity = { ...parsed.chestConfig };
          }
        }
        delete parsed.chestConfig;
      }

      // 清理已废弃的宝箱类型（旧版全部清理）
      if (parsed.chestTypes) {
        for (const r of ['premium', 'wooden', 'equipment', 'magic', 'coin']) {
          delete parsed.chestTypes[r];
          if (parsed.stats?.chest) delete parsed.stats.chest[r];
        }
        if (['premium', 'wooden', 'equipment', 'magic', 'coin'].includes(parsed.currentChestId)) {
          parsed.currentChestId = 'default';
        }
        // 锁定标准宝箱
        if (parsed.chestTypes['default']) {
          parsed.chestTypes['default'].locked = true;
        }
      }

      if (parsed.stats?.chest && typeof parsed.stats.chest.total === 'number') {
        const old = parsed.stats.chest;
        parsed.stats.chest = {};
        for (const id of Object.keys(parsed.chestTypes || defaultState.chestTypes)) {
          parsed.stats.chest[id] = id === (parsed.currentChestId || 'default')
            ? { total: old.total || 0, r5: old.r5 || 0, r4: old.r4 || 0, r3: old.r3 || 0 }
            : freshChestStats();
        }
      }
      const merged = {
        ...defaultState,
        ...parsed,
        config: { ...defaultState.config, ...(parsed.config || {}) },
        engineState: { ...defaultState.engineState, ...(parsed.engineState || {}) },
        stats: {
          gacha: { ...defaultState.stats.gacha, ...(parsed.stats?.gacha || {}) },
          chest: { ...defaultState.stats.chest, ...(parsed.stats?.chest || {}) },
        },
        chestTypes: { ...defaultState.chestTypes, ...(parsed.chestTypes || {}) },
        currentChestId: parsed.currentChestId || 'default',
      };
      for (const id of Object.keys(merged.chestTypes)) {
        if (!merged.stats.chest[id]) merged.stats.chest[id] = freshChestStats();
        // 预设宝箱始终用最新物品和保底配置（通过 getter 读自定义值）
        if (DEFAULT_CHEST_TYPES[id] && DEFAULT_CHEST_TYPES[id].items) {
          merged.chestTypes[id].items = JSON.parse(JSON.stringify(DEFAULT_CHEST_TYPES[id].items));
          merged.chestTypes[id].pity = { ...DEFAULT_CHEST_TYPES[id].pity };
          delete merged.chestTypes[id].pityCustomized;
        } else if (ct?.items?.length > 0) {
          ct.pity = { ...calcPityFromItems(ct.items) };
        }
      }
      // 旧数据没有 noneu 字段时自动初始化
      if (!merged.noneu) merged.noneu = freshNoneuState();
      return merged;
    }
  } catch (e) { console.warn('加载状态失败', e); }
  const fresh = JSON.parse(JSON.stringify(defaultState));
  fresh.stats.chest = {};
  for (const id of Object.keys(fresh.chestTypes)) fresh.stats.chest[id] = freshChestStats();
  fresh.noneu = freshNoneuState(); // 确保独立实例
  return fresh;
}

export let state = loadState();

// 防御：修复破损的旧数据
if (state.config.rate5 > 0.5 || state.config.rate4 > 0.5) {
  state.config.rate5 = DEFAULT_CONFIG.rate5;
  state.config.rate4 = DEFAULT_CONFIG.rate4;
  gachaEngine.config = { ...state.config };
  console.warn('🛡️ 检测到破损概率值，已自动重置为默认值');
  saveState();
}

export function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.warn('保存失败', e); }
}

// 引擎实例
export const gachaEngine = new GachaEngine(state.config, state.characters);
gachaEngine.restoreState(state.engineState);

function getChestPityConfig() {
  const ct = state.chestTypes[state.currentChestId];
    // 兼容旧数据：没有 pity 字段时给默认值
    if (!ct?.pity) {
      ct.pity = { pity5Enabled: true, pity5Hard: 100 };
    }
  return ct.pity;
}

export let chestEngine = new ChestEngine(getCurrentChestItems(), getChestPityConfig());

// 恢复当前宝箱的保底计数器
function restoreChestPity() {
  const id = state.currentChestId;
  if (!state.chestPity[id]) state.chestPity[id] = { pity5: 0 };
  chestEngine.restorePity(state.chestPity[id]);
}
restoreChestPity();

export function setChestEngine(ce) { chestEngine = ce; }

export function getCurrentChestItems() {
  const ct = state.chestTypes[state.currentChestId];
  return ct ? ct.items : DEFAULT_CHEST_ITEMS;
}

export function getCurrentChestStats() {
  if (!state.stats.chest[state.currentChestId]) state.stats.chest[state.currentChestId] = freshChestStats();
  return state.stats.chest[state.currentChestId];
}

export function switchChestType(chestId) {
  if (chestId === state.currentChestId) return;
  // 保存当前宝箱的物品和保底
  state.chestTypes[state.currentChestId].items = chestEngine.items;
  state.chestTypes[state.currentChestId].pity = { ...getChestPityConfig() };
  state.chestPity[state.currentChestId] = chestEngine.exportPity();
  state.currentChestId = chestId;
  chestEngine = new ChestEngine(getCurrentChestItems(), getChestPityConfig());
  if (state.chestPity[chestId]) chestEngine.restorePity(state.chestPity[chestId]);
  saveState();
}

export { defaultState };
