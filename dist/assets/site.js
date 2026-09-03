const REGIONS = {
  us: "North America",
  eu: "Europe",
  asia: "Asia"
};

const MODES = {
  competitive: "Competitive",
  quickplay: "Quick Play"
};

const ROLE_ORDER = ["TANK", "DAMAGE", "SUPPORT"];
const ROLE_LABEL = {
  TANK: "Tank",
  DAMAGE: "Damage",
  SUPPORT: "Support"
};

const METRIC_LABEL = {
  winrate: "Win Rate",
  pickrate: "Pick Rate",
  banrate: "Ban Rate"
};

const FALLBACK_ERROR = "Data could not be loaded. Serve this folder with: python -m http.server";

function $(selector, root = document) {
  return root.querySelector(selector);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, digits = 1) {
  const number = numeric(value);
  return number === null ? "-" : number.toFixed(digits);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  });
}

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

function getComboHeroes(data, region, mode) {
  return (data && data[region] && data[region][mode]) || [];
}

function findHero(data, heroId, region, mode) {
  return getComboHeroes(data, region, mode).find((hero) => hero.id === heroId) || null;
}

function filterValues() {
  const params = new URLSearchParams(window.location.search);
  const region = REGIONS[params.get("region")] ? params.get("region") : "us";
  const mode = MODES[params.get("mode")] ? params.get("mode") : "competitive";
  return { region, mode };
}

function syncUrl(region, mode) {
  const url = new URL(window.location.href);
  url.searchParams.set("region", region);
  url.searchParams.set("mode", mode);
  window.history.replaceState(null, "", url.pathname + url.search);
}

function errorHtml(message) {
  return `<div class="error-banner">${escapeHtml(message)}</div>`;
}

