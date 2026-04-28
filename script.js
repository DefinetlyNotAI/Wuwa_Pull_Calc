const STORAGE_KEY = "wuwaProbabilityCalculatorStateV1";

const STANDARD_FIVE_STARS = ["Verina", "Encore", "Jianxin", "Calcharo", "Lingyang"];
const FOUR_STAR_NAMES = [
  "Buling", "Lumi", "Youhu", "Aalto", "Yangyang", "Yuanwu",
  "Chixia", "Mortefi", "Sanhua", "Baizhi", "Danjin", "Taoqi"
];
const DEFAULT_FOUR_STAR_RATEUPS = ["none", "none", "none"];

const SOFT_PITY = {
  66: 0.05, 67: 0.09, 68: 0.13, 69: 0.16, 70: 0.2,
  71: 0.29, 72: 0.36, 73: 0.44, 74: 0.51, 75: 0.61,
  76: 0.72, 77: 0.77, 78: 0.81, 79: 0.86, 80: 1
};

const DEFAULT_STATE = {
  characterPity: 0,
  weaponPity: 0,
  characterPity4: 0,
  weaponPity4: 0,
  char5050State: "normal",
  corals: 0,
  radiantTides: 0,
  forgingTides: 0,
  astrites: 0,
  includeCoralConversion: true,
  useAdvancedDefaults: false,
  iterations: 10000,
  fourStarRateups: [...DEFAULT_FOUR_STAR_RATEUPS],
  charDupes: Object.fromEntries(STANDARD_FIVE_STARS.map((n) => [n, 0])),
  fourStarDupes: Object.fromEntries(FOUR_STAR_NAMES.map((n) => [n, 0])),
  wishlist: []
};

const uiState = { wishlist: [] };
const chartState = { points: [], markers: [], maxX: 1, curve: [], padLeft: 0, plotW: 1 };

function clampInt(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fiveStarChance(nextPity) {
  if (nextPity >= 80) return 1;
  if (nextPity >= 66) return SOFT_PITY[nextPity] ?? 0.008;
  return 0.008;
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const rank = Math.ceil(sorted.length * q) - 1;
  const idx = Math.max(0, Math.min(sorted.length - 1, rank));
  return sorted[idx];
}

function byId(id) {
  return document.getElementById(id);
}

function createDupeInputs(containerId, names, prefix) {
  const container = byId(containerId);
  container.innerHTML = "";
  for (const name of names) {
    const label = document.createElement("label");
    label.textContent = name;
    const select = document.createElement("select");
    select.id = `${prefix}-${name}`;
    for (let i = 0; i <= 6; i += 1) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `C${i}`;
      select.appendChild(opt);
    }
    label.appendChild(select);
    container.appendChild(label);
  }
}

function createRateupSelectors() {
  const ids = ["fourStarRateup1", "fourStarRateup2", "fourStarRateup3"];
  for (const id of ids) {
    const select = byId(id);
    if (!select) continue;
    select.innerHTML = "";
    const noneOpt = document.createElement("option");
    noneOpt.value = "none";
    noneOpt.textContent = "None (equal 4★ odds)";
    select.appendChild(noneOpt);
    for (const name of FOUR_STAR_NAMES) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    }
  }
}

function normalizeRateupList(list) {
  const raw = Array.isArray(list) ? list.slice(0, 3) : [];
  const normalized = raw.map((x) => (FOUR_STAR_NAMES.includes(String(x)) ? String(x) : "none"));
  while (normalized.length < 3) normalized.push("none");
  return normalized;
}

function getEffectiveRateupCharacters(input) {
  const selected = normalizeRateupList(input.fourStarRateups)
    .filter((x) => x !== "none");
  return [...new Set(selected)];
}

function useEqualFourStarOdds(input) {
  if (input.useAdvancedDefaults) return true;
  return getEffectiveRateupCharacters(input).length !== 3;
}

function normalizeWishlistList(list) {
  return (Array.isArray(list) ? list : [])
    .map((s) => String(s).trim().toLowerCase())
    .filter((s) => s === "character" || s === "weapon");
}

function renderWishlistEditor() {
  const root = byId("wishlistEditor");
  if (!uiState.wishlist.length) {
    root.innerHTML = "<p class='wishlist-empty'>No wishlist items yet.</p>";
    return;
  }

  let charCount = 0;
  let weaponCount = 0;
  root.innerHTML = uiState.wishlist.map((item, index) => `
    <div class="wishlist-row">
      <div class="wishlist-index">${
        item === "character"
          ? `Character ${++charCount}`
          : `Weapon ${++weaponCount}`
      }</div>
      <div class="wishlist-type">${item} slot #${index + 1}</div>
      <div class="row-actions">
        <button class="icon-btn" type="button" data-action="up" data-index="${index}" data-tooltip="Move up">
          <i data-lucide="arrow-up"></i>
        </button>
        <button class="icon-btn" type="button" data-action="down" data-index="${index}" data-tooltip="Move down">
          <i data-lucide="arrow-down"></i>
        </button>
        <button class="icon-btn" type="button" data-action="delete" data-index="${index}" data-tooltip="Remove">
          <i data-lucide="x"></i>
        </button>
      </div>
    </div>
  `).join("");
  if (window.lucide) window.lucide.createIcons();
  bindStyledTooltips(root);
}

