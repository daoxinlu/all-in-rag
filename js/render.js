/**
 * 抽卡模拟器 — 渲染函数
 * 所有 DOM 更新集中在此
 */
import { state, gachaEngine, chestEngine, getCurrentChestStats, RARITY_META, Rarity } from './state.js';
import { calcPityFromItems } from './gacha.js';
import { calcLifetimeLucky, calcRecentLucky, getFortuneLevel } from './noneu.js';

export function renderAll(els) {
  renderFeaturedChar(els);
  renderPity(els);
  renderGachaStats(els);
  renderChestTypeTabs(els);
  renderChestPity(els);
  renderChestStats(els);
  renderCharPreview(els);
  renderItemPreview(els);
  renderItemList(els);
  renderCharList(els);
  renderSettings(els);
  renderChestSettings(els);
  renderNoneuBar(els);
}

// ═══ 来测测你的欧气吧渲染 ═══
export function renderNoneuBar(els) {
  const ne = state.noneu;
  if (!ne?.settings?.enabled) {
    if (els.gachaNoneu) els.gachaNoneu.innerHTML = '';
    if (els.chestNoneu) els.chestNoneu.innerHTML = '';
    return;
  }

  // 角色祈愿运势
  const chrHistory = ne.character?.fiveStarHistory || [];
  const chrLifetime = calcLifetimeLucky(chrHistory);
  const chrLevel = getFortuneLevel(chrLifetime);
  if (els.gachaNoneu) {
    els.gachaNoneu.innerHTML = chrHistory.length > 4
      ? `<span><span class="noneu-icon">${chrLevel.icon}</span><span class="noneu-level">${chrLevel.name}</span></span><span class="noneu-lucky">欧气值 ${chrLifetime}</span>`
      : `<span style="color:var(--text-muted)">🏷️ 来测测你的欧气吧 · 满5次五星后解锁评价</span>`;
  }

  // 宝箱运势
  const chestId = state.currentChestId;
  const chestHistory = ne.chests?.[chestId]?.fiveStarHistory || [];
  const chestLifetime = calcLifetimeLucky(chestHistory);
  const chestLevel = getFortuneLevel(chestLifetime);
  if (els.chestNoneu) {
    els.chestNoneu.innerHTML = chestHistory.length > 4
      ? `<span><span class="noneu-icon">${chestLevel.icon}</span><span class="noneu-level">${chestLevel.name}</span></span><span class="noneu-lucky">欧气值 ${chestLifetime}</span>`
      : `<span style="color:var(--text-muted)">🏷️ 来测测你的欧气吧 · 满5次五星后解锁评价</span>`;
  }
}

export function renderFeaturedChar(els) {
  const featured = state.characters[5]?.find(c => c.featured) || state.characters[5]?.[0];
  if (featured) els.featuredChar.innerHTML = `<span class="char-avatar">${featured.icon}</span>`;
}

export function renderPity(els) {
  if (!state.config.pityEnabled) {
    els.pityBar5.style.width = '0%';
    els.pityText5.textContent = '保底已关闭';
    els.pityBar4.style.width = '0%';
    els.pityText4.textContent = '保底已关闭';
    els.guaranteeText.textContent = '';
    els.guaranteeText.classList.remove('active');
    return;
  }
  const pity5 = gachaEngine.pity5, max5 = state.config.pity5Hard;
  els.pityBar5.style.width = Math.min(100, (pity5 / max5) * 100) + '%';
  els.pityBar5.dataset.rarity = '5';
  els.pityText5.textContent = `${pity5}/${max5}`;

  const pity4 = gachaEngine.pity4;
  els.pityBar4.style.width = Math.min(100, (pity4 / 10) * 100) + '%';
  els.pityBar4.dataset.rarity = '4';
  els.pityText4.textContent = `${pity4}/10`;

  if (state.config.fiftyFifty && gachaEngine.guaranteedFeatured) {
    els.guaranteeText.textContent = '下次五星必出UP角色';
    els.guaranteeText.classList.add('active');
  } else if (state.config.fiftyFifty) {
    els.guaranteeText.textContent = '五星有50%概率为UP角色';
    els.guaranteeText.classList.remove('active');
  } else {
    els.guaranteeText.textContent = '';
    els.guaranteeText.classList.remove('active');
  }
}

export function renderGachaStats(els) {
  els.statTotal.textContent = state.stats.gacha.total;
  els.stat5.textContent = state.stats.gacha.r5;
  els.stat4.textContent = state.stats.gacha.r4;
}

export function renderChestStats(els) {
  const cs = getCurrentChestStats();
  els.chestStatTotal.textContent = cs.total || 0;
  els.chestStat5.textContent = cs.r5 || 0;
  els.chestStat4.textContent = cs.r4 || 0;
  els.chestStat3.textContent = cs.r3 || 0;
}

