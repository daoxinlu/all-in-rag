/**
 * 抽卡模拟器 — 弹窗 / 动画 / 编辑
 */
import {
  state, saveState, gachaEngine, chestEngine,
  getCurrentChestStats,
  RARITY_META, Rarity, formatTime, genId,
} from './state.js';
import { DEFAULT_CHEST_ITEMS } from './gacha.js';
import {
  renderAll, renderPity, renderGachaStats, renderChestStats,
  renderItemPreview, renderItemList, renderCharList, renderCharPreview,
  renderChestTypeTabs, renderFeaturedChar,
} from './render.js';

// ═══ 结果动画 ═══

export function showResults(els, results, mode) {
  els.resultCards.innerHTML = '';
  els.resultModal.classList.add('show');
  const maxRarity = Math.max(...results.map(r => r.rarity));
  if (maxRarity >= Rarity.FOUR) triggerRarityFlash(maxRarity);
  if (maxRarity === Rarity.FIVE) setTimeout(() => triggerParticles(), 300);

  results.forEach((r, idx) => {
    const char = mode === 'gacha' ? r.character : r.item;
    const meta = RARITY_META[r.rarity];
    const icon = mode === 'gacha' ? r.character.icon : (RARITY_META[r.rarity]?.icon || '⭐');
    const name = mode === 'gacha' ? r.character.name : r.item.name;

    const card = document.createElement('div');
    card.className = 'result-card';
    card.dataset.rarity = r.rarity;
    card.style.animationDelay = (idx * 0.08) + 's';
    card.innerHTML = `<div class="result-card-face card-back"><span class="card-back-pattern">✦</span></div>
      <div class="result-card-face card-front">
        <span class="card-icon">${icon}</span>
        <span class="card-stars">${meta.stars}</span>
        <span class="card-name">${name}</span>
      </div>`;
    els.resultCards.appendChild(card);
    setTimeout(() => card.classList.add('flipped'), 300 + idx * 100);
  });
  els.resultCards.style.gap = results.length > 1 ? '6px' : '0';
}

export function triggerRarityFlash(rarity) {
  const flash = document.createElement('div');
  flash.className = 'rarity-flash';
  flash.dataset.rarity = rarity;
  document.body.appendChild(flash);
  requestAnimationFrame(() => flash.classList.add('show'));
  setTimeout(() => flash.remove(), 900);
}

export function triggerParticles() {
  const burst = document.createElement('div');
  burst.className = 'particle-burst';
  burst.style.left = '50%'; burst.style.top = '50%';
  document.body.appendChild(burst);
  const colors = ['#ffd700', '#ffed4e', '#fbbf24', '#a855f7', '#ffffff'];
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.3;
    const dist = 80 + Math.random() * 120;
    p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.width = p.style.height = (4 + Math.random() * 6) + 'px';
    p.style.animationDuration = (0.6 + Math.random() * 0.6) + 's';
    burst.appendChild(p);
  }
  setTimeout(() => burst.remove(), 1500);
}

export function closeResultModal(els) {
  els.resultModal.classList.remove('show');
  els.resultCards.innerHTML = '';
}

// ═══ 列表结果展示 ═══

