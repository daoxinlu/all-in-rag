/**
 * 来测测你的欧气吧 — 纯事后非欧鉴定系统
 * 只读现有数据，绝不修改任何抽卡逻辑
 */
export { RARITY_META } from './gacha.js';

// ═══ 期望值表（静态兜底，用于角色祈愿和未知宝箱）═══
// 宝箱优先用动态计算: calcExpectedWithPity(rate, pity)
export const EXPECTED_PULLS = {
  character: { 5: 62.5, 4: 6.67 },   // 角色祈愿: 0.6%+90保底(含软保底)
  chest: {
    default:    { 5: 63 },            // 标准宝箱: 1%+100保底
    blessing:   { 5: 1000 },          // 祈福宝箱: 0.1%无保底
    treasure:   { 5: 20000 },         // 珍宝宝箱: 0.005%无保底
    recruit:    { 5: 90 },            // 纳贤宝箱: 0.5%+120保底
  },
};

// 动态计算数学期望: E = Σ k·p·(1-p)^(k-1) + N·(1-p)^(N-1)
// rate: 小数概率(0.01=1%), pityHard: 保底抽数(0=无保底)
export function calcExpectedWithPity(rate, pityHard) {
  if (!pityHard || pityHard <= 0) return Math.round(100 / (rate * 100));  // 无保底 E=1/p
  const p = rate, N = pityHard, q = 1 - p;
  const qNm1 = Math.pow(q, N - 1), qN = qNm1 * q;
  const sum = (1 - N * qNm1 + (N - 1) * qN) / (p * p);
  return Math.round(p * sum + N * qNm1);
}

function getExpected(realm, chestId, rarity, chestRate, chestPity) {
  if (realm === 'character') return EXPECTED_PULLS.character[rarity] || 100;
  // 宝箱: 优先动态计算
  if (chestRate != null && chestRate > 0) {
    const pity = chestPity || 0;
    return calcExpectedWithPity(chestRate, pity);
  }
  // 兜底静态表（旧数据无 rate/pity 时）
  const chest = EXPECTED_PULLS.chest[chestId];
  return chest ? (chest[rarity] || 100) : 200;
}

// ═══ 幸运值计算 ═══
export function calcLuckyValue(realm, chestId, rarity, actualPulls, chestRate, chestPity) {
  if (actualPulls <= 0) return 100;
  const expected = getExpected(realm, chestId, rarity, chestRate, chestPity);
  return Math.round((expected / actualPulls) * 100);
}

export function calcRecentLucky(history) {
  if (!history || history.length === 0) return 100;
  const recent = history.slice(-10);
  let weightSum = 0, weightedSum = 0;
  for (let i = 0; i < recent.length; i++) {
    const w = i + 1;
    weightedSum += recent[i].luckyValue * w;
    weightSum += w;
  }
  return Math.round(weightedSum / weightSum);
}

export function calcLifetimeLucky(history) {
  if (!history || history.length === 0) return 100;
  const sum = history.reduce((s, h) => s + h.luckyValue, 0);
  const base = Math.round(sum / history.length);
  const natural = history.filter(h => !h.isPity).length;
  const total = history.length;
  const rate = total > 0 ? natural / total : 0;
  // 提前率越高越接近基础值，保底率越高折扣越大 (0.5~1.0)
  return Math.max(1, Math.round(base * (0.5 + rate * 0.5)));
}

// ═══ 非欧等级 ═══
export const FORTUNE_LEVELS = [
  { id: 'mythic_eu',  name: '神话欧皇', icon: '👑👑👑', min: 500, color: '#ffd700' },
  { id: 'legend_eu',  name: '传说欧皇', icon: '👑👑',   min: 300, color: '#ffa500' },
  { id: 'epic_eu',    name: '史诗欧皇', icon: '👑',     min: 200, color: '#ffb347' },
  { id: 'rare_eu',    name: '好运玩家', icon: '✨',     min: 120, color: '#a855f7' },
  { id: 'normal',     name: '运气平平', icon: '🟡',     min: 80,  color: '#facc15' },
  { id: 'rare_non',   name: '非洲萌新', icon: '🥺',     min: 50,  color: '#9ca3af' },
  { id: 'epic_non',   name: '非洲酋长', icon: '👿',     min: 30,  color: '#6b7280' },
  { id: 'legend_non', name: '终极非酋', icon: '💀',     min: 10,  color: '#374151' },
  { id: 'mythic_non', name: '概率绝缘体', icon: '⚫',   min: 0,   color: '#1f2937' },
];

export function getFortuneLevel(lifetimeLucky) {
  for (const L of FORTUNE_LEVELS) if (lifetimeLucky >= L.min) return L;
  return FORTUNE_LEVELS[FORTUNE_LEVELS.length - 1];
}

// ═══ 数据初始化 ═══
export function freshNoneuData(realm) {
  return { realm, fiveStarHistory: [], fourStarHistory: [], achievements: [], records: {} };
}

export function freshNoneuState() {
  return {
    character: freshNoneuData('character'),
    chests: {},
    settings: { enabled: true, showLuckyValue: true, showAchievementAnimation: true },
  };
}

// ═══ 钩子：记录抽卡结果 ═══
export function recordPull(state, mode, details) {
  if (!state.noneu?.settings?.enabled) return;
  if (!state.noneu) state.noneu = freshNoneuState();
  if (mode === 'gacha') recordGachaPull(state.noneu, details);
  else if (mode === 'chest') recordChestPull(state.noneu, details);
}

