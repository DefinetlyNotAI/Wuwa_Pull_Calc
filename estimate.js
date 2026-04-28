const ESTIMATE_STORAGE_KEY = "wuwaResourceEstimatorStateV1";

const DEFAULT_STATE = {
  targetBanner: "character",
  radiantTides: 0,
  forgingTides: 0,
  astrites: 0
};

function byId(id) {
  return document.getElementById(id);
}

function clampInt(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function loadState() {
  try {
    const raw = localStorage.getItem(ESTIMATE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeState(state) {
  byId("targetBanner").value = state.targetBanner === "weapon" ? "weapon" : "character";
  byId("radiantTides").value = state.radiantTides;
  byId("forgingTides").value = state.forgingTides;
  byId("astrites").value = state.astrites;
}

function readState() {
  return {
    targetBanner: byId("targetBanner").value === "weapon" ? "weapon" : "character",
    radiantTides: Math.max(0, clampInt(Number(byId("radiantTides").value), 0, Number.MAX_SAFE_INTEGER)),
    forgingTides: Math.max(0, clampInt(Number(byId("forgingTides").value), 0, Number.MAX_SAFE_INTEGER)),
    astrites: Math.max(0, clampInt(Number(byId("astrites").value), 0, Number.MAX_SAFE_INTEGER))
  };
}

function saveState(state) {
  localStorage.setItem(ESTIMATE_STORAGE_KEY, JSON.stringify(state));
}

function calculateDeterministicPulls(input) {
  const bannerTides = input.targetBanner === "character" ? input.radiantTides : input.forgingTides;
  const astritePulls = Math.floor(input.astrites / 160);
  const leftoverAstrites = input.astrites - (astritePulls * 160);
  return {
    bannerTides,
    astritePulls,
    totalPulls: bannerTides + astritePulls,
    leftoverAstrites
  };
}

function renderResults(result) {
  byId("resultTable").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Direct banner tides</td><td>${result.bannerTides}</td></tr>
        <tr><td>Pulls from astrites</td><td>${result.astritePulls}</td></tr>
        <tr><td>Total deterministic pulls</td><td>${result.totalPulls}</td></tr>
        <tr><td>Leftover astrites</td><td>${result.leftoverAstrites}</td></tr>
      </tbody>
    </table>
  `;
}

function init() {
  writeState(loadState());
  byId("calculateBtn").addEventListener("click", () => {
    const input = readState();
    saveState(input);
    const result = calculateDeterministicPulls(input);
    renderResults(result);
    byId("statusText").textContent = "Done.";
  });
  if (window.lucide) window.lucide.createIcons();
}

init();
