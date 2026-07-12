/**
 * 抽卡引擎 - 核心概率与保底逻辑
 * @module gacha.js
 */

// ========================================
// 稀有度常量
// ========================================
export const Rarity = {
  FIVE: 5,
  FOUR: 4,
  THREE: 3,
  TWO: 2,
  ONE: 1,
};

export const RARITY_META = {
  5: { name: '五星', stars: '★★★★★', color: '#ffd700', icon: '🌟' },
  4: { name: '四星', stars: '★★★★', color: '#a855f7', icon: '✨' },
  3: { name: '三星', stars: '★★★', color: '#3b82f6', icon: '⭐' },
  2: { name: '二星', stars: '★★', color: '#22c55e', icon: '💚' },
  1: { name: '一星', stars: '★', color: '#6b7280', icon: '🗑️' },
};

// ========================================
// 默认角色数据池
// ========================================
export const DEFAULT_CHARACTERS = {
  5: [
    { name: '星辉剑士', element: '风', icon: '⚔️', featured: true },
    { name: '永夜公主', element: '暗', icon: '🌙', featured: false },
    { name: '雷鸣尊者', element: '雷', icon: '⚡', featured: false },
    { name: '烈焰王座', element: '火', icon: '🔥', featured: false },
  ],
  4: [
    { name: '翠风吟游', element: '风', icon: '🍃', featured: false },
    { name: '烈焰铁心', element: '火', icon: '🜂', featured: false },
    { name: '寒霜秘术', element: '冰', icon: '❄️', featured: false },
    { name: '琉璃医者', element: '水', icon: '💧', featured: false },
    { name: '雷霆枪手', element: '雷', icon: '⚡', featured: false },
    { name: '岩盾守卫', element: '岩', icon: '🪨', featured: false },
  ],
  3: [
    { name: '铁质长剑', icon: '🗡️' },
    { name: '白缨长枪', icon: '🔱' },
    { name: '学徒法器', icon: '📖' },
    { name: '猎手之弓', icon: '🏹' },
    { name: '训练大剑', icon: '⚒️' },
    { name: '铁面盾牌', icon: '🛡️' },
  ],
};

// ========================================
// 默认宝箱物品
// ========================================
export const DEFAULT_CHEST_ITEMS = [
  { id: 'c1', name: '钻石', rarity: 5, weight: 1 },
  { id: 'c2', name: '金锭', rarity: 4, weight: 5 },
  { id: 'c3', name: '银币', rarity: 4, weight: 8 },
  { id: 'c4', name: '铁矿', rarity: 3, weight: 25 },
  { id: 'c5', name: '木头', rarity: 3, weight: 35 },
  { id: 'c6', name: '石头', rarity: 3, weight: 26 },
];

// 辅助：用权重数组构建物品列表，不足100%自动补"垃圾"
function makeChestItems(idPrefix, itemsDef) {
  const total = itemsDef.reduce((s, it) => s + it.weight, 0);
  if (total < 100) {
    itemsDef.push({ name: '垃圾', icon: '🗑️', rarity: 1, weight: 100 - total });
  }
  return itemsDef.map((it, i) => ({
    id: idPrefix + (i + 1),
    name: it.name,
    rarity: it.rarity || 1,
    weight: it.weight,
    ...(it.icon ? { icon: it.icon } : {}),
  }));
}

// 根据物品概率自动计算推荐保底抽数（取最稀有五星的倒数）
function calcPityFromItems(items) {
  const fives = items.filter(i => i.rarity === 5 && i.weight > 0);
  if (fives.length === 0) return { pity5Enabled: false, pity5Hard: 100 };
  const minW = Math.min(...fives.map(i => i.weight));
  // 基于最稀有五星的概率：pity = 100 / weight（weight 即百分数，如 0.1 → 100/0.1 = 1000）
  const p5 = Math.max(1, Math.round(100 / minW));
  return { pity5Enabled: true, pity5Hard: p5 };
}

// 多宝箱类型预设（标准宝箱锁死 + 3个可编辑宝箱）
// 每个宝箱自带保底配置（per-chest pity）
export { calcPityFromItems };

