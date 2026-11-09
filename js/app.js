(function () {
  "use strict";

  const DATA = window.UPGRADER_DATA || { catalog: [], seeds: [] };
  const STORAGE_KEY = "redup-local-v1";
  const START_BALANCE = 1000;
  const FREE_SKIN_MAX_PRICE = 3000;
  const FREE_SKIN_COUNT = 3;
  const FREE_GRANTS_TOTAL = 3;
  const SEGMENTS = 24;
  const SPIN_MS = 8000;
  const MARKET_TICK_MS = 5000;
  const MARKET_MIN_FACTOR = 0.4;
  const MARKET_MAX_FACTOR = 3;
  const MARKET_CHANGE_CHANCE = 0.88;
  const MARKET_MIN_PCT = -0.055;
  const MARKET_MAX_PCT = 0.065;

  const ITEMS = new Map();
  DATA.catalog.forEach((it) => ITEMS.set(it.id, it));
  DATA.seeds.forEach((it) => ITEMS.set(it.id, it));
  const CATALOG = DATA.catalog.slice();

  const $ = (sel, root) => (root || document).querySelector(sel);

  const el = {
    headerBalance: $("#headerBalance"),
    selectedItems: $("#selectedItems"),
    balanceUseLabel: $("#balanceUseLabel"),
    balanceRange: $("#balanceRange"),
    quickRow: $("#quickRow"),
    selectedTotal: $("#selectedTotal"),
    wheel: $("#wheel"),
    wheelRing: $("#wheelRing"),
    wheelLogo: $("#wheelLogo"),
    wheelItem: $("#wheelItem"),
    chanceValue: $("#chanceValue"),
    upgradeBtn: $("#upgradeBtn"),
    wheelNote: $("#wheelNote"),
    targetSlot: $("#targetSlot"),
    inventoryGrid: $("#inventoryGrid"),
    invCount: $("#invCount"),
    catalogGrid: $("#catalogGrid"),
    catalogCount: $("#catalogCount"),
    searchInput: $("#searchInput"),
    sortSelect: $("#sortSelect"),
    resetBtn: $("#resetBtn"),
    resetInvBtn: $("#resetInvBtn"),
    resultModal: $("#resultModal"),
    resultCard: $("#resultCard"),
    resultTitle: $("#resultTitle"),
    resultImage: $("#resultImage"),
    resultName: $("#resultName"),
    resultSub: $("#resultSub"),
    resultClose: $("#resultClose"),
    resultMarket: $("#resultMarket"),
    resultReset: $("#resultReset"),
    freeSkinsBtnModal: $("#freeSkinsBtnModal"),
    statsLine: $("#statsLine"),
    upgradeView: $("#upgradeView"),
    marketView: $("#marketView"),
    marketBalance: $("#marketBalance"),
    freeGrantsLabel: $("#freeGrantsLabel"),
    marketTicker: $("#marketTicker"),
    marketOwnedGrid: $("#marketOwnedGrid"),
    marketOwnedCount: $("#marketOwnedCount"),
    marketGrid: $("#marketGrid"),
    marketCount: $("#marketCount"),
    marketSearchInput: $("#marketSearchInput"),
    marketSortSelect: $("#marketSortSelect"),
    toastStack: $("#toastStack"),
  };

  const moneyFmt = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const money0Fmt = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  });

  const money = (v) => moneyFmt.format(Number(v) || 0).replace(/\u00A0/g, " ");
  const money0 = (v) => money0Fmt.format(Number(v) || 0).replace(/\u00A0/g, " ");

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function hexToRgba(hex, alpha) {
    const h = String(hex || "#b0c3d9").replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function uid(prefix) {
    return `${prefix || "i"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }


  function bump(node) {
    if (!node) return;
    node.classList.remove("bump");
    void node.offsetWidth;
    node.classList.add("bump");
    setTimeout(() => node.classList.remove("bump"), 430);
  }

  function toast(message, type) {
    if (!el.toastStack) return;
    const node = document.createElement("div");
    node.className = `toast ${type || "info"}`;
    node.textContent = message;
    el.toastStack.appendChild(node);
    setTimeout(() => {
      node.classList.add("out");
      setTimeout(() => node.remove(), 320);
    }, 3000);
  }

  function addRipple(event, button) {
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const hasPointer = event && (event.clientX || event.clientY);
    const x = hasPointer ? event.clientX - rect.left : rect.width / 2;
    const y = hasPointer ? event.clientY - rect.top : rect.height / 2;
    const span = document.createElement("span");
    span.className = "ripple";
    span.style.width = span.style.height = `${size}px`;
    span.style.left = `${x - size / 2}px`;
    span.style.top = `${y - size / 2}px`;
    button.appendChild(span);
    setTimeout(() => span.remove(), 620);
  }

  function flashPrice(node, pct) {
    if (!node || !Number.isFinite(pct) || Math.abs(pct) < 0.02) return;
    const cls = pct > 0 ? "flash-up" : "flash-down";
    node.classList.remove("flash-up", "flash-down");
    void node.offsetWidth;
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), 760);
  }

  function flashChange(node, pct) {
    if (!node || !Number.isFinite(pct) || Math.abs(pct) < 0.05) return;
    const cls = pct > 0 ? "flash-up" : "flash-down";
    node.classList.remove("flash-up", "flash-down");
    void node.offsetWidth;
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), 760);
  }

  function basePrices() {
    const prices = {};
    ITEMS.forEach((item, id) => {
      prices[id] = Number(item.price) || 0;
    });
    return prices;
  }

  function freeSkinPool() {
    const cheap = DATA.seeds.filter((it) => it.price <= FREE_SKIN_MAX_PRICE);
    if (cheap.length) return cheap;
    return DATA.catalog.slice().sort((a, b) => a.price - b.price).slice(0, FREE_SKIN_COUNT);
  }

  function pickRandomItems(pool, count) {
    const copy = pool.slice();
    const picked = [];
    while (picked.length < count && copy.length) {
      picked.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return picked;
  }

  function makeInitialState() {
    const starters = pickRandomItems(freeSkinPool(), FREE_SKIN_COUNT);
    return {
      balance: START_BALANCE,
      inventory: starters.map((it, index) => ({
        uid: `seed-${index}-${Math.random().toString(36).slice(2, 7)}`,
        itemId: it.id,
      })),
      selected: [],
      targetId: null,
      balanceUse: 0,
      wins: 0,
      attempts: 0,
      freeGrantsLeft: FREE_GRANTS_TOTAL,
      prices: basePrices(),
      prevPrices: basePrices(),
    };
  }

  function normalizePrices(raw, fallback) {
    const prices = { ...fallback };
    if (!raw || typeof raw !== "object") return prices;
    ITEMS.forEach((item, id) => {
      const base = Number(item.price) || 0;
      const p = Number(raw[id]);
      if (Number.isFinite(p) && p > 0) {
        prices[id] = clamp(p, base * MARKET_MIN_FACTOR, base * MARKET_MAX_FACTOR);
      }
    });
    return prices;
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.inventory)) return null;
    const base = basePrices();
    const prices = normalizePrices(raw.prices, base);
    const prevPrices = normalizePrices(raw.prevPrices, prices);
    const fg = raw.freeGrantsLeft == null ? FREE_GRANTS_TOTAL : Math.round(Number(raw.freeGrantsLeft));
    const state = {
      balance: Math.max(0, Number(raw.balance) || 0),
      inventory: raw.inventory
        .filter((x) => x && ITEMS.has(x.itemId))
        .map((x) => ({ uid: String(x.uid || uid("inv")), itemId: x.itemId })),
      selected: Array.isArray(raw.selected) ? raw.selected.map(String) : [],
      targetId: raw.targetId && ITEMS.has(raw.targetId) ? raw.targetId : null,
      balanceUse: Math.max(0, Math.round(Number(raw.balanceUse) || 0)),
      wins: Math.max(0, Math.round(Number(raw.wins) || 0)),
      attempts: Math.max(0, Math.round(Number(raw.attempts) || 0)),
      freeGrantsLeft: Number.isFinite(fg) ? clamp(fg, 0, FREE_GRANTS_TOTAL) : FREE_GRANTS_TOTAL,
      prices,
      prevPrices,
    };
    const uids = new Set(state.inventory.map((x) => x.uid));
    state.selected = state.selected.filter((x) => uids.has(x));
    state.balanceUse = Math.min(state.balanceUse, state.balance);
    return state;
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return normalizeState(parsed) || makeInitialState();
    } catch (e) {
      return makeInitialState();
    }
  }

  let state = loadState();
  let spinning = false;
  let wheelRotation = 0;
  let winSegments = 0;
  let lastWinSegments = -1;
  let lastChanceText = "";
  let lastEmptyMode = "";
  let catalogQuery = "";
  let catalogSort = "price-asc";
  let marketQuery = "";
  let marketSort = "price-asc";

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* local-only fallback: ignore quota errors */
    }
  }

  function getItem(itemId) {
    return ITEMS.get(itemId) || null;
  }

  function priceOf(itemOrId) {
    const item = typeof itemOrId === "string" ? ITEMS.get(itemOrId) : itemOrId;
    if (!item) return 0;
    const p = state && state.prices ? state.prices[item.id] : null;
    const base = Number(item.price) || 0;
    return Number.isFinite(p) && p > 0 ? p : base;
  }

  function prevPriceOf(item) {
    if (!item) return 0;
    const p = state && state.prevPrices ? state.prevPrices[item.id] : null;
    return Number.isFinite(p) && p > 0 ? p : priceOf(item);
  }

  function changePct(item) {
    const current = priceOf(item);
    const prev = prevPriceOf(item);
    return prev > 0 ? ((current - prev) / prev) * 100 : 0;
  }

  function cheapestMarketItem() {
    let best = null;
    let bestPrice = Infinity;
    for (const item of CATALOG) {
      const p = priceOf(item);
      if (p > 0 && p < bestPrice) {
        best = item;
        bestPrice = p;
      }
    }
    return best;
  }

  function cheapestPrice() {
    const item = cheapestMarketItem();
    return item ? priceOf(item) : 0;
  }

  function canAffordCheapest() {
    return state.balance + 0.001 >= cheapestPrice();
  }

  function emptyActionMode() {
    if (getInventoryItems().length) return "none";
    if (canAffordCheapest()) return "market";
    if (state.freeGrantsLeft > 0) return "free";
    return "reset";
  }

  function getInventoryItems() {
    return state.inventory.map((inst) => ({ inst, item: getItem(inst.itemId) })).filter((x) => x.item);
  }

  function getTarget() {
    return state.targetId ? getItem(state.targetId) : null;
  }

  function getSelectedValue() {
    return getInventoryItems()
      .filter(({ inst }) => state.selected.includes(inst.uid))
      .reduce((sum, { item }) => sum + priceOf(item), 0);
  }

  function getMaxBalanceUse() {
    const target = getTarget();
    if (!target) return state.balance;
    return Math.min(state.balance, Math.floor(priceOf(target)));
  }

  function getTotals() {
    const target = getTarget();
    const selectedValue = getSelectedValue();
    const total = selectedValue + state.balanceUse;
    let chance = 0;
    if (target && priceOf(target) > 0 && total > 0) {
      chance = Math.min(100, (total / priceOf(target)) * 100);
    }
    return { target, selectedValue, total, chance };
  }

  function formatChance(chance) {
    if (chance >= 99.999) return "100%";
    if (chance <= 0) return "0%";
    if (chance < 10) return chance.toFixed(1) + "%";
    if (chance > 99) return Math.min(99.9, Math.floor(chance * 10) / 10).toFixed(1) + "%";
    return Math.round(chance) + "%";
  }

  function itemCard(item, opts) {
    const o = opts || {};
    const selected = !!o.selected;
    const attr = o.mode === "catalog" ? `data-id="${esc(item.id)}"` : `data-uid="${esc(o.uid)}"`;
    return (
      `<button type="button" class="item-card${selected ? " selected" : ""}" ${attr}` +
      ` style="--rarity:${esc(item.color)};--rarity-soft:${hexToRgba(item.color, 0.38)}">` +
      `<span class="check">✓</span>` +
      `<span class="price">${esc(money(priceOf(item)))}<img src="assets/ui/coins.svg" alt=""></span>` +
      `<img class="card-img" src="${esc(item.image)}" alt="${esc(item.marketName)}" loading="lazy"` +
      ` onerror="this.onerror=null;this.src='assets/ui/light-gray-logo-padded.png'">` +
      `<span class="card-info">` +
      `<span class="card-type">${esc(item.type)}</span>` +
      `<span class="card-name">${esc(item.name)}</span>` +
      `<span class="card-wear">${esc(item.wear)}</span>` +
      `</span></button>`
    );
  }

  function marketCard(item) {
    const pct = changePct(item);
    const price = priceOf(item);
    const can = state.balance + 0.001 >= price;
    return (
      `<article class="market-card" data-id="${esc(item.id)}"` +
      ` style="--rarity:${esc(item.color)};--rarity-soft:${hexToRgba(item.color, 0.38)}" title="${esc(item.marketName)}">` +
      `<div class="market-card-head">` +
      `<span class="market-change ${changeClass(pct)}">${changeLabel(pct)}</span>` +
      `<span class="market-price">${esc(money(price))} <img src="assets/ui/coins.svg" alt=""></span>` +
      `</div>` +
      `<div class="market-imgwrap"><img class="market-img" src="${esc(item.image)}" alt="${esc(item.marketName)}" loading="lazy"` +
      ` onerror="this.onerror=null;this.src='assets/ui/light-gray-logo-padded.png'"></div>` +
      `<div class="market-name">${esc(item.name)}</div>` +
      `<div class="market-meta">${esc(item.type)} · ${esc(item.wear)}</div>` +
      `<button type="button" class="market-buy" data-buy="${esc(item.id)}"${can ? "" : " disabled"}>Купить</button>` +
      `</article>`
    );
  }

  function ownedCard(item, itemUid) {
    const pct = changePct(item);
    const price = priceOf(item);
    return (
      `<article class="market-card" data-id="${esc(item.id)}" data-uid="${esc(itemUid)}"` +
      ` style="--rarity:${esc(item.color)};--rarity-soft:${hexToRgba(item.color, 0.38)}" title="${esc(item.marketName)}">` +
      `<div class="market-card-head">` +
      `<span class="market-change ${changeClass(pct)}">${changeLabel(pct)}</span>` +
      `<span class="market-price">${esc(money(price))} <img src="assets/ui/coins.svg" alt=""></span>` +
      `</div>` +
      `<div class="market-imgwrap"><img class="market-img" src="${esc(item.image)}" alt="${esc(item.marketName)}" loading="lazy"` +
      ` onerror="this.onerror=null;this.src='assets/ui/light-gray-logo-padded.png'"></div>` +
      `<div class="market-name">${esc(item.name)}</div>` +
      `<div class="market-meta">${esc(item.type)} · ${esc(item.wear)}</div>` +
      `<button type="button" class="market-sell" data-sell="${esc(itemUid)}">Продать за ${esc(money(price))}</button>` +
      `</article>`
    );
  }

  function renderHeader() {
    if (el.headerBalance) el.headerBalance.textContent = money0(state.balance);
    if (el.marketBalance) el.marketBalance.textContent = money0(state.balance);
    if (el.freeGrantsLabel) {
      el.freeGrantsLabel.textContent = `${state.freeGrantsLeft} / ${FREE_GRANTS_TOTAL}`;
      el.freeGrantsLabel.classList.toggle("empty", state.freeGrantsLeft <= 0);
    }
    if (el.statsLine) {
      el.statsLine.textContent = state.attempts
        ? ` · побед ${state.wins} из ${state.attempts}`
        : "";
    }
  }

  let renderedChips = new Set();
  let renderedTargetId = null;

  function renderSelected() {
    if (!el.selectedItems) return;
    const selected = getInventoryItems().filter(({ inst }) => state.selected.includes(inst.uid));
    if (!selected.length) {
      renderedChips = new Set();
      el.selectedItems.innerHTML =
        `<div class="slot-empty">` +
        `<img src="assets/ui/light-gray-logo-padded.png" alt="">` +
        `<span>Выберите скины из инвентаря</span>` +
        `</div>`;
      return;
    }
    const prevChips = renderedChips;
    renderedChips = new Set(selected.map(({ inst }) => inst.uid));
    el.selectedItems.innerHTML = selected
      .map(({ inst, item }) => {
        return (
          `<div class="selected-chip${prevChips.has(inst.uid) ? "" : " new"}" data-uid="${esc(inst.uid)}">` +
          `<img src="${esc(item.image)}" alt="" onerror="this.onerror=null;this.src='assets/ui/light-gray-logo-padded.png'">` +
          `<div class="chip-info">` +
          `<span class="chip-name">${esc(item.name)}</span>` +
          `<span class="chip-price">${esc(money(priceOf(item)))} <img src="assets/ui/coins.svg" alt=""></span>` +
          `</div>` +
          `<button class="chip-remove" type="button" data-remove="${esc(inst.uid)}" aria-label="Убрать">×</button>` +
          `</div>`
        );
      })
      .join("");
  }

  function renderBalance() {
    const target = getTarget();
    const max = getMaxBalanceUse();
    state.balanceUse = clamp(state.balanceUse, 0, max);
    if (el.balanceUseLabel) el.balanceUseLabel.textContent = money0(state.balanceUse);
    if (el.balanceRange) {
      el.balanceRange.max = String(Math.max(0, Math.floor(max)));
      el.balanceRange.step = max >= 100 ? "10" : "1";
      el.balanceRange.value = String(state.balanceUse);
      el.balanceRange.disabled = spinning || !target || max <= 0;
      const pct = max > 0 ? (state.balanceUse / max) * 100 : 0;
      el.balanceRange.style.setProperty("--p", `${pct}%`);
    }
    if (el.quickRow) {
      el.quickRow.querySelectorAll("button").forEach((btn) => {
        btn.disabled = spinning || !target || max <= 0;
      });
    }
    if (el.selectedTotal) {
      el.selectedTotal.textContent = money(getTotals().total);
    }
  }

  function renderTarget() {
    if (!el.targetSlot) return;
    const target = getTarget();
    if (!target) {
      renderedTargetId = null;
      el.targetSlot.innerHTML =
        `<div class="target-empty">` +
        `<img src="assets/ui/light-gray-logo-padded.png" alt="">` +
        `<span>Выберите цель из каталога ниже</span>` +
        `</div>`;
      return;
    }
    const { chance } = getTotals();
    const isNewTarget = renderedTargetId !== target.id;
    renderedTargetId = target.id;
    el.targetSlot.innerHTML =
      `<div class="target-card${isNewTarget ? " new" : ""}" style="--rarity:${esc(target.color)};--rarity-soft:${hexToRgba(target.color, 0.38)}">` +
      `<img class="target-img" src="${esc(target.image)}" alt="${esc(target.marketName)}"` +
      ` onerror="this.onerror=null;this.src='assets/ui/light-gray-logo-padded.png'">` +
      `<div class="target-type">${esc(target.type)}</div>` +
      `<div class="target-name">${esc(target.name)}</div>` +
      `<div class="target-wear">${esc(target.wear)}</div>` +
      `<div class="target-price">${esc(money(priceOf(target)))} <img src="assets/ui/coins.svg" alt=""></div>` +
      `<div class="target-hint"><span>Шанс успеха</span><b>${esc(formatChance(chance))}</b></div>` +
      `</div>`;
  }

  function updateTargetCard() {
    const target = getTarget();
    if (!target) {
      renderTarget();
      return;
    }
    const priceNode = $(".target-price", el.targetSlot);
    const hintNode = $(".target-hint b", el.targetSlot);
    if (priceNode) {
      flashPrice(priceNode, changePct(target));
      priceNode.innerHTML = `${esc(money(priceOf(target)))} <img src="assets/ui/coins.svg" alt="">`;
    }
    if (hintNode) hintNode.textContent = formatChance(getTotals().chance);
  }

  function wheelPolar(cx, cy, r, angle) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  function renderWheelRing() {
    if (!el.wheelRing) return;
    const seg = 360 / SEGMENTS;
    let paths = "";
    for (let i = 0; i < SEGMENTS; i++) {
      const start = i * seg + 1.4;
      const end = (i + 1) * seg - 1.4;
      const o1 = wheelPolar(50, 50, 48, start);
      const o2 = wheelPolar(50, 50, 48, end);
      const i2 = wheelPolar(50, 50, 34, end);
      const i1 = wheelPolar(50, 50, 34, start);
      const win = i < winSegments;
      const fill = win ? (i % 2 ? "#ff6b6b" : "#ff3b3b") : i % 2 ? "#24252b" : "#1d1e22";
      paths +=
        `<path d="M ${o1[0].toFixed(2)} ${o1[1].toFixed(2)} ` +
        `A 48 48 0 0 1 ${o2[0].toFixed(2)} ${o2[1].toFixed(2)} ` +
        `L ${i2[0].toFixed(2)} ${i2[1].toFixed(2)} ` +
        `A 34 34 0 0 0 ${i1[0].toFixed(2)} ${i1[1].toFixed(2)} Z" ` +
        `fill="${fill}" stroke="#101114" stroke-width="0.8"></path>`;
    }
    el.wheelRing.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${paths}</svg>`;
  }

  function renderWheel() {
    const { target, total, chance } = getTotals();
    const nextSegments = wheelWinCount(chance);
    const changed = nextSegments !== winSegments;
    winSegments = nextSegments;
    if (changed || !el.wheelRing || !el.wheelRing.firstChild) renderWheelRing();

    if (el.wheelLogo) el.wheelLogo.hidden = !!target;
    if (el.wheelItem) {
      el.wheelItem.hidden = !target;
      if (target) {
        if (el.wheelItem.getAttribute("src") !== target.image) el.wheelItem.src = target.image;
        el.wheelItem.alt = target.marketName;
      }
    }
    if (el.chanceValue) {
      const text = formatChance(chance);
      if (lastChanceText && lastChanceText !== text) bump(el.chanceValue.parentElement);
      el.chanceValue.textContent = text;
      lastChanceText = text;
    }
    if (el.upgradeBtn) {
      el.upgradeBtn.disabled = spinning || !target || total <= 0 || chance <= 0;
    }
    if (el.wheelNote) {
      let note = "Выберите предмет и цель";
      if (target && total <= 0) note = "Добавьте скин или баланс";
      else if (target) note = `Шанс успеха ${formatChance(chance)}`;
      else if (state.selected.length) note = "Теперь выберите цель справа";
      el.wheelNote.textContent = note;
      el.wheelNote.classList.toggle("warn", !!target && chance > 0 && chance < 10);
    }
  }

  function renderInventory() {
    if (!el.inventoryGrid) return;
    const entries = getInventoryItems();
    if (el.invCount) el.invCount.textContent = String(entries.length);
    if (!entries.length) {
      const mode = emptyActionMode();
      let action = "";
      if (mode === "free") {
        action = `<button type="button" data-action="free">Получить 3 скина</button>`;
      } else if (mode === "market") {
        action = `<button type="button" data-action="market">Купить в маркете</button>`;
      } else if (mode === "reset") {
        action = `<button type="button" data-action="reset">Начать сначала</button>`;
      }
      el.inventoryGrid.innerHTML =
        `<div class="empty-state">` +
        `<img src="assets/ui/light-gray-logo-padded.png" alt="">` +
        `<span>Инвентарь пуст</span>` +
        `<span>${mode === "free" ? "Можно получить бесплатный набор" : mode === "market" ? "Хватит на самый дешёвый скин" : "Скинов и монет больше нет"}</span>` +
        action +
        `</div>`;
      return;
    }
    const invScroll = el.inventoryGrid.scrollTop;
    el.inventoryGrid.innerHTML = entries
      .map(({ inst, item }) =>
        itemCard(item, {
          mode: "inventory",
          uid: inst.uid,
          selected: state.selected.includes(inst.uid),
        })
      )
      .join("");
    el.inventoryGrid.scrollTop = invScroll;
  }

  function filteredCatalog() {
    const q = catalogQuery.trim().toLowerCase();
    let list = CATALOG.filter((item) => {
      if (!q) return true;
      return `${item.marketName} ${item.name} ${item.type} ${item.wear}`.toLowerCase().includes(q);
    });
    if (catalogSort === "price-desc") {
      list = list.slice().sort((a, b) => priceOf(b) - priceOf(a));
    } else if (catalogSort === "name-asc") {
      list = list.slice().sort((a, b) => a.marketName.localeCompare(b.marketName, "ru"));
    } else {
      list = list.slice().sort((a, b) => priceOf(a) - priceOf(b));
    }
    return list;
  }

  function renderCatalog() {
    if (!el.catalogGrid) return;
    const list = filteredCatalog();
    if (el.catalogCount) el.catalogCount.textContent = String(list.length);
    if (!list.length) {
      el.catalogGrid.innerHTML =
        `<div class="empty-state">` +
        `<img src="assets/ui/light-gray-logo-padded.png" alt="">` +
        `<span>Ничего не найдено</span>` +
        `</div>`;
      return;
    }
    const catScroll = el.catalogGrid.scrollTop;
    el.catalogGrid.innerHTML = list
      .map((item) =>
        itemCard(item, {
          mode: "catalog",
          selected: state.targetId === item.id,
        })
      )
      .join("");
    el.catalogGrid.scrollTop = catScroll;
  }

  function filteredMarket() {
    const q = marketQuery.trim().toLowerCase();
    let list = CATALOG.filter((item) => {
      if (!q) return true;
      return `${item.marketName} ${item.name} ${item.type} ${item.wear}`.toLowerCase().includes(q);
    });
    if (marketSort === "price-desc") {
      list = list.slice().sort((a, b) => priceOf(b) - priceOf(a));
    } else if (marketSort === "change-desc") {
      list = list.slice().sort((a, b) => changePct(b) - changePct(a));
    } else if (marketSort === "name-asc") {
      list = list.slice().sort((a, b) => a.marketName.localeCompare(b.marketName, "ru"));
    } else {
      list = list.slice().sort((a, b) => priceOf(a) - priceOf(b));
    }
    return list;
  }

  function renderMarket() {
    if (!el.marketGrid) return;
    const list = filteredMarket();
    if (el.marketCount) el.marketCount.textContent = String(list.length);
    if (!list.length) {
      el.marketGrid.innerHTML =
        `<div class="market-empty">` +
        `<img src="assets/ui/light-gray-logo-padded.png" alt="">` +
        `<span>Ничего не найдено</span>` +
        `</div>`;
      return;
    }
    el.marketGrid.innerHTML = list.map((item) => marketCard(item)).join("");
  }

  function renderMarketOwned() {
    if (!el.marketOwnedGrid) return;
    const entries = getInventoryItems();
    if (el.marketOwnedCount) el.marketOwnedCount.textContent = String(entries.length);
    if (!entries.length) {
      el.marketOwnedGrid.innerHTML =
        `<div class="market-empty">` +
        `<img src="assets/ui/light-gray-logo-padded.png" alt="">` +
        `<span>У вас пока нет скинов</span>` +
        `<button type="button" data-action="upgrade">Перейти к апгрейду</button>` +
        `</div>`;
      return;
    }
    el.marketOwnedGrid.innerHTML = entries
      .map(({ inst, item }) => ownedCard(item, inst.uid))
      .join("");
  }

  function marketMovers() {
    return CATALOG.slice()
      .map((item) => ({ item, pct: changePct(item) }))
      .filter((x) => Math.abs(x.pct) >= 0.05)
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
      .slice(0, 10);
  }

  function renderMarketTicker() {
    if (!el.marketTicker) return;
    const movers = marketMovers();
    if (!movers.length) {
      el.marketTicker.innerHTML =
        `<span class="ticker-label"><span class="live-dot"></span>LIVE</span>` +
        `<span class="ticker-chip">цены стабильны</span>`;
      return;
    }
    el.marketTicker.innerHTML =
      `<span class="ticker-label"><span class="live-dot"></span>LIVE</span>` +
      movers
        .map(
          ({ item, pct }, index) =>
            `<span class="ticker-chip ${pct >= 0 ? "up" : "down"}" style="--i:${index}">` +
            `<b>${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%</b>${esc(item.name)}</span>`
        )
        .join("");
  }

  function updateCardPricesUI() {
    const byUid = new Map(state.inventory.map((x) => [x.uid, x]));
    document.querySelectorAll(".item-card").forEach((card) => {
      let item = card.dataset.id ? getItem(card.dataset.id) : null;
      if (!item && card.dataset.uid) {
        const inst = byUid.get(card.dataset.uid);
        item = inst ? getItem(inst.itemId) : null;
      }
      if (!item) return;
      const priceNode = $(".price", card);
      if (priceNode) {
        flashPrice(priceNode, changePct(item));
        priceNode.innerHTML = `${esc(money(priceOf(item)))}<img src="assets/ui/coins.svg" alt="">`;
      }
    });

    document.querySelectorAll(".selected-chip").forEach((chip) => {
      const inst = byUid.get(chip.dataset.uid);
      const item = inst ? getItem(inst.itemId) : null;
      const priceNode = $(".chip-price", chip);
      if (!item || !priceNode) return;
      flashPrice(priceNode, changePct(item));
      priceNode.innerHTML = `${esc(money(priceOf(item)))} <img src="assets/ui/coins.svg" alt="">`;
    });

    document.querySelectorAll(".market-card[data-id]").forEach((card) => {
      const item = getItem(card.dataset.id);
      if (!item) return;
      const pct = changePct(item);
      const price = priceOf(item);
      const priceNode = $(".market-price", card);
      const changeNode = $(".market-change", card);
      if (priceNode) {
        flashPrice(priceNode, pct);
        priceNode.innerHTML = `${esc(money(price))} <img src="assets/ui/coins.svg" alt="">`;
      }
      if (changeNode) {
        changeNode.classList.remove("flash-up", "flash-down");
        changeNode.classList.toggle("up", Math.abs(pct) >= 0.05 && pct > 0);
        changeNode.classList.toggle("down", Math.abs(pct) >= 0.05 && pct < 0);
        changeNode.textContent = changeLabel(pct);
        flashChange(changeNode, pct);
      }
      const buyBtn = $(".market-buy", card);
      if (buyBtn) buyBtn.disabled = state.balance + 0.001 < price;
      const sellBtn = $(".market-sell", card);
      if (sellBtn) sellBtn.textContent = `Продать за ${money(price)}`;
    });

    updateTargetCard();
    renderBalance();
    renderWheel();
  }

  function refreshPricesUI() {
    renderHeader();
    updateCardPricesUI();
    renderMarketTicker();
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function changeClass(pct) {
    if (Math.abs(pct) < 0.05) return "";
    return pct > 0 ? "up" : "down";
  }

  function changeLabel(pct) {
    if (Math.abs(pct) < 0.05) return "0.0%";
    return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  }

  function isResultOpen() {
    return !!(el.resultModal && el.resultModal.classList.contains("show"));
  }

  function wheelWinCount(chance) {
    if (chance >= 99.999) return SEGMENTS;
    if (chance <= 0) return 0;
    return Math.max(1, Math.min(SEGMENTS - 1, Math.floor((chance / 100) * SEGMENTS)));
  }

  function resetSelection() {
    if (spinning) return;
    state.selected = [];
    state.balanceUse = 0;
    save();
    renderAll();
    toast("Выбор сброшен", "info");
  }

  function syncSelection(popNode) {
    const sel = new Set(state.selected);
    if (el.inventoryGrid) {
      el.inventoryGrid.querySelectorAll(".item-card[data-uid]").forEach((n) => {
        n.classList.toggle("selected", sel.has(n.dataset.uid));
      });
    }
    if (el.catalogGrid) {
      el.catalogGrid.querySelectorAll(".item-card[data-id]").forEach((n) => {
        n.classList.toggle("selected", state.targetId === n.dataset.id);
      });
    }
    if (popNode && popNode.classList.contains("selected")) {
      popNode.classList.remove("pop");
      void popNode.offsetWidth;
      popNode.classList.add("pop");
      setTimeout(() => popNode.classList.remove("pop"), 360);
    }
  }

  function toggleSelection(uid) {
    if (spinning) return;
    const inst = state.inventory.find((x) => x.uid === uid);
    if (!inst) return;
    if (state.targetId === inst.itemId) {
      toast("Этот скин уже выбран как цель", "info");
      return;
    }
    const index = state.selected.indexOf(uid);
    if (index >= 0) state.selected.splice(index, 1);
    else state.selected.push(uid);
    save();
    renderSelected();
    syncSelection(el.inventoryGrid ? el.inventoryGrid.querySelector(`.item-card[data-uid="${uid}"]`) : null);
    renderBalance();
    renderWheel();
    updateTargetCard();
  }

  function selectTarget(itemId) {
    if (spinning) return;
    const item = getItem(itemId);
    if (!item || !CATALOG.some((x) => x.id === itemId)) return;
    if (state.targetId === itemId) {
      state.targetId = null;
    } else {
      state.targetId = itemId;
      state.selected = state.selected.filter((uid) => {
        const inst = state.inventory.find((x) => x.uid === uid);
        return !inst || inst.itemId !== itemId;
      });
    }
    state.balanceUse = 0;
    save();
    renderSelected();
    renderTarget();
    syncSelection(el.catalogGrid ? el.catalogGrid.querySelector(`.item-card[data-id="${window.CSS && CSS.escape ? CSS.escape(String(itemId)) : itemId}"]`) : null);
    renderBalance();
    renderWheel();
  }

  function setBalanceUse(value) {
    const max = getMaxBalanceUse();
    state.balanceUse = clamp(Math.round(Number(value) || 0), 0, max);
    save();
    renderBalance();
    renderWheel();
    updateTargetCard();
  }

  function tickMarket() {
    if (spinning || isResultOpen()) return;
    state.prevPrices = { ...state.prices };
    ITEMS.forEach((item, id) => {
      const base = Number(item.price) || 0;
      const current = Number(state.prices[id]) || base;
      let next = current;
      if (Math.random() < MARKET_CHANGE_CHANCE) {
        const pct = MARKET_MIN_PCT + Math.random() * (MARKET_MAX_PCT - MARKET_MIN_PCT);
        next = clamp(current * (1 + pct), base * MARKET_MIN_FACTOR, base * MARKET_MAX_FACTOR);
      }
      state.prices[id] = Math.round(next * 100) / 100;
    });
    save();
    refreshPricesUI();
  }

  function launchConfetti() {
    const colors = ["#ff3b3b", "#ff6b6b", "#ffc2c2", "#53db42", "#ffb86b", "#ffffff"];
    for (let i = 0; i < 30; i++) {
      const node = document.createElement("span");
      node.className = "confetti";
      node.style.left = `${Math.random() * 100}vw`;
      node.style.background = colors[randomInt(0, colors.length - 1)];
      node.style.setProperty("--dx", `${(Math.random() * 2 - 1) * 130}px`);
      node.style.animationDuration = `${1.7 + Math.random() * 1.1}s`;
      node.style.animationDelay = `${Math.random() * 0.25}s`;
      node.style.width = `${5 + Math.random() * 6}px`;
      node.style.height = `${10 + Math.random() * 10}px`;
      document.body.appendChild(node);
      setTimeout(() => node.remove(), 3200);
    }
  }

  function showResult(opts) {
    if (!el.resultModal) return;
    const mode = emptyActionMode();
    const gameOver = mode === "reset";
    const { win, target, chance, lostValue } = opts;
    el.resultCard.className = `modal-card ${win ? "win" : "lose"}${gameOver ? " gameover" : ""}`;
    el.resultTitle.textContent = win ? "Успех!" : gameOver ? "Всё, конец" : "Неудача";
    el.resultImage.hidden = false;
    el.resultImage.src = target.image;
    el.resultImage.alt = target.marketName;
    el.resultName.textContent = target.marketName;
    if (win) {
      el.resultSub.textContent = `Ты получил ${target.name} за ${money(lostValue)}.`;
    } else if (gameOver) {
      el.resultSub.textContent = `Ты потерял ${money(lostValue)}. Скинов и монет больше нет. Нажми «Начать сначала».`;
    } else {
      let sub = `Шанс был ${formatChance(chance)}. Потеряно ${money(lostValue)}.`;
      if (mode === "free") sub += " Доступен бесплатный набор.";
      if (mode === "market") sub += " Хватит на самый дешёвый скин — загляни в маркет.";
      el.resultSub.textContent = sub;
    }
    el.freeSkinsBtnModal.hidden = mode !== "free";
    el.resultMarket.hidden = mode !== "market";
    el.resultReset.hidden = !gameOver;
    el.resultClose.hidden = gameOver;
    el.resultClose.classList.toggle("secondary", mode === "free" || mode === "market");
    el.resultModal.classList.add("show");
    el.resultModal.setAttribute("aria-hidden", "false");
  }

  function closeResult(skipRender) {
    if (el.resultModal) {
      el.resultModal.classList.remove("show");
      el.resultModal.setAttribute("aria-hidden", "true");
    }
    if (!skipRender) renderAll();
  }

  function grantFreeSkins() {
    if (spinning) return;
    if (getInventoryItems().length) {
      toast("Инвентарь не пуст", "error");
      return;
    }
    if (state.freeGrantsLeft <= 0) {
      toast("Бесплатные наборы закончились", "error");
      return;
    }
    if (canAffordCheapest()) {
      toast("У тебя уже хватает на самый дешёвый скин", "info");
      return;
    }
    const picked = pickRandomItems(freeSkinPool(), FREE_SKIN_COUNT);
    if (!picked.length) {
      toast("Нет доступных скинов", "error");
      return;
    }
    picked.forEach((item) => state.inventory.push({ uid: uid("free"), itemId: item.id }));
    state.freeGrantsLeft -= 1;
    state.selected = [];
    state.balanceUse = 0;
    save();
    closeResult(true);
    renderAll();
    bump(el.freeGrantsLabel ? el.freeGrantsLabel.closest(".market-stat") : null);
    toast(`Бесплатный набор: ${picked.map((x) => x.name).join(", ")}`, "success");
  }

  function buyItem(itemId) {
    if (spinning) return;
    const item = getItem(itemId);
    if (!item) return;
    const price = priceOf(item);
    if (state.balance + 0.001 < price) {
      toast("Недостаточно монет", "error");
      return;
    }
    state.balance = Math.round((state.balance - price) * 100) / 100;
    state.inventory.push({ uid: uid("buy"), itemId });
    save();
    renderHeader();
    renderInventory();
    renderMarketOwned();
    updateCardPricesUI();
    toast(`Куплен ${item.name} за ${money(price)}`, "success");
    bump(el.headerBalance ? el.headerBalance.closest(".balance-pill") : null);
  }

  function sellItem(itemUid) {
    if (spinning) return;
    const index = state.inventory.findIndex((x) => x.uid === itemUid);
    if (index < 0) return;
    const inst = state.inventory[index];
    const item = getItem(inst.itemId);
    if (!item) return;
    const price = priceOf(item);
    state.inventory.splice(index, 1);
    state.selected = state.selected.filter((x) => x !== itemUid);
    state.balance = Math.round((state.balance + price) * 100) / 100;
    save();
    renderHeader();
    renderInventory();
    renderMarketOwned();
    renderSelected();
    updateCardPricesUI();
    toast(`Продан ${item.name} за ${money(price)}`, "success");
    bump(el.headerBalance ? el.headerBalance.closest(".balance-pill") : null);
  }

  async function doUpgrade() {
    if (spinning) return;
    const totals = getTotals();
    const target = totals.target;
    if (!target || totals.total <= 0 || totals.chance <= 0) return;
    if (!state.selected.length && state.balanceUse <= 0) return;

    const chance = totals.chance;
    const selectedUids = state.selected.slice();
    const selectedValue = totals.selectedValue;
    const balanceUse = state.balanceUse;
    const targetId = target.id;
    const win = Math.random() * 100 < chance;
    const winCount = wheelWinCount(chance);
    const index = win
      ? winCount > 0
        ? randomInt(0, winCount - 1)
        : 0
      : winCount < SEGMENTS
        ? randomInt(winCount, SEGMENTS - 1)
        : 0;
    const seg = 360 / SEGMENTS;
    const center = index * seg + seg / 2;
    const desired = 360 * 10 + (180 - center) + (Math.random() * seg * 0.5 - seg * 0.25);
    const currentMod = ((wheelRotation % 360) + 360) % 360;
    let delta = desired - currentMod;
    while (delta < 360 * 9) delta += 360;
    wheelRotation += delta;

    spinning = true;
    const wrap = el.wheel ? el.wheel.parentElement : null;
    if (wrap) {
      wrap.classList.remove("result-win", "result-lose");
      wrap.classList.add("spinning");
    }
    if (el.upgradeBtn) el.upgradeBtn.disabled = true;
    if (el.balanceRange) el.balanceRange.disabled = true;
    if (el.quickRow) el.quickRow.querySelectorAll("button").forEach((btn) => (btn.disabled = true));
    if (el.wheel) {
      el.wheel.style.transition = `transform ${SPIN_MS}ms cubic-bezier(.09,.52,.07,1)`;
      el.wheel.style.transform = `rotate(${wheelRotation}deg)`;
    }

    await wait(SPIN_MS + 120);
    spinning = false;
    if (wrap) {
      wrap.classList.remove("spinning");
      wrap.classList.add(win ? "result-win" : "result-lose");
      setTimeout(() => wrap.classList.remove("result-win", "result-lose"), 900);
    }

    state.inventory = state.inventory.filter((x) => !selectedUids.includes(x.uid));
    state.balance = Math.round((state.balance - balanceUse) * 100) / 100;
    state.selected = [];
    state.balanceUse = 0;
    state.attempts += 1;
    if (win) {
      state.wins += 1;
      state.inventory.push({ uid: uid("win"), itemId: targetId });
      launchConfetti();
    }
    state.targetId = null;
    save();
    renderAll();
    showResult({ win, target, chance, lostValue: selectedValue + balanceUse });
  }

  function resetProgress(ask) {
    if (spinning) {
      toast("Дождись окончания спина", "info");
      return;
    }
    if (ask && !confirm("Сбросить весь прогресс?")) return;
    spinning = false;
    closeResult(true);
    state = makeInitialState();
    wheelRotation = 0;
    lastChanceText = "";
    lastEmptyMode = "";
    if (el.wheel) {
      el.wheel.style.transition = "none";
      el.wheel.style.transform = "rotate(0deg)";
    }
    const wrap = el.wheel ? el.wheel.parentElement : null;
    if (wrap) wrap.classList.remove("spinning", "result-win", "result-lose");
    save();
    setView("upgrade");
    toast("Прогресс сброшен", "success");
  }

  function handleAction(action) {
    if (action === "free") {
      grantFreeSkins();
    } else if (action === "market") {
      closeResult(true);
      setView("market");
    } else if (action === "upgrade") {
      closeResult(true);
      setView("upgrade");
    } else if (action === "reset") {
      resetProgress(true);
    }
  }

  function setView(view) {
    const isMarket = view === "market";
    if (el.upgradeView) el.upgradeView.hidden = isMarket;
    if (el.marketView) el.marketView.hidden = !isMarket;
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
    renderAll();
    const active = isMarket ? el.marketView : el.upgradeView;
    if (active) {
      active.style.animation = "none";
      void active.offsetWidth;
      active.style.animation = "view-in .35s cubic-bezier(.2,.8,.2,1)";
      setTimeout(() => {
        active.style.animation = "";
      }, 380);
    }
  }

  function renderAll() {
    const scrolls = {
      inv: el.inventoryGrid ? el.inventoryGrid.scrollTop : 0,
      catalog: el.catalogGrid ? el.catalogGrid.scrollTop : 0,
      market: el.marketGrid ? el.marketGrid.scrollTop : 0,
      owned: el.marketOwnedGrid ? el.marketOwnedGrid.scrollTop : 0,
    };
    renderHeader();
    renderSelected();
    renderTarget();
    renderBalance();
    renderWheel();
    renderInventory();
    renderCatalog();
    renderMarket();
    renderMarketOwned();
    renderMarketTicker();
    if (el.inventoryGrid) el.inventoryGrid.scrollTop = scrolls.inv;
    if (el.catalogGrid) el.catalogGrid.scrollTop = scrolls.catalog;
    if (el.marketGrid) el.marketGrid.scrollTop = scrolls.market;
    if (el.marketOwnedGrid) el.marketOwnedGrid.scrollTop = scrolls.owned;
  }

  function init() {
    if (!ITEMS.size) {
      console.error("REDUP: данные предметов не загружены");
      return;
    }

    if (el.upgradeBtn) {
      el.upgradeBtn.addEventListener("click", (event) => {
        addRipple(event, el.upgradeBtn);
        doUpgrade();
      });
    }
    if (el.selectedItems) {
      el.selectedItems.addEventListener("click", (event) => {
        const remove = event.target.closest("[data-remove]");
        if (!remove || spinning) return;
        state.selected = state.selected.filter((x) => x !== remove.dataset.remove);
        save();
        renderSelected();
        syncSelection();
        renderBalance();
        renderWheel();
        updateTargetCard();
      });
    }
    if (el.inventoryGrid) {
      el.inventoryGrid.addEventListener("click", (event) => {
        const action = event.target.closest("[data-action]");
        if (action) {
          handleAction(action.dataset.action);
          return;
        }
        const card = event.target.closest("[data-uid]");
        if (card) toggleSelection(card.dataset.uid);
      });
    }
    if (el.catalogGrid) {
      el.catalogGrid.addEventListener("click", (event) => {
        const card = event.target.closest("[data-id]");
        if (card) selectTarget(card.dataset.id);
      });
    }
    if (el.marketGrid) {
      el.marketGrid.addEventListener("click", (event) => {
        const action = event.target.closest("[data-action]");
        if (action) {
          handleAction(action.dataset.action);
          return;
        }
        const buy = event.target.closest("[data-buy]");
        if (buy) buyItem(buy.dataset.buy);
      });
    }
    if (el.marketOwnedGrid) {
      el.marketOwnedGrid.addEventListener("click", (event) => {
        const action = event.target.closest("[data-action]");
        if (action) {
          handleAction(action.dataset.action);
          return;
        }
        const sell = event.target.closest("[data-sell]");
        if (sell) sellItem(sell.dataset.sell);
      });
    }
    if (el.balanceRange) {
      el.balanceRange.addEventListener("input", (event) => setBalanceUse(event.target.value));
    }
    if (el.quickRow) {
      el.quickRow.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-pct]");
        if (!btn) return;
        const max = getMaxBalanceUse();
        const pct = Number(btn.dataset.pct) || 0;
        setBalanceUse(pct >= 100 ? max : Math.floor((max * pct) / 100));
      });
    }
    if (el.searchInput) {
      el.searchInput.addEventListener("input", (event) => {
        catalogQuery = event.target.value;
        renderCatalog();
      });
    }
    if (el.sortSelect) {
      el.sortSelect.addEventListener("change", (event) => {
        catalogSort = event.target.value;
        renderCatalog();
      });
    }
    if (el.marketSearchInput) {
      el.marketSearchInput.addEventListener("input", (event) => {
        marketQuery = event.target.value;
        renderMarket();
      });
    }
    if (el.marketSortSelect) {
      el.marketSortSelect.addEventListener("change", (event) => {
        marketSort = event.target.value;
        renderMarket();
      });
    }
    if (el.resetBtn) el.resetBtn.addEventListener("click", () => resetProgress(true));
    if (el.resetInvBtn) el.resetInvBtn.addEventListener("click", resetSelection);
    if (el.freeSkinsBtnModal) el.freeSkinsBtnModal.addEventListener("click", grantFreeSkins);
    if (el.resultClose) el.resultClose.addEventListener("click", () => closeResult());
    if (el.resultMarket) {
      el.resultMarket.addEventListener("click", () => {
        closeResult(true);
        setView("market");
        toast("Выбери скин в маркете", "info");
      });
    }
    if (el.resultReset) el.resultReset.addEventListener("click", () => resetProgress(false));
    if (el.resultModal) {
      el.resultModal.addEventListener("click", (event) => {
        if (event.target === el.resultModal) closeResult();
      });
    }
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.dataset.view));
    });
    document.addEventListener("click", (event) => {
      const btn = event.target.closest(
        ".modal-btn,.market-buy,.market-sell,.free-skins-btn,.quick-row button,.nav-item"
      );
      if (btn && !btn.disabled) addRipple(event, btn);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isResultOpen()) closeResult();
    });

    setView("upgrade");
    setInterval(tickMarket, MARKET_TICK_MS);
  }

  init();
})();