export function renderCharPreview(els) {
  let html = '';
  for (const rarity of [5, 4, 3]) {
    (state.characters[rarity] || []).forEach(c => {
      const meta = RARITY_META[rarity];
      html += `<div class="item-row" data-rarity="${rarity}">
        <span class="card-icon">${c.icon || '👤'}</span>
        <span class="item-name">${c.name}${c.element ? ' · ' + c.element : ''}${c.featured ? ' ⬆️UP' : ''}</span>
        <span class="item-prob" style="color:${meta.color}">${meta.stars}</span>
      </div>`;
    });
  }
  els.charPreview.innerHTML = html || '<div class="empty-state">暂无角色，到设置中添加</div>';
}

export function renderItemPreview(els) {
  const probs = chestEngine.getProbabilities();
  if (!probs.length) { els.itemPreview.innerHTML = '<div class="empty-state">暂无物品，到设置中添加</div>'; return; }
  els.itemPreview.innerHTML = probs.map(item =>
    `<div class="item-row" data-rarity="${item.rarity}">
      <span class="card-icon" style="font-size:1.1rem">${RARITY_META[item.rarity]?.icon || '⭐'}</span>
      <span class="item-name">${item.name}</span>
      <span class="item-prob">${item.probability}%</span>
    </div>`
  ).join('');
}

export function renderItemList(els) {
  const probs = chestEngine.getProbabilities();
  const locked = state.chestTypes[state.currentChestId]?.locked;
  if (!probs.length) {
    els.itemList.innerHTML = locked ? '<div class="empty-state">🔒 标准宝箱物品不可编辑</div>' : '<div class="empty-state">暂无物品，点击 +添加</div>';
    return;
  }
  els.itemList.innerHTML = probs.map(item =>
    `<div class="item-row" data-rarity="${item.rarity}">
      <span class="card-icon" style="font-size:1.1rem">${RARITY_META[item.rarity]?.icon || '⭐'}</span>
      <span class="item-name">${item.name}</span>
      <span class="item-prob">${item.probability}%</span>
      ${locked ? '<span class="item-prob" style="color:var(--text-muted)">🔒</span>'
        : `<div class="item-actions">
             <button class="item-act-btn" data-edit="${item.id}">编辑</button>
             <button class="item-act-btn" data-del="${item.id}">删除</button>
           </div>`}
    </div>`
  ).join('');
}

export function renderCharList(els) {
  els.charList.innerHTML = '<div class="empty-state" style="padding:20px">🚧 敬请期待</div>';
}

export function renderSettings(els) {
  els.rate5Slider.value = els.rate5Input.value = state.config.rate5 * 100;
  els.rate4Slider.value = els.rate4Input.value = state.config.rate4 * 100;
  els.pity5Slider.value = els.pity5Input.value = state.config.pity5Hard;
  els.softPitySlider.value = els.softPityInput.value = state.config.pity5Soft;
  els.fiftyFiftyToggle.checked = state.config.fiftyFifty;
  els.pityEnabledToggle.checked = state.config.pityEnabled !== false;
}

export function renderChestTypeTabs(els) {
  const ct = state.chestTypes;
  const tabsHTML = Object.entries(ct).map(([id, t]) =>
    `<div class="chest-type-tab${id === state.currentChestId ? ' active' : ''}" data-chest-id="${id}">${t.name}</div>`
  ).join('');
  els.chestTypeTabs.innerHTML = tabsHTML;
  if (els.settingsChestTabs) els.settingsChestTabs.innerHTML = tabsHTML;
}

// 获取当前宝箱保底配置
function getCp() {
  const ct = state.chestTypes[state.currentChestId];
  return ct?.pity || { pity5Enabled: true, pity5Hard: 100 };
}

// 宝箱保底进度（宝箱面板）—— 仅五星硬保底
export function renderChestPity(els) {
  const cp = getCp();
  const c5 = chestEngine.pity5 || 0;
  const hard = cp.pity5Hard || 100;
  const pct = Math.min(100, Math.round(c5 / hard * 100));
  let html = `<div class="pity-row"><span>五星保底</span><span class="pity-count">${c5}/${hard}</span><div class="pity-bar"><div class="pity-fill gold" style="width:${pct}%"></div></div></div>`;
  html += `<div style="font-size:0.6rem;color:var(--text-muted);margin-top:4px">${cp.pity5Enabled ? '保底已开启' : '保底已关闭'}</div>`;
  els.chestPityEl.innerHTML = html;
  if (els.gachaPityInChest) els.gachaPityInChest.innerHTML = '';
}

// 宝箱保底设置渲染
export function renderChestSettings(els) {
  const cp = getCp();
  els.chestPityChestName.textContent = state.chestTypes[state.currentChestId]?.name || '—';
  els.chestPity5Toggle.checked = cp.pity5Enabled;
  // 滑块上限始终用物品权重计算值（不受用户修改影响）
  const ct = state.chestTypes[state.currentChestId];
  const defaultPity = ct?.items ? calcPityFromItems(ct.items) : cp;
  const max = Math.max(defaultPity.pity5Hard * 2, 100);
  els.chestPity5Slider.max = max;
  els.chestPity5Input.max = max;
  els.chestPity5Slider.value = els.chestPity5Input.value = cp.pity5Hard;
}