// 多宝箱类型预设（保底根据实际概率自动计算）
export const DEFAULT_CHEST_TYPES = {
  'default': {
    name: '标准宝箱', locked: true,
    items: JSON.parse(JSON.stringify(DEFAULT_CHEST_ITEMS)),
    get pity() { return calcPityFromItems(this.items); },
  },
  'blessing': {
    name: '祈福宝箱',
    items: makeChestItems('bl', [
      { name: '祈福武将', rarity: 5, weight: 0.10 },
      { name: '限定武将', rarity: 4, weight: 0.27 },
      { name: '限定皮肤', rarity: 4, weight: 0.70 },
    ]),
    get pity() { return { ...calcPityFromItems(this.items), pity5Enabled: false }; },
  },
  'treasure': {
    name: '珍宝宝箱',
    items: makeChestItems('tr', [
      { name: '珍宝大奖',   rarity: 5, weight: 0.005 },
      { name: '宝玉*2',     rarity: 4, weight: 0.037 },
      { name: '宝玉*1',     rarity: 4, weight: 0.081 },
      { name: '宝玉*10',    rarity: 4, weight: 0.006 },
      { name: '宝玉*5',     rarity: 4, weight: 0.012 },
      { name: '宝玉碎片*5', rarity: 3, weight: 0.130 },
      { name: '宝玉碎片*2', rarity: 3, weight: 0.280 },
      { name: '宝玉碎片',   rarity: 3, weight: 0.750 },
    ]),
    get pity() { return { ...calcPityFromItems(this.items), pity5Enabled: false }; },
  },
  'recruit': {
    name: '纳贤宝箱',
    items: makeChestItems('nx', [
      { name: '谋许攸', rarity: 5, weight: 0.5 },
    ]),
    get pity() { return { ...calcPityFromItems(this.items), pity5Hard: 120 }; },
  },
};

function freshChestStats() {
  return { total: 0, r5: 0, r4: 0, r3: 0, items: {}, early5: { total: 0, sum: 0, min: null, natural: 0, pity: 0 } };
}
export { freshChestStats };

// ========================================
// 默认配置
// ========================================
export const DEFAULT_CONFIG = {
  rate5: 0.006,       // 五星基础概率 0.6%
  rate4: 0.051,       // 四星基础概率 5.1%
  pity5Hard: 90,      // 五星硬保底
  pity5Soft: 90,      // 五星软保底起始（默认=硬保底，即不启用软保底）
  fiftyFifty: true,   // 五十五十机制
  pityEnabled: true,  // 保底开关：true=启用保底系统，false=纯概率无保底
};