function emptyHtml(message = "No data yet.") {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function regionModeLabel(region, mode) {
  return `${region.toUpperCase()} / ${MODES[mode] || mode}`;
}

let indexState = null;

async function loadIndex() {
  const regionSelect = $("#region");
  const modeSelect = $("#mode");
  if (!regionSelect || !modeSelect) return;
  const filters = filterValues();
  regionSelect.value = filters.region;
  modeSelect.value = filters.mode;
  regionSelect.addEventListener("change", () => {
    syncUrl(regionSelect.value, modeSelect.value);
    indexState.region = regionSelect.value;
    renderIndex();
  });
  modeSelect.addEventListener("change", () => {
    syncUrl(regionSelect.value, modeSelect.value);
    indexState.mode = modeSelect.value;
    renderIndex();
  });
  $("#groups").addEventListener("click", (event) => {
    const header = event.target.closest("th.sortable");
    if (!header) return;
    const key = header.dataset.key;
    if (indexState.sort.key === key) {
      indexState.sort.dir = indexState.sort.dir === "desc" ? "asc" : "desc";
    } else {
      indexState.sort.dir = key === "name" || key === "role" ? "asc" : "desc";
    }
    indexState.sort.key = key;
    renderIndex();
  });

  try {
    const data = await loadJson("data/latest.json");
    indexState = {
      data,
      region: filters.region,
      mode: filters.mode,
      sort: { key: "winrate", dir: "desc" }
    };
    renderIndex();
  } catch (error) {
    $("#groups").innerHTML = errorHtml(FALLBACK_ERROR);
  }
}

function sortValue(hero, key) {
  return hero[key];
}

function compareHeroes(a, b, sort) {
  const left = sortValue(a, sort.key);
  const right = sortValue(b, sort.key);
  if (left === right) return String(a.name).localeCompare(String(b.name));
  if (left == null) return 1;
  if (right == null) return -1;
  const result = typeof left === "number" ? left - right : String(left).localeCompare(String(right));
  return sort.dir === "desc" ? -result : result;
}

function sortedByRole(heroes, sort) {
  return heroes.slice().sort((a, b) => compareHeroes(a, b, sort));
}

function sortHeaderHtml(sort) {
  const columns = [
    { key: "name", label: "Hero", numeric: false },
    { key: "role", label: "Role", numeric: false },
    { key: "winrate", label: "Win Rate", numeric: true },
    { key: "pickrate", label: "Pick Rate", numeric: true },
    { key: "banrate", label: "Ban Rate", numeric: true }
  ];
  return columns
    .map((column) => {
      const active = sort.key === column.key;
      const mark = active ? (sort.dir === "desc" ? "\u2193" : "\u2191") : "\u2195";
      return `<th class="sortable${column.numeric ? " num" : ""}" data-key="${column.key}"><span>${column.label}</span> <span class="sort-mark" aria-hidden="true">${active ? mark : ""}</span></th>`;
    })
    .join("");
}

function heroRowHtml(hero, region, mode) {
  const href = `heroes/${encodeURIComponent(hero.id)}.html?region=${encodeURIComponent(region)}&mode=${encodeURIComponent(mode)}`;
  const subrole = hero.subrole ? `<span class="sub">${escapeHtml(hero.subrole)}</span>` : "";
  return `
    <tr>
      <td><a class="hero-cell" href="${href}">
        <img src="${escapeHtml(hero.portrait)}" alt="" loading="lazy" onerror="this.style.display='none'">
        <span><span class="name">${escapeHtml(hero.name)}</span><br>${subrole}</span>
      </a></td>
      <td><span class="role">${escapeHtml(hero.role)}</span></td>
      <td class="num">${formatNumber(hero.winrate)}%</td>
      <td class="num">${formatNumber(hero.pickrate)}%</td>
      <td class="num">${formatNumber(hero.banrate)}%</td>
    </tr>`;
}

function renderIndex() {
  if (!indexState) return;
  const heroes = getComboHeroes(indexState.data, indexState.region, indexState.mode);
  const capturedAt = indexState.data.capturedAt || "";
  const meta = $("#meta");
  if (meta) {
    meta.textContent = `${heroes.length} heroes in ${regionModeLabel(indexState.region, indexState.mode)}${capturedAt ? ` / ${formatTime(capturedAt)}` : ""}`;
  }
  if (!heroes.length) {
    $("#groups").innerHTML = emptyHtml("No heroes found for this region and mode.");
    return;
  }
  const roles = ROLE_ORDER.filter((role) => heroes.some((hero) => hero.role === role));
  roles.push(...heroes.map((hero) => hero.role).filter((role) => !roles.includes(role)));
  $("#groups").innerHTML = roles
    .map((role) => {
      const rows = sortedByRole(heroes.filter((hero) => hero.role === role), indexState.sort);
      return `
        <section class="group">
          <div class="group-head"><h2>${escapeHtml(ROLE_LABEL[role] || role)}</h2><span>${rows.length} heroes</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr>${sortHeaderHtml(indexState.sort)}</tr></thead>
              <tbody>${rows.map((hero) => heroRowHtml(hero, indexState.region, indexState.mode)).join("")}</tbody>
            </table>
          </div>
        </section>`;
    })
    .join("");
}

let detailState = null;

async function loadDetail() {
  const heroEl = document.querySelector("main[data-hero]");
  const heroId = heroEl ? heroEl.dataset.hero : "";
  if (!heroId) return;
  const filters = filterValues();
  try {
    const [latest, historyData, events] = await Promise.all([
      loadJson("../data/latest.json"),
      loadJson("../data/history.json"),
      loadJson("../data/patch-events.json")
    ]);
    detailState = {
      heroId,
      latest,
      history: Array.isArray(historyData) ? historyData : historyData.snapshots || [],
      events,
      region: filters.region,
      mode: filters.mode
    };
    renderDetail();
  } catch (error) {
    $("#detail-content").innerHTML = errorHtml(FALLBACK_ERROR);
  }
}

function renderDetail() {
  const hero = findHero(detailState.latest, detailState.heroId, detailState.region, detailState.mode);
  if (!hero) {
    $("#detail-content").innerHTML = emptyHtml("No current data for this hero.");
    return;
  }
  const title = document.title;
  document.title = `${hero.name} | OW Meta`;
  $("#detail-content").innerHTML = `
    <div class="detail-head">
      <img class="detail-portrait" src="${escapeHtml(hero.portrait)}" alt="" onerror="this.style.display='none'">
      <div class="detail-title">
        <div>
          <h1>${escapeHtml(hero.name)}</h1>
          <span class="role-chip">${escapeHtml(hero.role)}${hero.subrole ? ` / ${escapeHtml(hero.subrole)}` : ""}</span>
        </div>
      </div>
      <div class="detail-controls">
        <label class="field"><span>Region</span><select id="detail-region"></select></label>
        <label class="field"><span>Mode</span><select id="detail-mode"></select></label>
      </div>
    </div>
    <div class="metric-grid">
      <div class="metric-cell"><span class="metric-label">Win Rate</span><span class="metric-value">${formatNumber(hero.winrate)}%</span></div>
      <div class="metric-cell"><span class="metric-label">Pick Rate</span><span class="metric-value">${formatNumber(hero.pickrate)}%</span></div>
      <div class="metric-cell"><span class="metric-label">Ban Rate</span><span class="metric-value">${formatNumber(hero.banrate)}%</span></div>
      <div class="metric-cell"><span class="metric-label">Snapshot</span><span class="metric-value metric-sub">${escapeHtml(formatTime(detailState.latest.capturedAt || ""))}</span></div>
    </div>
    <section class="section">
      <div class="section-head"><h2>Trend</h2><span id="trend-count"></span></div>
      <div id="trend-content"></div>
    </section>
    <section class="section">
      <div class="section-head"><h2>Patch History</h2><span>${escapeHtml(hero.name)}</span></div>
      <div id="hero-patches"></div>
    </section>`;
  renderMetricDropdowns();
  renderTrend();
  renderHeroPatches();
}

function renderMetricDropdowns() {
  const regionSelect = $("#detail-region");
  const modeSelect = $("#detail-mode");
  regionSelect.innerHTML = Object.entries(REGIONS)
    .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)
    .join("");
  modeSelect.innerHTML = Object.entries(MODES)
    .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)
    .join("");
  regionSelect.value = detailState.region;
  modeSelect.value = detailState.mode;
  regionSelect.addEventListener("change", () => {
    syncUrl(regionSelect.value, modeSelect.value);
    detailState.region = regionSelect.value;
    detailState.mode = modeSelect.value;
    renderDetail();
  });
  modeSelect.addEventListener("change", () => {
    syncUrl(regionSelect.value, modeSelect.value);
    detailState.region = regionSelect.value;
    detailState.mode = modeSelect.value;
    renderDetail();
  });
}