function setWishlist(nextWishlist) {
  uiState.wishlist = normalizeWishlistList(nextWishlist);
  renderWishlistEditor();
}

function toggleAdvancedFields() {
  const useDefaults = byId("useAdvancedDefaults").checked;
  const advanced = byId("advancedSettings");
  advanced.classList.toggle("disabled", useDefaults);
  for (const el of advanced.querySelectorAll("input, select")) el.disabled = useDefaults;
}

function applyAdvancedDefaults(input) {
  if (!input.useAdvancedDefaults) return input;
  return {
    ...input,
    char5050State: "normal",
    characterPity4: 0,
    weaponPity4: 0,
    fourStarRateups: [...DEFAULT_FOUR_STAR_RATEUPS],
    charDupes: Object.fromEntries(STANDARD_FIVE_STARS.map((n) => [n, 6])),
    fourStarDupes: Object.fromEntries(FOUR_STAR_NAMES.map((n) => [n, 6]))
  };
}

function hasAdvancedChanges(input) {
  if (input.char5050State !== DEFAULT_STATE.char5050State) return true;
  if (input.iterations !== DEFAULT_STATE.iterations) return true;
  if (input.characterPity4 !== DEFAULT_STATE.characterPity4) return true;
  if (input.weaponPity4 !== DEFAULT_STATE.weaponPity4) return true;
  for (let i = 0; i < 3; i += 1) {
    if ((input.fourStarRateups?.[i] || "none") !== DEFAULT_STATE.fourStarRateups[i]) return true;
  }
  for (const n of STANDARD_FIVE_STARS) if (input.charDupes[n] !== DEFAULT_STATE.charDupes[n]) return true;
  for (const n of FOUR_STAR_NAMES) if (input.fourStarDupes[n] !== DEFAULT_STATE.fourStarDupes[n]) return true;
  return false;
}

function loadStateFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    const legacyWishlist = String(parsed.wishlistText || "")
      .split(/\r?\n|,/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s === "character" || s === "weapon");
    const wishlist = normalizeWishlistList(parsed.wishlist?.length ? parsed.wishlist : legacyWishlist);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      fourStarRateups: normalizeRateupList(parsed.fourStarRateups),
      charDupes: { ...DEFAULT_STATE.charDupes, ...(parsed.charDupes || {}) },
      fourStarDupes: { ...DEFAULT_STATE.fourStarDupes, ...(parsed.fourStarDupes || {}) },
      wishlist
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeStateToUI(state) {
  byId("characterPity").value = state.characterPity;
  byId("weaponPity").value = state.weaponPity;
  byId("characterPity4").value = state.characterPity4;
  byId("weaponPity4").value = state.weaponPity4;
  byId("char5050State").value = state.char5050State;
  byId("corals").value = state.corals;
  byId("radiantTides").value = state.radiantTides;
  byId("forgingTides").value = state.forgingTides;
  byId("astrites").value = state.astrites;
  byId("includeCoralConversion").checked = !!state.includeCoralConversion;
  byId("useAdvancedDefaults").checked = !!state.useAdvancedDefaults;
  byId("iterations").value = state.iterations;
  byId("fourStarRateup1").value = state.fourStarRateups?.[0] || "none";
  byId("fourStarRateup2").value = state.fourStarRateups?.[1] || "none";
  byId("fourStarRateup3").value = state.fourStarRateups?.[2] || "none";
  setWishlist(state.wishlist || []);

  for (const n of STANDARD_FIVE_STARS) byId(`char-${n}`).value = String(clampInt(state.charDupes[n], 0, 6));
  for (const n of FOUR_STAR_NAMES) byId(`four-${n}`).value = String(clampInt(state.fourStarDupes[n], 0, 6));
  toggleAdvancedFields();
}

function normalizeStateFromUI() {
  const charDupes = {};
  const fourStarDupes = {};
  for (const n of STANDARD_FIVE_STARS) charDupes[n] = clampInt(Number(byId(`char-${n}`).value), 0, 6);
  for (const n of FOUR_STAR_NAMES) fourStarDupes[n] = clampInt(Number(byId(`four-${n}`).value), 0, 6);

  return {
    characterPity: clampInt(Number(byId("characterPity").value), 0, 79),
    weaponPity: clampInt(Number(byId("weaponPity").value), 0, 79),
    characterPity4: clampInt(Number(byId("characterPity4").value), 0, 9),
    weaponPity4: clampInt(Number(byId("weaponPity4").value), 0, 9),
    char5050State: byId("char5050State").value === "guaranteed" ? "guaranteed" : "normal",
    corals: Math.max(0, clampInt(Number(byId("corals").value), 0, Number.MAX_SAFE_INTEGER)),
    radiantTides: Math.max(0, clampInt(Number(byId("radiantTides").value), 0, Number.MAX_SAFE_INTEGER)),
    forgingTides: Math.max(0, clampInt(Number(byId("forgingTides").value), 0, Number.MAX_SAFE_INTEGER)),
    astrites: Math.max(0, clampInt(Number(byId("astrites").value), 0, Number.MAX_SAFE_INTEGER)),
    includeCoralConversion: !!byId("includeCoralConversion").checked,
    useAdvancedDefaults: !!byId("useAdvancedDefaults").checked,
    iterations: Math.max(10000, clampInt(Number(byId("iterations").value), 10000, 200000)),
    fourStarRateups: normalizeRateupList([
      byId("fourStarRateup1").value,
      byId("fourStarRateup2").value,
      byId("fourStarRateup3").value
    ]),
    charDupes,
    fourStarDupes,
    wishlist: [...uiState.wishlist]
  };
}