// ========================================
// 抽卡引擎类
// ========================================
export class GachaEngine {
  /**
   * @param {Object} config - 抽卡配置
   * @param {Object} characters - 角色数据池
   */
  constructor(config, characters) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.characters = characters || DEFAULT_CHARACTERS;
    // 保底计数器
    this.pity5 = 0;
    this.pity4 = 0;
    // 大保底标记（上一次歪了则下次必出UP）
    this.guaranteedFeatured = false;
  }

  /**
   * 从配置恢复状态
   */
  restoreState(state) {
    if (!state) return;
    this.pity5 = state.pity5 || 0;
    this.pity4 = state.pity4 || 0;
    this.guaranteedFeatured = state.guaranteedFeatured || false;
  }

  /**
   * 导出状态用于持久化
   */
  exportState() {
    return {
      pity5: this.pity5,
      pity4: this.pity4,
      guaranteedFeatured: this.guaranteedFeatured,
    };
  }

  /**
   * 计算当前实际五星概率（含软保底）
   * 保底关闭时返回纯基础概率
   * @returns {number} 0~1 之间的概率
   */
  getEffectiveRate5() {
    const base = this.config.rate5;
    // 保底关闭：纯概率
    if (!this.config.pityEnabled) return base;

    const count = this.pity5;
    // 硬保底
    if (count >= this.config.pity5Hard - 1) return 1.0;
    // 软保底：从 softStart 开始每抽额外增加约 6% 概率（soft≥hard=关闭）
    if (this.config.pity5Soft < this.config.pity5Hard && count >= this.config.pity5Soft) {
      const bonus = (count - this.config.pity5Soft + 1) * 0.06;
      return Math.min(1.0, base + bonus);
    }
    return base;
  }

  /**
   * 单次抽取
   * @returns {{ rarity: number, character: Object, isFeatured: boolean }}
   */
  pull() {
    const prePity5 = this.pity5;
    // 仅在保底开启时递增计数器
    if (this.config.pityEnabled) {
      this.pity5++;
      this.pity4++;
    }

    const effRate5 = this.getEffectiveRate5();
    const roll = Math.random();

    let rarity;
    let character;
    let isFeatured = false;

    if (roll < effRate5) {
      // 出五星
      rarity = Rarity.FIVE;
      this.pity5 = 0;

      // 五十五十判定
      if (this.config.fiftyFifty) {
        if (this.guaranteedFeatured) {
          // 大保底：必出UP
          character = this.pickCharacter(5, true);
          isFeatured = true;
          this.guaranteedFeatured = false;
        } else {
          // 50% 概率出UP
          if (Math.random() < 0.5) {
            character = this.pickCharacter(5, true);
            isFeatured = true;
          } else {
            // 歪了：出常驻五星
            character = this.pickCharacter(5, false);
            this.guaranteedFeatured = true;
          }
        }
      } else {
        character = this.pickCharacter(5, false);
      }
    } else if (roll < effRate5 + this.config.rate4) {
      // 四星（基础概率）
      rarity = Rarity.FOUR;
      this.pity4 = 0;
      character = this.pickCharacter(4, false);
    } else if (this.config.pityEnabled && this.pity4 >= 10) {
      // 十抽保底四星（保底关闭时不触发）
      rarity = Rarity.FOUR;
      this.pity4 = 0;
      character = this.pickCharacter(4, false);
    } else {
      // 三星
      rarity = Rarity.THREE;
      // 三星不重置四星保底（原神机制：只有出四星+才重置四星计数器）
      character = this.pickCharacter(3, false);
    }

    return { rarity, character, isFeatured, _prePity5: prePity5 };
  }

  /**
   * 十连抽（含保底：至少一个四星+）
   * @returns {Array} 抽取结果数组
   */
  pullTen() {
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(this.pull());
    }

    // 十连保底：保底开启时，如果没有四星以上，将最后一个三星升级为四星
    if (this.config.pityEnabled !== false) {
      const hasFourPlus = results.some((r) => r.rarity >= Rarity.FOUR);
      if (!hasFourPlus) {
        const last = results[results.length - 1];
        last.rarity = Rarity.FOUR;
        last.character = this.pickCharacter(4, false);
        last.isFeatured = false;
        this.pity4 = 0;
      }
    }

    // 排序：五星在前 -> 四星 -> 三星，同稀有度内部保持顺序
    results.sort((a, b) => {
      if (a.rarity !== b.rarity) return b.rarity - a.rarity;
      return 0; // 保持稳定排序
    });

    return results;
  }

  /**
   * 批量抽取（支持任意数量，性能优化版）
   * 按十连为一组执行保底逻辑，最后不足十连部分单独处理
   * @param {number} count - 抽取次数
   * @returns {Array} 抽取结果数组（未排序，保持抽取顺序）
   */
  pullMany(count) {
    const results = [];
    let remaining = count;

    while (remaining > 0) {
      const batch = Math.min(10, remaining);
      const batchResults = [];

      for (let i = 0; i < batch; i++) {
        batchResults.push(this.pull());
      }

      // 十连保底：如果本组恰好10个且没有四星以上，升级最后一个（保底关闭时不触发）
      if (this.config.pityEnabled && batch === 10) {
        const hasFourPlus = batchResults.some((r) => r.rarity >= Rarity.FOUR);
        if (!hasFourPlus) {
          const last = batchResults[batchResults.length - 1];
          last.rarity = Rarity.FOUR;
          last.character = this.pickCharacter(4, false);
          last.isFeatured = false;
        }
      }

      results.push(...batchResults);
      remaining -= batch;
    }

    return results;
  }

  /**
   * 从角色池中随机选择一个角色
   * @param {number} rarity - 稀有度
   * @param {boolean} featuredOnly - 是否只选UP角色
   * @returns {Object} 角色对象
   */
  pickCharacter(rarity, featuredOnly) {
    const pool = this.characters[rarity] || [];
    let candidates = pool;

    if (featuredOnly && rarity === Rarity.FIVE) {
      candidates = pool.filter((c) => c.featured);
      // 没有UP角色则退回全部
      if (candidates.length === 0) candidates = pool;
    }

    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }

  /**
   * 重置保底
   */
  resetPity() {
    this.pity5 = 0;
    this.pity4 = 0;
    this.guaranteedFeatured = false;
  }
}