export function showListResults(els, results, mode) {
  const isGacha = mode === 'gacha';
  const groups = {};
  results.forEach(r => {
    const name = isGacha ? r.character.name : r.item.name;
    const key = r.rarity + ':' + name;
    groups[key] = groups[key] || { name, rarity: r.rarity, icon: isGacha ? r.character.icon : (RARITY_META[r.rarity]?.icon || '⭐'), count: 0 };
    groups[key].count++;
  });
  const sorted = Object.values(groups).sort((a, b) => b.rarity !== a.rarity ? b.rarity - a.rarity : b.count - a.count);
  const five = results.filter(r => r.rarity === Rarity.FIVE).length;
  const four = results.filter(r => r.rarity === Rarity.FOUR).length;
  const three = results.filter(r => r.rarity === Rarity.THREE).length;

  if (five > 0) { triggerRarityFlash(Rarity.FIVE); setTimeout(() => triggerParticles(), 200); }
  else if (four > 0) triggerRarityFlash(Rarity.FOUR);

  els.listResultTitle.textContent = (isGacha ? '祈愿' : '宝箱') + '结果 × ' + results.length;
  const sp = [];
  if (five > 0) sp.push(`<span class="list-summary-item rarity-5">五星 ${five}</span>`);
  if (four > 0) sp.push(`<span class="list-summary-item rarity-4">四星 ${four}</span>`);
  if (three > 0) sp.push(`<span class="list-summary-item rarity-3">三星 ${three}</span>`);
  els.listSummary.innerHTML = sp.join('') || '<span>无</span>';

  els.listItems.innerHTML = '';
  sorted.forEach((item, idx) => {
    const meta = RARITY_META[item.rarity];
    const row = document.createElement('div');
    row.className = 'list-item rarity-' + item.rarity;
    row.style.animationDelay = Math.min(idx * 0.015, 0.6) + 's';
    row.innerHTML = `<span class="list-item-rank">${idx + 1}</span>
      <span class="list-item-icon">${item.icon}</span>
      <div class="list-item-info"><span class="list-item-name">${item.name}</span><span class="list-item-stars">${meta.stars}</span></div>
      <span class="list-item-count">×${item.count}</span>`;
    els.listItems.appendChild(row);
  });
  els.listResultModal.classList.add('show');
}

// ═══ 历史 / 统计 ═══

export function showHistory(els) {
  if (!state.history.length) { els.historyList.innerHTML = '<div class="empty-state">暂无抽取记录</div>'; }
  else {
    els.historyList.innerHTML = state.history.slice(0, 100).map(h => {
      const meta = RARITY_META[h.rarity];
      return `<div class="history-entry"><span class="history-rarity-dot" data-rarity="${h.rarity}"></span>
        <span style="font-size:1.2rem">${h.icon}</span><span class="history-name">${h.name}</span>
        <span class="history-stars" style="color:${meta?.color || '#888'}">${meta?.stars || ''}</span>
        <span class="history-time">${formatTime(h.time)}</span></div>`;
    }).join('');
  }
  els.historyModal.classList.add('show');
}

export function showStats(els) {
  const g = state.stats.gacha, c = getCurrentChestStats();
  const tg = g.total, tc = c.total || 0;
  const r5r = tg > 0 ? ((g.r5 / tg) * 100).toFixed(4) : '0.0000';
  const r4r = tg > 0 ? ((g.r4 / tg) * 100).toFixed(4) : '0.0000';
  const c5r = tc > 0 ? ((c.r5 / tc) * 100).toFixed(4) : '0.0000';
  const c4r = tc > 0 ? ((c.r4 / tc) * 100).toFixed(4) : '0.0000';
  const c3r = tc > 0 ? ((c.r3 / tc) * 100).toFixed(2) : '0.00';

  els.statsDetail.innerHTML = `
    <div class="stats-section-title">🌟 祈愿统计</div>
    <div class="stats-row"><span class="stats-label">总抽数</span><span class="stats-value">${tg}</span></div>
    <div class="stats-row"><span class="stats-label" style="color:var(--gold)">五星出货数 / 出货率</span><span class="stats-value" style="color:var(--gold)">${g.r5} / ${r5r}%</span></div>
    <div class="stats-row"><span class="stats-label" style="color:var(--purple)">四星出货数 / 出货率</span><span class="stats-value" style="color:var(--purple)">${g.r4} / ${r4r}%</span></div>
    <div class="stats-row"><span class="stats-label" style="color:var(--blue)">三星出货数</span><span class="stats-value" style="color:var(--blue)">${g.r3}</span></div>
    <div class="stats-row"><span class="stats-label">当前五星保底</span><span class="stats-value">${state.config.pityEnabled ? gachaEngine.pity5 + '/' + state.config.pity5Hard : '已关闭'}</span></div>
    <div class="stats-row"><span class="stats-label">当前四星保底</span><span class="stats-value">${state.config.pityEnabled ? gachaEngine.pity4 + '/10' : '已关闭'}</span></div>
    <div style="height:16px"></div>
    <div class="stats-section-title">🎁 当前宝箱: ${state.chestTypes[state.currentChestId]?.name || '—'}</div>
    <div class="stats-row"><span class="stats-label">总开箱数</span><span class="stats-value">${tc}</span></div>
    ${tc > 0 ? `
    <div class="stats-row"><span class="stats-label" style="color:var(--gold)">五星 / 占比</span><span class="stats-value" style="color:var(--gold)">${c.r5} / ${c5r}%</span></div>
    <div class="stats-row"><span class="stats-label" style="color:var(--purple)">四星 / 占比</span><span class="stats-value" style="color:var(--purple)">${c.r4} / ${c4r}%</span></div>
    <div class="stats-row"><span class="stats-label" style="color:var(--blue)">三星 / 占比</span><span class="stats-value" style="color:var(--blue)">${c.r3} / ${c3r}%</span></div>` : ''}
    <div style="height:12px"></div>
    <div class="stats-section-title">📦 所有宝箱汇总</div>
    ${Object.entries(state.stats.chest).map(([id, s]) => {
      const tn = state.chestTypes[id]?.name || id;
      return `<div class="stats-row"><span class="stats-label">${tn}</span><span class="stats-value">${s.total || 0} 次</span></div>`;
    }).join('')}
    <div class="stats-row"><span class="stats-label">保底机制</span><span class="stats-value">${state.config.pityEnabled ? '已开启' : '已关闭'}</span></div>`;
  els.statsModal.classList.add('show');
}