function trendPoints() {
  return detailState.history
    .map((snapshot) => {
      const hero = findHero(snapshot, detailState.heroId, detailState.region, detailState.mode);
      if (!hero) return null;
      return {
        time: snapshot.capturedAt,
        winrate: numeric(hero.winrate),
        pickrate: numeric(hero.pickrate)
      };
    })
    .filter(Boolean);
}

function chartSvg(title, metric, color, points) {
  const values = points.map((point) => point[metric]).filter((value) => value !== null);
  if (values.length < 2) {
    return `<section class="chart-panel"><div class="chart-title"><h3>${title}</h3><span class="chart-color" style="background:${color}"></span></div>${emptyHtml("Not enough snapshots.")}</section>`;
  }
  const width = 680;
  const height = 240;
  const pad = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max === min ? 1 : max - min;
  const x = (index, count) => count <= 1 ? (width - pad * 2) / 2 + pad : pad + index * ((width - pad * 2) / (count - 1));
  const y = (value) => height - pad - ((value - min) / span) * (height - pad * 2);
  const line = values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index, values.length).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");
  const dots = values
    .map((value, index) => `<circle cx="${x(index, values.length).toFixed(1)}" cy="${y(value).toFixed(1)}" r="3.5" fill="${color}"/>`)
    .join("");
  const ticks = [min, min + (max - min) / 2, max];
  const grid = ticks
    .map((value) => `<line x1="${pad}" x2="${width - pad}" y1="${y(value).toFixed(1)}" y2="${y(value).toFixed(1)}" stroke="rgba(255,255,255,0.12)"/><text x="${width - pad - 4}" y="${y(value) + 3}" text-anchor="end" fill="#94a59d" font-size="10">${value.toFixed(1)}</text>`)
    .join("");
  return `<section class="chart-panel">
    <div class="chart-title"><h3>${title}</h3><span class="chart-color" style="background:${color}"></span></div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title} trend">
      ${grid}
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2.5"/>
      ${dots}
    </svg>
  </section>`;
}