function recordGachaPull(noneu, { rarity, count, isUp, timestamp }) {
  if (rarity < 4) return;
  const data = noneu.character;
  const lucky = calcLuckyValue('character', null, rarity, count);
  const expected = rarity === 5 ? 62.5 : 6.67;
  const entry = { count, luckyValue: lucky, isUp: !!isUp, isPity: count >= expected * 0.8, timestamp: timestamp || Date.now() };
  const key = rarity === 5 ? 'fiveStarHistory' : 'fourStarHistory';
  data[key].push(entry);
}

// chestRate: 小数(0.01=1%), chestPity: 保底抽数(0=无保底)
function recordChestPull(noneu, { chestId, rarity, name, count, chestRate, chestPity, timestamp }) {
  if (rarity < 4) return;
  if (!noneu.chests[chestId]) noneu.chests[chestId] = freshNoneuData('chest');
  const data = noneu.chests[chestId];
  const lucky = calcLuckyValue('chest', chestId, rarity, count, chestRate, chestPity);
  const expected = getExpected('chest', chestId, rarity, chestRate, chestPity);
  const entry = { count, luckyValue: lucky, name, isPity: count >= expected * 0.8, timestamp: timestamp || Date.now() };
  const key = rarity === 5 ? 'fiveStarHistory' : 'fourStarHistory';
  data[key].push(entry);
}

// ═══ 成就系统 ═══
export const ACHIEVEMENTS = {
  eu_1: { name: '幸运星认证', desc: '欧气值≥120', icon: '⭐', rarity: '普通', reward: '称号：幸运星' },
  eu_2: { name: '好运连连', desc: '欧气值≥150', icon: '🎯', rarity: '稀有', reward: '称号：好运连连 + 金色闪烁特效' },
  eu_3: { name: '欧皇附体', desc: '欧气值≥200', icon: '👑', rarity: '罕见', reward: '称号：欧皇附体 + 金色头像框' },
  eu_4: { name: '天选之人', desc: '欧气值≥250', icon: '👑✨', rarity: '极罕见', reward: '称号：天选之人 + 额外粒子特效' },
  eu_5: { name: '命运宠儿', desc: '欧气值≥300', icon: '🌟', rarity: '史诗', reward: '称号：命运宠儿 + 专属抽卡边框' },
  eu_6: { name: '欧皇传说', desc: '欧气值≥400', icon: '👑👑', rarity: '传说', reward: '称号：欧皇传说 + 金色界面皮肤' },
  eu_7: { name: '概率之神', desc: '欧气值≥500', icon: '⚡', rarity: '神话', reward: '称号：概率之神 + 全屏金色闪电 + 永久金色主题' },

  non_1: { name: '非洲萌新认证', desc: '欧气值≤80', icon: '🌱', rarity: '普通', reward: '称号：非洲萌新' },
  non_2: { name: '非洲居民', desc: '欧气值≤70', icon: '🏜️', rarity: '稀有', reward: '称号：非洲居民 + 灰色闪烁特效' },
  non_3: { name: '非洲酋长', desc: '欧气值≤50', icon: '👿', rarity: '罕见', reward: '称号：非洲酋长 + 灰色头像框' },
  non_4: { name: '非洲大酋长', desc: '欧气值≤40', icon: '💀', rarity: '极罕见', reward: '称号：非洲大酋长 + 黑色烟雾特效' },
  non_5: { name: '非酋本酋', desc: '欧气值≤30', icon: '🪦', rarity: '史诗', reward: '称号：非酋本酋 + 专属抽卡边框' },
  non_6: { name: '终极非酋', desc: '欧气值≤20', icon: '⚰️', rarity: '传说', reward: '称号：终极非酋 + 黑色界面皮肤' },
  non_7: { name: '概率绝缘体', desc: '欧气值≤10', icon: '⚫', rarity: '神话', reward: '称号：概率绝缘体 + 全屏灰色滤镜' },
};

export function checkAchievements(noneu, realm, chestId) {
  if (!noneu?.character) return [];
  const newly = [];
  // 按玩法分轨：gacha 用角色历史，chest 用指定宝箱历史
  const history = realm === 'gacha'
    ? noneu.character.fiveStarHistory
    : (noneu.chests?.[chestId]?.fiveStarHistory || []);
  const lifetime = calcLifetimeLucky(history);
  // 成就数据按玩法隔离存储
  const data = realm === 'gacha' ? noneu.character : (noneu.chests[chestId] || freshNoneuData('chest'));

  const checks = [
    ['eu_1', 120, true], ['eu_2', 150, true], ['eu_3', 200, true],
    ['eu_4', 250, true], ['eu_5', 300, true], ['eu_6', 400, true], ['eu_7', 500, true],
    ['non_1', 80, false], ['non_2', 70, false], ['non_3', 50, false],
    ['non_4', 40, false], ['non_5', 30, false], ['non_6', 20, false], ['non_7', 10, false],
  ];

  for (const [id, threshold, ge] of checks) {
    if (ge ? lifetime >= threshold : lifetime <= threshold) {
      if (tryUnlockData(data, id)) newly.push(id);
    }
  }
  return newly;
}

function tryUnlockData(data, id) {
  if (!data.achievements) data.achievements = [];
  if (data.achievements.includes(id)) return false;
  data.achievements.push(id);
  return true;
}

export function getAchievementInfo(id) {
  return ACHIEVEMENTS[id] || { name: id, desc: '', icon: '🏅', rarity: '', reward: '' };
}