// ═══ 物品编辑 ═══

let selectedItemRarity = 5, editingItemId = null;

export { selectedItemRarity };
export function setSelectedItemRarity(r) { selectedItemRarity = r; }

// ═══ 物品编辑锁 ═══
function isChestLocked() {
  return state.chestTypes[state.currentChestId]?.locked === true;
}

function chestLockAlert() {
  alert('🔒 标准宝箱为预设宝箱，不可编辑。请切换到其他宝箱后编辑。');
}

export function openItemModal(els, itemId) {
  if (isChestLocked()) { chestLockAlert(); return; }
  editingItemId = itemId;
  if (itemId) {
    const item = chestEngine.items.find(i => i.id === itemId);
    if (!item) return;
    els.itemModalTitle.textContent = '编辑物品';
    els.itemName.value = item.name;
    els.itemWeight.value = item.weight;
    selectedItemRarity = item.rarity;
  } else {
    els.itemModalTitle.textContent = '添加物品';
    els.itemName.value = '';
    els.itemWeight.value = 10;
    selectedItemRarity = 5;
  }
  els.raritySelect.querySelectorAll('.rarity-opt').forEach(btn =>
    btn.classList.toggle('active', parseInt(btn.dataset.rarity) === selectedItemRarity));
  els.itemModal.classList.add('show');
}

export function saveItem(els) {
  if (isChestLocked()) { chestLockAlert(); return; }
  const name = els.itemName.value.trim();
  const weight = parseFloat(els.itemWeight.value);
  if (!name) { els.itemName.classList.add('shake'); setTimeout(() => els.itemName.classList.remove('shake'), 400); return; }
  if (isNaN(weight) || weight <= 0) { els.itemWeight.classList.add('shake'); setTimeout(() => els.itemWeight.classList.remove('shake'), 400); return; }
  // 从当前激活的稀有度按钮读取（避免 selectedItemRarity 不同步）
  const activeBtn = els.raritySelect.querySelector('.rarity-opt.active');
  const rarity = activeBtn ? parseInt(activeBtn.dataset.rarity) : selectedItemRarity;
  if (editingItemId) chestEngine.updateItem(editingItemId, { name, weight, rarity });
  else chestEngine.addItem({ name, weight, rarity });
  state.chestTypes[state.currentChestId].items = chestEngine.items;
  saveState();
  renderItemList(els);
  renderItemPreview(els);
  els.itemModal.classList.remove('show');
}