function saveStateToStorage(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function randomPick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function makeRunState(input) {
  return {
    pity5Char: input.characterPity,
    pity5Weapon: input.weaponPity,
    pity4Char: input.characterPity4,
    pity4Weapon: input.weaponPity4,
    charGuaranteed: input.char5050State === "guaranteed",
    copies5: {
      ...input.charDupes,
      featured_character: 0,
      featured_weapon: 0
    },
    copies4: { ...input.fourStarDupes },
    resources: {
      radiant: input.radiantTides,
      forging: input.forgingTides,
      astriteTides: Math.floor(input.astrites / 160),
      astritesConverted: Math.floor(input.astrites / 160) * 160,
      corals: input.corals
    },
    stats: {
      totalPulls: 0,
      coralsGenerated: 0,
      coralsSpent: 0,
      tidesUsed: {
        radiant: 0,
        forging: 0,
        astrite_character: 0,
        astrite_weapon: 0,
        coral_character: 0,
        coral_weapon: 0
      }
    }
  };
}

function addCorals(run, amount) {
  run.resources.corals += amount;
  run.stats.coralsGenerated += amount;
}

function awardFiveStarCorals(run, unitKey, includeLossBonus) {
  const current = run.copies5[unitKey] || 0;
  addCorals(run, current < 7 ? 15 : 40);
  run.copies5[unitKey] = current + 1;
  if (includeLossBonus) addCorals(run, 30);
}

function awardFourStarCharacterCorals(run, unitKey) {
  const current = run.copies4[unitKey] || 0;
  addCorals(run, current < 7 ? 3 : 8);
  run.copies4[unitKey] = current + 1;
}

function awardFourStarWeaponCorals(run) {
  addCorals(run, 3);
}

function convertCoralsToBannerTides(run, banner) {
  const creatable = Math.floor(run.resources.corals / 8);
  if (creatable <= 0) return false;

  run.resources.corals -= creatable * 8;
  run.stats.coralsSpent += creatable * 8;

  if (banner === "character") {
    run.resources.radiant += creatable;
    run.stats.tidesUsed.coral_character += creatable;
  } else {
    run.resources.forging += creatable;
    run.stats.tidesUsed.coral_weapon += creatable;
  }

  return true;
}

function consumePullToken(run, banner, includeCoralConversion) {
  if (banner === "character") {
    if (run.resources.radiant > 0) {
      run.resources.radiant -= 1;
      run.stats.tidesUsed.radiant += 1;
      return true;
    }

    if (run.resources.astriteTides > 0) {
      run.resources.astriteTides -= 1;
      run.stats.tidesUsed.astrite_character += 1;
      return true;
    }

    if (includeCoralConversion && convertCoralsToBannerTides(run, "character")) {
      run.resources.radiant -= 1;
      return true;
    }

    return false;
  }

  if (run.resources.forging > 0) {
    run.resources.forging -= 1;
    run.stats.tidesUsed.forging += 1;
    return true;
  }

  if (run.resources.astriteTides > 0) {
    run.resources.astriteTides -= 1;
    run.stats.tidesUsed.astrite_weapon += 1;
    return true;
  }

  if (includeCoralConversion && convertCoralsToBannerTides(run, "weapon")) {
    run.resources.forging -= 1;
    return true;
  }

  return false;
}

function doOnePull(run, banner, input, rng, traceLines) {
  const isChar = banner === "character";
  const pity5Key = isChar ? "pity5Char" : "pity5Weapon";
  const pity4Key = isChar ? "pity4Char" : "pity4Weapon";
  const nextPity5 = run[pity5Key] + 1;
  const roll5 = rng();
  const chance5 = fiveStarChance(nextPity5);

  if (roll5 < chance5) {
    run[pity5Key] = 0;
    run[pity4Key] = 0;
    if (isChar) {
      let featured = false;
      if (run.charGuaranteed) {
        featured = true;
        run.charGuaranteed = false;
      } else {
        featured = rng() < 0.5;
      }

      if (featured) {
        awardFiveStarCorals(run, "featured_character", false);
        if (traceLines) traceLines.push(`Pull ${run.stats.totalPulls}: CHARACTER 5★ FEATURED (pity ${nextPity5})`);
        return { featured5: true };
      }

      const lostTo = randomPick(STANDARD_FIVE_STARS, rng);
      run.charGuaranteed = true;
      awardFiveStarCorals(run, lostTo, true);
      if (traceLines) traceLines.push(`Pull ${run.stats.totalPulls}: CHARACTER 5★ LOST to ${lostTo} (guaranteed next)`);
      return { featured5: false };
    }

    awardFiveStarCorals(run, "featured_weapon", false);
    if (traceLines) traceLines.push(`Pull ${run.stats.totalPulls}: WEAPON 5★ FEATURED (pity ${nextPity5})`);
    return { featured5: true };
  }

  run[pity5Key] = nextPity5;
  const nextPity4 = run[pity4Key] + 1;
  const isFourStar = nextPity4 >= 10 || rng() < 0.06;

  if (isFourStar) {
    run[pity4Key] = 0;
    const equalOdds = useEqualFourStarOdds(input);
    if (equalOdds) {
      const outcomes = [...FOUR_STAR_NAMES, "weapon"];
      const picked = randomPick(outcomes, rng);
      if (picked === "weapon") {
        awardFourStarWeaponCorals(run);
        if (traceLines) traceLines.push(`Pull ${run.stats.totalPulls}: 4★ weapon (equal odds mode)`);
      } else {
        awardFourStarCharacterCorals(run, picked);
        if (traceLines) traceLines.push(`Pull ${run.stats.totalPulls}: 4★ ${picked} (equal odds mode)`);
      }
      return { featured5: false };
    }

    const selectedRateups = getEffectiveRateupCharacters(input);
    const r = rng();
    if (isChar) {
      if (r < 0.66) {
        const pickedRateup = randomPick(selectedRateups, rng);
        awardFourStarCharacterCorals(run, pickedRateup);
        if (traceLines) traceLines.push(`Pull ${run.stats.totalPulls}: 4★ ${pickedRateup} (rate-up)`);
        return { featured5: false };
      }
      if (r < 0.83) {
        const nonRateupChars = FOUR_STAR_NAMES.filter((n) => !selectedRateups.includes(n));
        const picked = randomPick(nonRateupChars.length ? nonRateupChars : FOUR_STAR_NAMES, rng);
        awardFourStarCharacterCorals(run, picked);
        if (traceLines) traceLines.push(`Pull ${run.stats.totalPulls}: 4★ ${picked} (non-rateup)`);
        return { featured5: false };
      }
      awardFourStarWeaponCorals(run);
      if (traceLines) traceLines.push(`Pull ${run.stats.totalPulls}: 4★ weapon`);
      return { featured5: false };
    }

    if (r < 0.66) {
      awardFourStarWeaponCorals(run);
      if (traceLines) traceLines.push(`Pull ${run.stats.totalPulls}: 4★ weapon (weapon rate-up branch)`);
      return { featured5: false };
    }
    if (r < 0.83) {
      awardFourStarWeaponCorals(run);
      if (traceLines) traceLines.push(`Pull ${run.stats.totalPulls}: 4★ weapon`);
      return { featured5: false };
    }
    const picked = randomPick(FOUR_STAR_NAMES, rng);
    awardFourStarCharacterCorals(run, picked);
    if (traceLines) traceLines.push(`Pull ${run.stats.totalPulls}: 4★ ${picked} (random character)`);
    return { featured5: false };
  }

  run[pity4Key] = nextPity4;
  return { featured5: false };
}

function simulateRun(input, seed, collectTrace) {
  const run = makeRunState(input);
  const rng = createRng(seed);
  const completion = new Array(input.wishlist.length).fill(false);
  const trace = collectTrace ? [] : null;
  let idx = 0;

  while (idx < input.wishlist.length) {
    const banner = input.wishlist[idx];
    if (!consumePullToken(run, banner, input.includeCoralConversion)) break;

    run.stats.totalPulls += 1;
    const result = doOnePull(run, banner, input, rng, trace && trace.length < 300 ? trace : null);
    if (input.includeCoralConversion) {
      convertCoralsToBannerTides(run, banner);
    }
    if (result.featured5) {
      completion[idx] = true;
      idx += 1;
    }

    if (run.stats.totalPulls > 200000) break;
  }

  return {
    success: idx === input.wishlist.length,
    completion,
    pullsUsed: run.stats.totalPulls,
    coralsRemaining: run.resources.corals,
    resourcesRemaining: {
      radiant: run.resources.radiant,
      forging: run.resources.forging,
      astriteTides: run.resources.astriteTides
    },
    stats: {
      ...run.stats,
      astritesConverted: run.resources.astritesConverted
    },
    sampleTrace: trace
  };
}

function computeWishlistGuaranteeThresholds(input) {
  const output = [];
  let cp = input.characterPity;
  let wp = input.weaponPity;
  let guaranteed = input.char5050State === "guaranteed";
  let cumulative = 0;

  for (const item of input.wishlist) {
    if (item === "character") {
      const firstHit = 80 - cp;
      const worst = firstHit + (guaranteed ? 0 : 80);
      cumulative += worst;
      output.push(cumulative);
      cp = 0;
      guaranteed = false;
    } else {
      const worst = 80 - wp;
      cumulative += worst;
      output.push(cumulative);
      wp = 0;
    }
  }
  return output;
}

async function runMonteCarlo(input, onProgress) {
  const iterations = input.iterations;
  const baseSeed = hashString(JSON.stringify(input));
  const completionPulls = [];
  const allPulls = [];
  const itemCounts = new Array(input.wishlist.length).fill(0);
  const aggregate = {
    coralsGenerated: 0,
    coralsSpent: 0,
    coralsRemaining: 0,
    astritesConverted: 0,
    tidesUsed: {
      radiant: 0,
      forging: 0,
      astrite_character: 0,
      astrite_weapon: 0,
      coral_character: 0,
      coral_weapon: 0
    }
  };

  const chunkSize = 500;
  let sampleTrace = [];
  for (let start = 0; start < iterations; start += chunkSize) {
    const end = Math.min(start + chunkSize, iterations);
    for (let i = start; i < end; i += 1) {
      const seed = (baseSeed + Math.imul(i + 1, 2654435761)) >>> 0;
      const result = simulateRun(input, seed, i === 0);
      allPulls.push(result.pullsUsed);
      if (result.success) completionPulls.push(result.pullsUsed);
      for (let j = 0; j < result.completion.length; j += 1) if (result.completion[j]) itemCounts[j] += 1;

      aggregate.coralsGenerated += result.stats.coralsGenerated;
      aggregate.coralsSpent += result.stats.coralsSpent;
      aggregate.coralsRemaining += result.coralsRemaining;
      aggregate.astritesConverted += result.stats.astritesConverted;
      for (const key of Object.keys(aggregate.tidesUsed)) aggregate.tidesUsed[key] += result.stats.tidesUsed[key];
      if (i === 0) sampleTrace = result.sampleTrace || [];
    }

    if (onProgress) onProgress(end, iterations);
    if (end < iterations) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  completionPulls.sort((a, b) => a - b);
  allPulls.sort((a, b) => a - b);
  const completionRate = completionPulls.length / iterations;
  const pullMean = completionPulls.length ? completionPulls.reduce((a, b) => a + b, 0) / completionPulls.length : null;
  const p10 = quantile(completionPulls, 0.1);
  const p50 = quantile(completionPulls, 0.5);
  const p90 = quantile(completionPulls, 0.9);

  const initialAstriteTides = Math.floor(input.astrites / 160);
  const currentPositionPulls = input.radiantTides + input.forgingTides + initialAstriteTides + (input.includeCoralConversion ? Math.floor(input.corals / 8) : 0);
  const guaranteeThresholds = computeWishlistGuaranteeThresholds(input);
  const maxObserved = allPulls.length ? allPulls[allPulls.length - 1] : 0;
  const maxX = Math.max(maxObserved, currentPositionPulls, ...guaranteeThresholds, 1);

  const curve = [];
  let k = 0;
  for (let x = 0; x <= maxX; x += 1) {
    while (k < completionPulls.length && completionPulls[k] <= x) k += 1;
    curve.push({ x, y: (k / iterations) * 100 });
  }
  const fiftyPoint = curve.find((p) => p.y >= 50)?.x ?? null;
  const aggregatePerRun = {
    coralsGenerated: aggregate.coralsGenerated / iterations,
    coralsSpent: aggregate.coralsSpent / iterations,
    coralsRemaining: aggregate.coralsRemaining / iterations,
    astritesConverted: aggregate.astritesConverted / iterations,
    tidesUsed: {
      radiant: aggregate.tidesUsed.radiant / iterations,
      forging: aggregate.tidesUsed.forging / iterations,
      astrite_character: aggregate.tidesUsed.astrite_character / iterations,
      astrite_weapon: aggregate.tidesUsed.astrite_weapon / iterations,
      coral_character: aggregate.tidesUsed.coral_character / iterations,
      coral_weapon: aggregate.tidesUsed.coral_weapon / iterations
    }
  };

  return {
    iterations,
    completionRate,
    p10,
    p50,
    p90,
    pullMean,
    currentPositionPulls,
    maxObservedPulls: maxObserved,
    fiftyPoint,
    curve,
    guaranteeThresholds,
    itemProbabilities: itemCounts.map((c, idx) => {
      // Joint: probability of completing all items up to this index
      const joint = c / iterations;
      // Marginal: conditional probability of getting this item given we completed all previous items
      const marginal = idx === 0 ? joint : (itemCounts[idx] / Math.max(itemCounts[idx - 1], 1));
      return { marginal, joint };
    }),
    aggregate,
    aggregatePerRun,
    sampleTrace
  };
}

function formatNumber(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "N/A";
  return Number(v).toFixed(digits);
}

function formatInt(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "N/A";
  return Math.round(v).toLocaleString();
}

function renderWishlistTable(input, result) {
  const container = byId("wishlistTableContainer");
  if (!input.wishlist.length) {
    container.innerHTML = "<p class='warn'>Wishlist is empty.</p>";
    return;
  }
  let rows = "";
  for (let i = 0; i < input.wishlist.length; i += 1) {
    const p = result.itemProbabilities[i];
    rows += `<tr>
      <td>${i + 1}</td>
      <td>${input.wishlist[i]}</td>
      <td>${formatNumber(p.marginal * 100)}%</td>
      <td>${formatNumber(p.joint * 100)}%</td>
      <td>${result.guaranteeThresholds[i]}</td>
    </tr>`;
  }
  container.innerHTML = `<table>
    <thead>
      <tr>
        <th data-tooltip="The position of this request in your ordered wishlist.">#</th>
        <th data-tooltip="Whether this wishlist step is a character or weapon target.">Wishlist item</th>
        <th data-tooltip="Chance to obtain this specific item at all in your run.">Marginal acquisition</th>
        <th data-tooltip="Chance to reach and complete everything up to this item in order.">Joint probability to this index</th>
        <th data-tooltip="Guaranteed worst-case pull count needed to reach this step.">Worst-case guarantee pull threshold</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
  bindStyledTooltips(container);
}

function renderSummary(input, result) {
  const summary = byId("summaryStats");
  const completionRatePct = result.completionRate * 100;
  summary.innerHTML = `<p>
    <strong>Completion chance:</strong> ${formatNumber(completionRatePct)}% |
    <strong>P10:</strong> ${formatNumber(result.p10, 0)} pulls |
    <strong>Mean:</strong> ${formatNumber(result.pullMean, 1)} pulls |
    <strong>P90:</strong> ${formatNumber(result.p90, 0)} pulls
  </p>`;

  const b = byId("resourceBreakdown");
  const coralSpentPerRun = result.aggregatePerRun.coralsSpent;
  b.innerHTML = `<table>
    <thead>
      <tr>
        <th data-tooltip="Resource metric from simulation.">Metric</th>
        <th data-tooltip="Average value per simulation run.">Avg per run</th>
        <th data-tooltip="Total across all simulation runs.">Total (all runs)</th>
      </tr>
    </thead>
    <tbody>
		<tr>
		  <td>Total Radiant Tides used</td>
		  <td>
			${formatNumber(
			  result.aggregatePerRun.tidesUsed.radiant +
			  result.aggregatePerRun.tidesUsed.astrite_character +
			  result.aggregatePerRun.tidesUsed.coral_character,
			2)}
		  </td>
		  <td>
			${formatInt(
			  result.aggregate.tidesUsed.radiant +
			  result.aggregate.tidesUsed.astrite_character +
			  result.aggregate.tidesUsed.coral_character
			)}
		  </td>
		</tr>

		<tr>
		  <td>Total Forging Tides used</td>
		  <td>
			${formatNumber(
			  result.aggregatePerRun.tidesUsed.forging +
			  result.aggregatePerRun.tidesUsed.astrite_weapon +
			  result.aggregatePerRun.tidesUsed.coral_weapon,
			2)}
		  </td>
		  <td>
			${formatInt(
			  result.aggregate.tidesUsed.forging +
			  result.aggregate.tidesUsed.astrite_weapon +
			  result.aggregate.tidesUsed.coral_weapon
			)}
		  </td>
		</tr>
      <tr><td>Radient Tides used (raw)</td><td>${formatNumber(result.aggregatePerRun.tidesUsed.radiant, 2)}</td><td>${formatInt(result.aggregate.tidesUsed.radiant)}</td></tr>
      <tr><td>Forging Tides used (raw)</td><td>${formatNumber(result.aggregatePerRun.tidesUsed.forging, 2)}</td><td>${formatInt(result.aggregate.tidesUsed.forging)}</td></tr>
      <tr><td>Radient Tides used (astrite)</td><td>${formatNumber(result.aggregatePerRun.tidesUsed.astrite_character, 2)}</td><td>${formatInt(result.aggregate.tidesUsed.astrite_character)}</td></tr>
      <tr><td>Forging Tides used (astrite)</td><td>${formatNumber(result.aggregatePerRun.tidesUsed.astrite_weapon, 2)}</td><td>${formatInt(result.aggregate.tidesUsed.astrite_weapon)}</td></tr>
      <tr><td>Radient Tides used (coral)</td><td>${formatNumber(result.aggregatePerRun.tidesUsed.coral_character, 2)}</td><td>${formatInt(result.aggregate.tidesUsed.coral_character)}</td></tr>
      <tr><td>Forging Tides used (coral)</td><td>${formatNumber(result.aggregatePerRun.tidesUsed.coral_weapon, 2)}</td><td>${formatInt(result.aggregate.tidesUsed.coral_weapon)}</td></tr>
      <tr><td>Total Astrites converted</td><td>${formatInt(result.aggregatePerRun.astritesConverted)}</td><td>${formatInt(result.aggregate.astritesConverted)}</td></tr>
      <tr><td>Total Corals generated</td><td>${formatNumber(result.aggregatePerRun.coralsGenerated, 2)}</td><td>${formatInt(result.aggregate.coralsGenerated)}</td></tr>
      <tr>
		  <td data-tooltip="Average can be fractional across runs; total is always in 8-coral conversion blocks.">Corals spent</td>
		  <td>${formatNumber(coralSpentPerRun, 2)}</td>
		  <td>${formatInt(result.aggregate.coralsSpent)}</td>
	  </tr>
	  <tr><td data-tooltip="With coral conversion enabled, this should stay near unconvertible remainder.">Corals remaining</td><td>${formatNumber(result.aggregatePerRun.coralsRemaining, 2)}</td><td>${formatInt(result.aggregate.coralsRemaining)}</td></tr>
      <tr><td>Current state pull position</td><td>${formatInt(result.currentPositionPulls)}</td><td>-</td></tr>
      <tr><td>Maximum reachable pull scenario (observed)</td><td>${formatInt(result.maxObservedPulls)}</td><td>-</td></tr>
    </tbody>
  </table>`;
  bindStyledTooltips(b);

  const d = byId("debugOutput");
  d.textContent = [
    "Simulation model:",
    "- Character and weapon pity are independent (same soft pity table).",
    "- Character banner: 50/50 loss sets guaranteed next featured 5★.",
    "- Weapon banner: featured 5★ only.",
    "- 4★ pity tracked per banner; 10th pull guarantees 4★ unless a 5★ appears first.",
    "- Coral recursion: when enabled, corals are repeatedly converted at 8 corals = 1 tide in active banner context.",
    "- Deterministic Monte Carlo: PRNG seed is derived from normalized input + run index.",
    "- Non-rateup 4★ branch mixes characters and 4★ weapon outcomes.",
    "",
    "State transitions include pity updates, guarantee flips, and coral resource loop.",
    "",
    "Sample run trace (first iteration):",
    ...(result.sampleTrace.length ? result.sampleTrace : ["(No pulls occurred in sample run)"])
  ].join("\n");
}

function drawChart(result) {
  const canvas = byId("probabilityChart");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const pad = { left: 78, right: 22, top: 24, bottom: 52 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0b1222";
  ctx.fillRect(0, 0, w, h);

  const maxX = result.curve.length ? result.curve[result.curve.length - 1].x : 1;
  const xToPx = (x) => pad.left + (x / Math.max(maxX, 1)) * plotW;
  const yToPx = (y) => pad.top + (1 - y / 100) * plotH;
  const yAtX = (x) => {
    if (x < 0 || x > maxX) return 0;
    return result.curve[Math.round(x)]?.y ?? 0;
  };

  ctx.strokeStyle = "#2f436e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, h - pad.bottom);
  ctx.lineTo(w - pad.right, h - pad.bottom);
  ctx.stroke();

  ctx.fillStyle = "#b6c7f0";
  ctx.font = "12px Segoe UI";
  for (let pct = 0; pct <= 100; pct += 25) {
    const y = yToPx(pct);
    ctx.strokeStyle = "#1a2a49";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillText(`${pct}%`, 38, y + 4);
  }

  const xStep = Math.max(1, Math.round(maxX / 8));
  for (let x = 0; x <= maxX; x += xStep) {
    const px = xToPx(x);
    ctx.strokeStyle = "#1a2a49";
    ctx.beginPath();
    ctx.moveTo(px, pad.top);
    ctx.lineTo(px, h - pad.bottom);
    ctx.stroke();
    ctx.fillText(String(x), px - 8, h - pad.bottom + 18);
  }

  ctx.strokeStyle = "#57d68d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  result.curve.forEach((p, i) => {
    const px = xToPx(p.x);
    const py = yToPx(p.y);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  const markers = [
    { label: "P10", x: result.p10, color: "#f6c453" },
    { label: "Median", x: result.p50, color: "#5ab0ff" },
    { label: "P90", x: result.p90, color: "#ff8f8f" },
    { label: "50% point", x: result.fiftyPoint, color: "#d69fff" },
    { label: "Current pulls", x: result.currentPositionPulls, color: "#7de2b3" },
    { label: "Max observed", x: result.maxObservedPulls, color: "#f0f0f0" }
  ];

  result.guaranteeThresholds.forEach((x, i) => {
    markers.push({ label: `W${i + 1} guarantee`, x, color: "#9aa7c8" });
  });

  const markerPoints = [];
  for (const m of markers) {
    if (m.x === null || m.x === undefined || Number.isNaN(m.x)) continue;
    if (m.x < 0 || m.x > maxX) continue;
    const px = xToPx(m.x);
    const py = yToPx(yAtX(m.x));
    ctx.strokeStyle = m.color;
    ctx.setLineDash(m.label.includes("guarantee") ? [3, 3] : []);
    ctx.beginPath();
    ctx.moveTo(px, pad.top);
    ctx.lineTo(px, h - pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
    // Removed marker label text to prevent overlaps - label shown in tooltip on hover
    markerPoints.push({ ...m, px, py, valueY: yAtX(m.x) });
  }

  ctx.fillStyle = "#c9d6fa";
  ctx.fillText("Pulls", w / 2 - 14, h - 10);
  ctx.save();
  ctx.translate(18, h / 2 + 30);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Completion probability", 0, 0);
  ctx.restore();

  chartState.points = result.curve.map((p) => ({ x: xToPx(p.x), y: yToPx(p.y), pulls: p.x, prob: p.y }));
  chartState.markers = markerPoints;
  chartState.maxX = maxX;
  chartState.curve = result.curve;
  chartState.padLeft = pad.left;
  chartState.plotW = plotW;
}

function bindChartHover() {
  const canvas = byId("probabilityChart");
  const tooltip = byId("chartTooltip");
  const container = canvas.parentElement;

  canvas.addEventListener("mouseleave", () => {
    tooltip.style.display = "none";
  });

  canvas.addEventListener("mousemove", (event) => {
    if (!chartState.points.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const clampedX = Math.max(0, Math.min(canvas.width, x * (canvas.width / rect.width)));
    const clampedY = Math.max(0, Math.min(canvas.height, y * (canvas.height / rect.height)));

    let nearestMarker = null;
    let nearestMarkerDist = Infinity;
    for (const marker of chartState.markers) {
      const d = Math.hypot(clampedX - marker.px, clampedY - marker.py);
      if (d < nearestMarkerDist) {
        nearestMarkerDist = d;
        nearestMarker = marker;
      }
    }

    const pulls = Math.max(
      0,
      Math.min(
        chartState.maxX,
        Math.round(((clampedX - chartState.padLeft) / Math.max(chartState.plotW, 1)) * chartState.maxX)
      )
    );
    const curvePoint = chartState.curve[pulls] || chartState.curve[chartState.curve.length - 1];
    let text = `Pulls: ${curvePoint.x}<br/>Completion: ${formatNumber(curvePoint.y, 2)}%`;

    if (nearestMarker && nearestMarkerDist <= 16) {
      text += `<br/><strong>${nearestMarker.label}</strong>: ${nearestMarker.x} pulls (${formatNumber(nearestMarker.valueY, 2)}%)`;
    }

    tooltip.innerHTML = text;
    tooltip.style.display = "block";
    const localX = x + 12;
    const localY = y + 12;
    const maxLeft = rect.width - 190;
    const maxTop = rect.height - 76;
    tooltip.style.left = `${Math.max(8, Math.min(localX, maxLeft))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(localY, maxTop))}px`;
  });
}

function calculate() {
  const status = byId("statusText");
  const rawInput = normalizeStateFromUI();
  saveStateToStorage(rawInput);

  if (!rawInput.useAdvancedDefaults && !hasAdvancedChanges(rawInput)) {
    status.textContent = "Advanced assumptions are OFF, but advanced settings were not changed. Change advanced settings or enable defaults.";
    return;
  }

  const input = applyAdvancedDefaults(rawInput);

  if (!input.wishlist.length) {
    status.textContent = "Add at least one valid wishlist item (character/weapon).";
    renderWishlistTable(input, { itemProbabilities: [], guaranteeThresholds: [] });
    return;
  }

  status.textContent = `Running ${input.iterations.toLocaleString()} simulations...`;
  setTimeout(async () => {
    try {
      const result = await runMonteCarlo(input, (done, total) => {
        const pct = Math.floor((done / total) * 100);
        status.textContent = `Running ${total.toLocaleString()} simulations... ${pct}%`;
      });
      renderWishlistTable(input, result);
      renderSummary(input, result);
      drawChart(result);
      status.textContent = `Done. Completion chance: ${(result.completionRate * 100).toFixed(2)}%`;
    } catch (error) {
      status.textContent = `Calculation failed: ${error?.message || "unknown error"}`;
    }
  }, 20);
}

function bindStyledTooltips(scope = document) {
  const tooltip = document.getElementById("styledTooltip");
  if (!tooltip) return;

  scope.querySelectorAll("[data-tooltip]").forEach((el) => {
    if (el.dataset.tooltipBound === "1") return;
    el.dataset.tooltipBound = "1";

    el.addEventListener("mouseenter", () => {
      tooltip.innerHTML = el.dataset.tooltip || "";
      tooltip.style.display = "block";
    });

    el.addEventListener("mousemove", (e) => {
      tooltip.style.left = `${e.clientX + 12}px`;
      tooltip.style.top = `${e.clientY + 12}px`;
    });

    el.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
  });
}

function setupStyledTooltips() {
  let tooltip = document.getElementById("styledTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "styledTooltip";
    tooltip.className = "chart-tooltip";
    tooltip.style.position = "fixed";
    tooltip.style.zIndex = "10000";
    document.body.appendChild(tooltip);
  }
  bindStyledTooltips(document);
}

function init() {
  createDupeInputs("char-dupes", STANDARD_FIVE_STARS, "char");
  createDupeInputs("fourstar-dupes", FOUR_STAR_NAMES, "four");
  createRateupSelectors();
  writeStateToUI(loadStateFromStorage());
  byId("calculateBtn").addEventListener("click", calculate);
  byId("useAdvancedDefaults").addEventListener("change", toggleAdvancedFields);
  bindChartHover();

  byId("addCharacterItemBtn").addEventListener("click", () => setWishlist([...uiState.wishlist, "character"]));
  byId("addWeaponItemBtn").addEventListener("click", () => setWishlist([...uiState.wishlist, "weapon"]));
  byId("clearWishlistBtn").addEventListener("click", () => setWishlist([]));
  byId("wishlistEditor").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const index = Number(btn.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= uiState.wishlist.length) return;

    const next = [...uiState.wishlist];
    if (action === "delete") {
      next.splice(index, 1);
    } else if (action === "up" && index > 0) {
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
    } else if (action === "down" && index < next.length - 1) {
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
    }
    setWishlist(next);
  });

  if (window.lucide) window.lucide.createIcons();
  setupStyledTooltips();
}

init();