// ========================================
// 宝箱引擎类
// ========================================
export class ChestEngine {
  /**
   * @param {Array} items - 物品列表
   * @param {Object} config - { pity5Enabled, pity5Hard, pity4Enabled, pity4Hard }
   */
  constructor(items, config) {
    this.items = items || [...DEFAULT_CHEST_ITEMS];
    this.config = config || { pity5Enabled: true, pity5Hard: 100 };
    this.pity5 = 0;
  }

  /** 从加权列表里按指定稀有度抽取 */
  _openRarity(rarity) {
    const candidates = this.items.filter(i => i.rarity === rarity);
    if (!candidates.length) return null;
    const totalW = candidates.reduce((s, i) => s + i.weight, 0);
    let roll = Math.random() * totalW;
    for (const item of candidates) {
      roll -= item.weight;
      if (roll <= 0) return { item, rarity: item.rarity };
    }
    return { item: candidates[candidates.length - 1], rarity };
  }

  /** 正常加权随机 */
  _normalOpen() {
    const totalWeight = this.items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) return { item: this.items[0], rarity: this.items[0].rarity };
    let roll = Math.random() * totalWeight;
    for (const item of this.items) {
      roll -= item.weight;
      if (roll <= 0) return { item, rarity: item.rarity };
    }
    return { item: this.items[this.items.length - 1], rarity: this.items[this.items.length - 1].rarity };
  }

  /**
   * 加权随机抽取（仅五星硬保底）
   * @returns {{ item: Object, rarity: number }}
   */
  open() {
    const pityBefore = this.pity5;
    let result;
    if (this.config.pity5Enabled && this.pity5 >= this.config.pity5Hard - 1) {
      result = this._openRarity(5) || this._normalOpen();
    } else {
      result = this._normalOpen();
    }
    if (this.config.pity5Enabled) {
      this.pity5++;
      if (result.rarity === 5) this.pity5 = 0;
    }
    result._pityBefore = pityBefore;
    return result;
  }

  /** 导出保底状态 */
  exportPity() {
    return { pity5: this.pity5 };
  }

  /** 恢复保底状态 */
  restorePity(s) {
    this.pity5 = s?.pity5 || 0;
  }

  /** 重置保底 */
  resetPity() {
    this.pity5 = 0;
  }

  /**
   * 连开十次
   * @returns {Array}
   */
  openTen() {
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(this.open());
    }
    // 按稀有度排序
    results.sort((a, b) => b.rarity - a.rarity);
    return results;
  }

  /**
   * 批量开箱（支持任意数量，性能优化版）
   * @param {number} count - 开箱次数
   * @returns {Array} 结果数组（未排序，保持顺序）
   */
  openMany(count) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(this.open());
    }
    return results;
  }

  /**
   * 计算每个物品的实际概率
   * @returns {Array} [{ ...item, probability }]
   */
  getProbabilities() {
    const totalWeight = this.items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) return [];

    return this.items.map((item) => ({
      ...item,
      probability: ((item.weight / totalWeight) * 100).toFixed(4),
    }));
  }

  /**
   * 添加物品
   */
  addItem(item) {
    this.items.push({
      id: 'c' + Date.now(),
      ...item,
    });
  }

  /**
   * 更新物品
   */
  updateItem(id, updates) {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx >= 0) {
      this.items[idx] = { ...this.items[idx], ...updates };
    }
  }

  /**
   * 删除物品
   */
  removeItem(id) {
    this.items = this.items.filter((i) => i.id !== id);
  }
}

// ========================================
// 工具函数
// ========================================

/**
 * 格式化时间
 * @param {number} timestamp
 * @returns {string}
 */
export function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${mins}`;
}

/**
 * 生成唯一ID
 */
export function genId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}