// ═══ 角色编辑 ═══

let editingCharRarity = 5;

export function openCharModal(els, rarity, idx) {
  const modal = document.getElementById('charModal');
  if (idx !== undefined) {
    const char = state.characters[rarity][idx];
    if (!char) return;
    document.getElementById('charModalTitle').textContent = '编辑角色';
    document.getElementById('charName').value = char.name;
    document.getElementById('charIcon').value = char.icon || '';
    document.getElementById('charElement').value = char.element || '';
    document.getElementById('charFeatured').checked = char.featured || false;
    editingCharRarity = rarity;
    modal.dataset.editIdx = idx;
  } else {
    document.getElementById('charModalTitle').textContent = '添加角色';
    document.getElementById('charName').value = '';
    document.getElementById('charIcon').value = '';
    document.getElementById('charElement').value = '';
    document.getElementById('charFeatured').checked = false;
    editingCharRarity = 5;
    delete modal.dataset.editIdx;
  }
  modal.querySelectorAll('.rarity-opt').forEach(btn =>
    btn.classList.toggle('active', parseInt(btn.dataset.rarity) === editingCharRarity));
  modal.classList.add('show');
}

export function saveChar(els) {
  const name = document.getElementById('charName').value.trim();
  if (!name) return;
  const modal = document.getElementById('charModal');
  const rarity = editingCharRarity;
  const char = { name, icon: document.getElementById('charIcon').value.trim(), element: document.getElementById('charElement').value.trim(), featured: document.getElementById('charFeatured').checked && rarity === Rarity.FIVE };
  if (!state.characters[rarity]) state.characters[rarity] = [];
  if (char.featured) state.characters[Rarity.FIVE].forEach(c => c.featured = false);
  if (modal.dataset.editIdx !== undefined) state.characters[rarity][parseInt(modal.dataset.editIdx)] = { ...state.characters[rarity][parseInt(modal.dataset.editIdx)], ...char };
  else state.characters[rarity].push(char);
  gachaEngine.characters = state.characters;
  saveState();
  renderCharList(els);
  renderCharPreview(els);
  renderFeaturedChar(els);
  modal.classList.remove('show');
}

export function deleteChar(els, rarity, idx) {
  state.characters[rarity].splice(idx, 1);
  gachaEngine.characters = state.characters;
  saveState();
  renderCharList(els);
  renderCharPreview(els);
  renderFeaturedChar(els);
}