function renderTrend() {
  const points = trendPoints();
  const count = $("#trend-count");
  if (count) count.textContent = `${points.length} snapshot${points.length === 1 ? "" : "s"}`;
  const content = $("#trend-content");
  if (!content) return;
  if (points.length < 2) {
    content.innerHTML = emptyHtml("Data accumulating. At least two snapshots are needed to draw a trend.");
    return;
  }
  content.innerHTML = `<div class="trend-grid">${chartSvg("Win Rate", "winrate", "#f2a45b", points)}${chartSvg("Pick Rate", "pickrate", "#7dd3fc", points)}</div>`;
}

function eventChangeHtml(event) {
  if (event.kind === "added" || event.kind === "removed") {
    return `<span class="metric">${event.kind === "added" ? "Added" : "Removed"}</span>`;
  }
  const metric = METRIC_LABEL[event.metric] || event.metric || "Metric";
  const before = formatNumber(event.before);
  const after = formatNumber(event.after);
  return `<span class="metric">${escapeHtml(metric)}</span> <span class="before">${before}%</span> &rarr; <span class="after">${after}%</span>`;
}

function deltaHtml(event) {
  const delta = numeric(event.delta);
  if (delta === null) return '<span class="delta-flat">-</span>';
  const cls = delta > 0 ? "delta-up" : "delta-down";
  return `<span class="${cls}">${delta > 0 ? "+" : ""}${formatNumber(delta)}</span>`;
}

function eventRowHtml(event) {
  return `<tr>
    <td>${escapeHtml(formatTime(event.time))}</td>
    <td>${escapeHtml(regionModeLabel(event.region || "", event.mode || ""))}</td>
    <td>${eventChangeHtml(event)}</td>
    <td>${deltaHtml(event)}</td>
  </tr>`;
}

function renderHeroPatches() {
  const content = $("#hero-patches");
  if (!content) return;
  const events = detailState.events
    .filter((event) => event.hero === detailState.heroId)
    .sort((a, b) => String(b.time).localeCompare(String(a.time)));
  if (!events.length) {
    content.innerHTML = emptyHtml("No patch changes recorded for this hero yet.");
    return;
  }
  content.innerHTML = `<div class="table-wrap"><table class="patch-table">
    <thead><tr><th>Time</th><th>Region / Mode</th><th>Change</th><th class="num">Delta</th></tr></thead>
    <tbody>${events.map(eventRowHtml).join("")}</tbody>
  </table></div>`;
}

async function loadPatches() {
  try {
    const events = await loadJson("data/patch-events.json");
    const sorted = events.slice().sort((a, b) => String(b.time).localeCompare(String(a.time)));
    const content = $("#patch-list");
    if (!sorted.length) {
      content.innerHTML = emptyHtml("No patch changes recorded yet.");
      return;
    }
    content.innerHTML = `<div class="table-wrap"><table class="patch-table">
      <thead><tr><th>Time</th><th>Hero</th><th>Region / Mode</th><th>Change</th><th class="num">Delta</th></tr></thead>
      <tbody>${sorted
        .map(
          (event) => `<tr>
            <td>${escapeHtml(formatTime(event.time))}</td>
            <td><a class="link-row" href="heroes/${encodeURIComponent(event.hero)}.html">${escapeHtml(event.name || event.hero)}</a></td>
            <td>${escapeHtml(regionModeLabel(event.region || "", event.mode || ""))}</td>
            <td>${eventChangeHtml(event)}</td>
            <td>${deltaHtml(event)}</td>
          </tr>`
        )
        .join("")}
    </tbody></table></div>`;
  } catch (error) {
    $("#patch-list").innerHTML = errorHtml(FALLBACK_ERROR);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const pageElement = document.querySelector("body[data-page], main[data-page]");
  const page = pageElement ? pageElement.dataset.page : "";
  if (page === "index") loadIndex();
  if (page === "detail") loadDetail();
  if (page === "patches") loadPatches();
});