// ═══ 概率说明文档 ═══
export function showGuide(els) {
  const w = state.config.rarityWeights || { 5: 6, 4: 51, 3: 943 };
  // 兼容旧版 rate5/rate4
  const r5 = state.config.rate5 !== undefined ? (state.config.rate5 * 100).toFixed(1) : ((w[5] / ((w[5] || 0) + (w[4] || 0) + (w[3] || 1))) * 100).toFixed(2);
  const r4 = state.config.rate4 !== undefined ? (state.config.rate4 * 100).toFixed(1) : ((w[4] / ((w[5] || 0) + (w[4] || 0) + (w[3] || 1))) * 100).toFixed(2);
  const r3 = (100 - parseFloat(r5) - parseFloat(r4)).toFixed(2);
  const hard = state.config.pity5Hard;
  const soft = state.config.pity5Soft;
  const softOn = soft < hard;

  document.getElementById('guideContent').innerHTML = `
<div class="guide-section">
  <h3>🌟 角色祈愿概率</h3>
  <p>每次抽取使用<strong>单次随机数</strong>分段判定：</p>
  <div class="guide-example">
    <code>roll ∈ [0, ${r5}%)     → 五星</code><br>
    <code>roll ∈ [${r5}%, ${(parseFloat(r5)+parseFloat(r4)).toFixed(1)}%) → 四星</code><br>
    <code>roll ∈ [${(parseFloat(r5)+parseFloat(r4)).toFixed(1)}%, 100%) → 三星</code>
  </div>

  <h4>📐 保底机制</h4>
  <table class="guide-table">
    <tr><td>硬保底</td><td>连续 ${hard} 抽未出五星 → 下一抽 100% 五星</td></tr>
    <tr><td>软保底</td><td>${softOn ? `从第 ${soft} 抽起，每抽概率 +6%，直至 ${hard} 抽达到 100%` : '当前关闭（软保底 ≥ 硬保底）'}</td></tr>
    <tr><td>四星保底</td><td>每 10 抽至少一个四星（含十连保底升级）</td></tr>
    <tr><td>50/50 机制</td><td>${state.config.fiftyFifty ? '首次五星 50% 为UP；非UP下次必UP' : '已关闭'}</td></tr>
  </table>

  <h4>🧮 示例</h4>
  <div class="guide-example">
    <p><strong>例1（正常出率）：</strong>roll = 0.03 (3%)，落在 [0.6%, 5.7%) → <span style="color:var(--purple)">出四星</span></p>
    <p><strong>例2（软保底）：</strong>已抽 ${soft} 抽，roll = 0.5 (50%)<br>
    &nbsp;&nbsp;当前五星概率 = ${r5}% + (${soft}抽) × 6% = ${(parseFloat(r5) + (softOn ? (soft ? 6 : 0) : 0)).toFixed(1)}%，落在 [${r5}%, ${(parseFloat(r5)+parseFloat(r4)).toFixed(1)}%) → <span style="color:var(--purple)">四星</span></p>
    <p><strong>例3（硬保底）：</strong>已抽 ${hard-1} 抽未出 → 概率 = 100% → <span style="color:var(--gold)">必出五星</span></p>
  </div>
</div>

<div class="guide-section">
  <h3>🎁 宝箱概率</h3>
  <p>使用<strong>加权随机</strong>：每个物品的权重 ÷ 总权重 = 掉落概率。</p>

  <h4>🧮 示例（以"标准宝箱"预设为例）</h4>
  <div class="guide-example">
    <p>物品：钻石(w:1) 金锭(w:5) 银币(w:8) 铁矿(w:25) 木头(w:35) 石头(w:26)</p>
    <p>总权重 = 100，roll = Math.random() × 100</p>
    <p><strong>例1：</strong>roll = 0.5 → 累计到达钻石(1) → <span style="color:var(--gold)">出钻石</span> （概率 1%）</p>
    <p><strong>例2：</strong>roll = 50 → 累计: 1+5+8+25+35=74 未到，含石头 74+26=100 → <span style="color:var(--blue)">出石头</span> （概率 26%）</p>
    <p><strong>例3：</strong>roll = 8 → 累计: 1+5+8=14 → <span style="color:var(--purple)">出银币</span> （概率 8%）</p>
  </div>

  <h4>📊 期望值参考</h4>
  <table class="guide-table">
    <tr><td>钻石(★5)</td><td>约每 100 箱出 1 个（1%）</td></tr>
    <tr><td>金锭+银币(★4)</td><td>约每 100 箱出 13 个（13%）</td></tr>
    <tr><td>铁矿+木头+石头(★3)</td><td>约每 100 箱出 86 个（86%）</td></tr>
  </table>
</div>

<div class="guide-section">
  <h3>📊 期望值参考</h3>
  <table class="guide-table">
    <tr><td>祈愿五星</td><td>约 1 / ${(parseFloat(r5)/100)} ≈ 每 ${Math.round(100/parseFloat(r5))} 抽出一个</td></tr>
    <tr><td>祈愿四星</td><td>约 1 / ${(parseFloat(r4)/100)} ≈ 每 ${Math.round(100/parseFloat(r4))} 抽出一个</td></tr>
    <tr><td>含保底综合五星</td><td>约 1.6%（原神实测数据）</td></tr>
  </table>
</div>
  `;
  document.getElementById('guideModal').classList.add('show');
}

export function addChestType() {
  document.getElementById('chestTypeName').value = '';
  document.getElementById('chestTypeModal').classList.add('show');
  document.getElementById('chestTypeName').focus();
}

export { chestEngine };
