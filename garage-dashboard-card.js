/**
 * garage-dashboard-card.js
 * Garage Dashboard Card for Home Assistant
 * GitHub: https://github.com/robman2026/garage-dashboard-card
 * Version: 3.1.0
 *
 * Changelog v3.0.9:
 *  - Fix: doors locked state now respects car_doors_locked_when config option
 *    "on"  → binary_sensor "on" means locked (default for lock-type sensors)
 *    "off" → binary_sensor "off" means locked (for door-open sensors where on=unlocked)
 *    Configurable via visual editor toggle in Car tab
 *
 * Changelog v3.0.0:
 *  - Converted from vanilla HTMLElement to LitElement (same architecture as room-card)
 *  - Climate section: room-card compact tile style (52×52 SVG arc + value + label)
 *  - Configurable color stops for temperature and humidity (shared with room-card)
 *  - Car section: location/status badge, range, odometer, monthly distance,
 *    doors locked state, action buttons (Update Data, Flash Lights, Horn)
 *  - Visual editor: tab-based, searchable entity dropdowns, color stop editor,
 *    car section toggle with all entity fields
 *  - Uses room-card-stream sub-element for camera (if already registered)
 *    or falls back to ha-camera-stream directly
 */

// ── Inherit LitElement from existing HA element ───────────────────────────────
const LitElement = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const html = LitElement.prototype.html;
const css  = LitElement.prototype.css;

// ── Default color stops (same as room-card) ───────────────────────────────────
const GDC_DEFAULT_TEMP_STOPS = [
  { pos: 0,  color: "#2391FF" },
  { pos: 19, color: "#14FF6A" },
  { pos: 27, color: "#F8FF42" },
  { pos: 35, color: "#FF3502" },
  { pos: 50, color: "#FF3502" },
];

const GDC_DEFAULT_HUM_STOPS = [
  { pos: 0,  color: "#f97316" },
  { pos: 30, color: "#f97316" },
  { pos: 35, color: "#eab308" },
  { pos: 40, color: "#22c55e" },
  { pos: 60, color: "#22c55e" },
  { pos: 70, color: "#eab308" },
  { pos: 80, color: "#ef4444" },
  { pos: 100,color: "#ef4444" },
];

// ── Shared interpolation (hex stops → rgb) ────────────────────────────────────
function _gdcInterpolate(stops, value) {
  if (!stops || stops.length === 0) return "#94a3b8";
  const parse = (hex) => {
    const c = hex.replace("#", "");
    const f = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
    return { r: parseInt(f.slice(0,2),16), g: parseInt(f.slice(2,4),16), b: parseInt(f.slice(4,6),16) };
  };
  const sorted  = [...stops].sort((a, b) => a.pos - b.pos);
  const clamped = Math.max(sorted[0].pos, Math.min(sorted[sorted.length-1].pos, value));
  let lo = sorted[0], hi = sorted[sorted.length-1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (clamped >= sorted[i].pos && clamped <= sorted[i+1].pos) { lo = sorted[i]; hi = sorted[i+1]; break; }
  }
  const f  = (clamped - lo.pos) / ((hi.pos - lo.pos) || 1);
  const lc = parse(lo.color), hc = parse(hi.color);
  return `rgb(${Math.round(lc.r+f*(hc.r-lc.r))},${Math.round(lc.g+f*(hc.g-lc.g))},${Math.round(lc.b+f*(hc.b-lc.b))})`;
}

function _gdcTempColor(value, stops) {
  return _gdcInterpolate(stops && stops.length ? stops : GDC_DEFAULT_TEMP_STOPS, value);
}
function _gdcHumColor(value, stops) {
  return _gdcInterpolate(stops && stops.length ? stops : GDC_DEFAULT_HUM_STOPS, value);
}

// ─────────────────────────────────────────────
// MAIN CARD
// ─────────────────────────────────────────────
class GarageDashboardCard extends LitElement {
  static get properties() {
    return {
      _hass:   {},
      _config: {},
      _ticks:  { state: true },
    };
  }

  static getConfigElement() {
    return document.createElement("garage-dashboard-card-editor");
  }

  static getStubConfig() {
    return {
      title: "Garaj",
      temp_sensor: "sensor.garage_temperature",
      humidity_sensor: "sensor.garage_humidity",
      temp_label: "TEMPERATURE",
      hum_label: "HUMIDITY",
      temp_min: 0,
      temp_max: 50,
      temp_color_stops: JSON.parse(JSON.stringify(GDC_DEFAULT_TEMP_STOPS)),
      hum_color_stops:  JSON.parse(JSON.stringify(GDC_DEFAULT_HUM_STOPS)),
      cover_entity: "cover.usa_la_garaj",
      cover_name: "Ușa la Garaj",
      cover_simple: "cover.garage_door_simple",
      cover_simple_name: "Garage Door",
      light_entity: "light.lumina_garaj",
      light_name: "Lumina Garaj",
      camera_entity: "camera.garage",
      door_sensor: "binary_sensor.usa_garaj",
      door_sensor_name: "Ușa garaj",
      motion_sensor: "binary_sensor.miscare",
      motion_sensor_name: "Mișcare",
      door_ctrl: "cover.usa_garaj_ctrl",
      door_ctrl_name: "Ușa CTRL",
      toggle_columns: 2,
      sensor_columns: 3,
      car_stat_columns: 4,
      show_car: false,
      car_name: "My Car",
      car_image_type: "none",
      car_image_data: "",
      car_image_url: "",
      car_image_position: "right",
      car_image_height: 175,
      car_location_entity: "",
      car_range_entity: "",
      car_odometer_entity: "",
      car_monthly_distance_entity: "",
      car_monthly_trips_entity: "",
      car_doors_entity: "",
      car_doors_locked_when: "off",
      car_update_entity: "",
      car_flash_entity: "",
      car_horn_entity: "",
      frosted_glass: false,
      frosted_opacity: 0.52,
      frosted_blur: 22,
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = {
      title: "Garaj",
      temp_label: "TEMPERATURE",
      hum_label: "HUMIDITY",
      temp_min: 0,
      temp_max: 50,
      temp_color_stops: JSON.parse(JSON.stringify(GDC_DEFAULT_TEMP_STOPS)),
      hum_color_stops:  JSON.parse(JSON.stringify(GDC_DEFAULT_HUM_STOPS)),
      toggle_columns: 2,
      sensor_columns: 3,
      car_stat_columns: 4,
      show_car: false,
      car_name: "My Car",
      car_image_type: "none",
      car_image_data: "",
      car_image_url: "",
      car_image_position: "right",
      car_image_height: 175,
      car_doors_locked_when: "off",
      frosted_glass: false,
      frosted_opacity: 0.52,
      frosted_blur: 22,
      ...config,
    };
  }

  set hass(hass) {
    this._hass = hass;
  }

  updated(changedProps) {
    if (changedProps.has('_config')) {
      this._applyFrostedVars();
    }
  }

  _applyFrostedVars() {
    const cfg = this._config;
    if (cfg && cfg.frosted_glass) {
      const opacity = Math.min(0.9, Math.max(0.1, parseFloat(cfg.frosted_opacity) || 0.52));
      const blur    = Math.min(40,  Math.max(4,   parseFloat(cfg.frosted_blur)    || 22));
      this.style.setProperty('--gdc-fg-bg',  'rgba(8,14,30,' + opacity + ')');
      this.style.setProperty('--gdc-fg-blur', blur + 'px');
    } else {
      this.style.removeProperty('--gdc-fg-bg');
      this.style.removeProperty('--gdc-fg-blur');
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this._tickInterval = setInterval(() => { this._ticks = Date.now(); }, 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._tickInterval);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _stateOf(entityId) {
    if (!entityId || !this._hass) return null;
    return this._hass.states[entityId] || null;
  }

  _val(entityId, fallback = "unavailable") {
    const s = this._stateOf(entityId);
    return s ? s.state : fallback;
  }

  _attr(entityId, attr, fallback = null) {
    const s = this._stateOf(entityId);
    return s && s.attributes[attr] !== undefined ? s.attributes[attr] : fallback;
  }

  _friendlyName(entityId) {
    return this._attr(entityId, "friendly_name") || entityId;
  }

  _agoStr(entityId) {
    const s = this._stateOf(entityId);
    if (!s) return "";
    const diff = Math.floor((Date.now() - new Date(s.last_changed).getTime()) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  _moreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      bubbles: true, composed: true, detail: { entityId },
    }));
  }

  _callService(domain, service, entityId) {
    if (!this._hass || !entityId) return;
    this._hass.callService(domain, service, { entity_id: entityId });
  }

  // ── Climate tile (room-card compact style) ────────────────────────────────────

  _renderClimateTile(entityId, label, min, max, type) {
    const stateObj  = this._stateOf(entityId);
    const rawVal    = stateObj ? stateObj.state : null;
    const numVal    = parseFloat(rawVal);
    const isNum     = !isNaN(numVal) && rawVal !== null;

    const tStops = this._config.temp_color_stops || GDC_DEFAULT_TEMP_STOPS;
    const hStops = this._config.hum_color_stops  || GDC_DEFAULT_HUM_STOPS;

    let color, displayVal, unit;
    if (type === "temperature") {
      color      = isNum ? _gdcTempColor(numVal, tStops) : "#2391FF";
      displayVal = isNum ? numVal.toFixed(1) : "--";
      unit       = this._attr(entityId, "unit_of_measurement") || "°C";
    } else {
      color      = isNum ? _gdcHumColor(numVal, hStops) : "#60a5fa";
      displayVal = isNum ? numVal.toFixed(0) : "--";
      unit       = this._attr(entityId, "unit_of_measurement") || "%";
    }

    const R            = 20;
    const circumference = 2 * Math.PI * R; // ~125.66
    const pct          = isNum ? Math.min(1, Math.max(0, (numVal - min) / ((max - min) || 1))) : 0;
    const dashOffset   = circumference - pct * circumference;

    return html`
      <div class="sensor-tile" style="cursor:pointer" @click="${() => this._moreInfo(entityId)}">
        <div class="gauge-wrap">
          <svg width="52" height="52" viewBox="0 0 52 52" style="transform:rotate(-90deg)">
            <circle cx="26" cy="26" r="${R}"
              fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="3.5"/>
            <circle cx="26" cy="26" r="${R}"
              fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"
              stroke-dasharray="${circumference.toFixed(1)}"
              stroke-dashoffset="${dashOffset.toFixed(2)}"
              style="filter:drop-shadow(0 0 4px ${color})"/>
          </svg>
          <div class="gauge-center">
            <div class="gauge-val-sm" style="color:${color}">${displayVal}</div>
            <div class="gauge-unit-sm">${unit}</div>
          </div>
        </div>
        <div class="sensor-info">
          <div class="sensor-value" style="color:${color}">
            ${displayVal}<span class="sensor-unit">${unit}</span>
          </div>
          <div class="sensor-label">${label.toUpperCase()}</div>
        </div>
      </div>
    `;
  }

  // ── Cover row ─────────────────────────────────────────────────────────────────

  _doorStatusColor(state) {
    if (state === "open" || state === "on")             return "#ef4444";
    if (state === "opening" || state === "closing")     return "#f59e0b";
    return "#22c55e";
  }

  _renderCover() {
    const eid   = this._config.cover_entity;
    if (!eid) return "";
    const state = this._val(eid);
    const pos   = this._attr(eid, "current_position", 0);
    const ago   = this._agoStr(eid);
    const name  = this._config.cover_name || "Ușa la Garaj";
    const label = state.charAt(0).toUpperCase() + state.slice(1);
    const color = this._doorStatusColor(state);

    return html`
      <div class="section cover-section">
        <div class="cover-row">
          <div class="entity-icon" @click="${() => this._moreInfo(eid)}" style="cursor:pointer">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 20H4V9H2v13a2 2 0 002 2h16a2 2 0 002-2V9h-2v11zM22 7H2l2-4h16l2 4zM12 2L7 7h10L12 2z"/>
            </svg>
          </div>
          <div class="entity-details" @click="${() => this._moreInfo(eid)}" style="cursor:pointer;flex:1">
            <div class="entity-name">${name}</div>
            <div class="entity-sub" style="color:${color}">${label} · ${pos}% · ${ago}</div>
          </div>
        </div>
        <div class="cover-seg">
          <button class="seg-btn seg-open" title="Open"
            @click="${() => this._callService("cover", "open_cover", eid)}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18h16v2H4zm8-16L4 9h4v7h8V9h4z"/></svg><span>Open</span>
          </button>
          <button class="seg-btn seg-stop" title="Stop"
            @click="${() => this._callService("cover", "stop_cover", eid)}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg><span>Stop</span>
          </button>
          <button class="seg-btn seg-close" title="Close"
            @click="${() => this._callService("cover", "close_cover", eid)}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v2H4zm8 16l8-7h-4V7H8v6H4z"/></svg><span>Close</span>
          </button>
        </div>
      </div>
    `;
  }

  // ── Camera ────────────────────────────────────────────────────────────────────

  _renderCamera() {
    const eid = this._config.camera_entity;
    if (!eid) return "";
    const stateObj = this._stateOf(eid);

    // Use room-card-stream if registered (prevents re-init flicker)
    const useStream = customElements.get("room-card-stream") && stateObj;

    if (!stateObj) {
      return html`
        <div class="section">
          <div class="camera-box camera-unavail">
            <span>Camera unavailable</span>
          </div>
        </div>
      `;
    }

    if (useStream) {
      return html`
        <div class="section">
          <div class="camera-box">
            <room-card-stream
              .hass=${this._hass}
              .stateObj=${stateObj}
              .label=${"Garage"}
              .entityId=${eid}
              @camera-more-info="${(e) => this._moreInfo(e.detail.entityId)}"
            ></room-card-stream>
          </div>
        </div>
      `;
    }

    // Fallback: inline ha-camera-stream
    return html`
      <div class="section">
        <div class="camera-box" style="cursor:pointer" @click="${() => this._moreInfo(eid)}">
          <garage-cam-stream
            .hass=${this._hass}
            .stateObj=${stateObj}
          ></garage-cam-stream>
          <div class="cam-overlay">
            <span class="cam-label">GARAGE</span>
            <span class="cam-live">● LIVE</span>
          </div>
        </div>
      </div>
    `;
  }

  // ── Toggle tiles (cover simple + light) ───────────────────────────────────────

  _renderToggle(entityId, label, iconPath) {
    if (!entityId) return "";
    const state = this._val(entityId);
    const isOn  = state === "open" || state === "on";
    const domain = entityId.split(".")[0];
    const svc = domain === "cover"
      ? (isOn ? "close_cover" : "open_cover")
      : (isOn ? "turn_off" : "turn_on");
    const svcDomain = domain === "cover" ? "cover" : "homeassistant";
    // iconPath is a plain SVG path string — build SVG via innerHTML on a wrapper
    const svgHtml = `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="${iconPath}"/></svg>`;

    return html`
      <div class="toggle-card ${isOn ? "active" : ""}"
           @click="${() => this._callService(svcDomain, svc, entityId)}">
        <div class="toggle-icon" .innerHTML="${svgHtml}"></div>
        <div class="toggle-label">${label}</div>
        <div class="toggle-state">${isOn ? "ON" : "OFF"}</div>
      </div>
    `;
  }

  // ── Sensor chip ───────────────────────────────────────────────────────────────

  _renderSensorChip(entityId, label, iconPath) {
    if (!entityId) return "";
    const state  = this._val(entityId);
    const ago    = this._agoStr(entityId);
    const isActive = state === "on" || state === "open" || state === "opening" || state === "detected";
    const svgHtml = `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="${iconPath}"/></svg>`;

    return html`
      <div class="sensor-chip ${isActive ? "active" : ""}"
           style="cursor:pointer" @click="${() => this._moreInfo(entityId)}">
        <div class="chip-icon" .innerHTML="${svgHtml}"></div>
        <div class="sensor-chip-name">${label}</div>
        <div class="sensor-chip-time">${ago}</div>
      </div>
    `;
  }

  // ── Car section ───────────────────────────────────────────────────────────────

  _renderCar() {
    const cfg = this._config;
    if (!cfg.show_car) return "";

    // Location / status
    const locState    = this._val(cfg.car_location_entity, null);
    const isHome      = locState === "home" || locState === "Home";
    const locLabel    = locState ? (locState.charAt(0).toUpperCase() + locState.slice(1)) : "Unknown";
    const locColor    = isHome ? "#22c55e" : "#f59e0b";
    const locBg       = isHome ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)";
    const locBorder   = isHome ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)";

    // Stats
    const rangeVal    = this._val(cfg.car_range_entity, null);
    const rangeUnit   = cfg.car_range_entity ? this._attr(cfg.car_range_entity, "unit_of_measurement") || "km" : "km";
    const odomVal     = this._val(cfg.car_odometer_entity, null);
    const odomUnit    = cfg.car_odometer_entity ? this._attr(cfg.car_odometer_entity, "unit_of_measurement") || "km" : "km";
    const monthlyVal  = this._val(cfg.car_monthly_distance_entity, null);
    const monthlyUnit = cfg.car_monthly_distance_entity ? this._attr(cfg.car_monthly_distance_entity, "unit_of_measurement") || "km" : "km";
    const tripsVal    = this._val(cfg.car_monthly_trips_entity, null);
    const doorsState  = this._val(cfg.car_doors_entity, null);
    const doorsStateLc = doorsState ? doorsState.toLowerCase() : null;
    const lockedWhen  = (cfg.car_doors_locked_when || "off").toLowerCase();
    const doorsLocked = doorsStateLc !== null && (
      doorsStateLc === lockedWhen ||
      doorsStateLc === "locked" ||
      doorsStateLc === "lock"
    );
    const doorsColor  = doorsLocked ? "#22c55e" : "#ef4444";
    const doorsLabel  = doorsState ? (doorsLocked ? "Locked" : "Unlocked") : "--";
    const doorsAgo    = cfg.car_doors_entity ? this._agoStr(cfg.car_doors_entity) : "";

    // Image — supports upload (base64) and URL
    const imgType   = cfg.car_image_type || "none";
    const imgPos    = cfg.car_image_position || "right";
    const imgHeight = cfg.car_image_height || 175;
    // Resolve the actual src to display
    const imgSrc    = imgType === "upload" && cfg.car_image_data
                        ? cfg.car_image_data           // base64 data URI
                        : imgType === "url" && cfg.car_image_url
                          ? cfg.car_image_url           // remote / local URL
                          : "";
    const imgUrl    = imgSrc; // alias kept for _carImage() helper below

    // Format number helper
    const fmt = (val) => {
      if (val === null || val === "unavailable") return "--";
      const n = parseFloat(val);
      return isNaN(n) ? val : n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    };

    // ── Stat tiles (shared between both layout modes) ─────────────────────────
    const _statTiles = () => html`
      ${cfg.car_range_entity ? html`
        <div class="car-stat" @click="${() => this._moreInfo(cfg.car_range_entity)}" style="cursor:pointer">
          <div class="car-stat-val">${fmt(rangeVal)} <span class="car-stat-unit">${rangeUnit}</span></div>
          <div class="car-stat-lbl">Range (AC On)</div>
        </div>
      ` : ""}
      ${cfg.car_odometer_entity ? html`
        <div class="car-stat" @click="${() => this._moreInfo(cfg.car_odometer_entity)}" style="cursor:pointer">
          <div class="car-stat-val">${fmt(odomVal)} <span class="car-stat-unit">${odomUnit}</span></div>
          <div class="car-stat-lbl">Odometer</div>
        </div>
      ` : ""}
      ${cfg.car_monthly_distance_entity ? html`
        <div class="car-stat" @click="${() => this._moreInfo(cfg.car_monthly_distance_entity)}" style="cursor:pointer">
          <div class="car-stat-val">${fmt(monthlyVal)} <span class="car-stat-unit">${monthlyUnit}</span></div>
          <div class="car-stat-lbl">Monthly distance</div>
          ${tripsVal && tripsVal !== "unavailable" ? html`
            <div class="car-stat-sub">${tripsVal} trips this month</div>
          ` : ""}
        </div>
      ` : ""}
      ${cfg.car_doors_entity ? html`
        <div class="car-stat" @click="${() => this._moreInfo(cfg.car_doors_entity)}" style="cursor:pointer">
          <div class="car-stat-val" style="color:${doorsColor}">${doorsLabel}</div>
          <div class="car-stat-lbl">Doors</div>
          ${doorsAgo ? html`<div class="car-stat-sub">${doorsAgo}</div>` : ""}
        </div>
      ` : ""}
    `;

    // ── Image element ─────────────────────────────────────────────────────────
    const _carImage = (cls) => imgUrl ? html`
      <div class="${cls}" style="${cls === "car-img-banner" ? "height:" + imgHeight + "px" : ""}">
        <img src="${imgUrl}" alt="${cfg.car_name || "Car"}"
             @error="${(e) => { e.target.style.display="none"; }}"
             style="width:100%;height:100%;object-fit:contain;display:block;border-radius:10px"/>
      </div>
    ` : "";

    // ── Action buttons ────────────────────────────────────────────────────────
    const _actions = () => (cfg.car_update_entity || cfg.car_flash_entity || cfg.car_horn_entity) ? html`
      <div class="car-actions">
        ${cfg.car_update_entity ? html`
          <button class="car-action-btn"
            @click="${() => this._callService("button", "press", cfg.car_update_entity)}">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="color:#60a5fa;flex-shrink:0">
              <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            <div class="car-action-lbl">Update Data</div>
          </button>
        ` : ""}
        ${cfg.car_flash_entity ? html`
          <button class="car-action-btn"
            @click="${() => this._callService("button", "press", cfg.car_flash_entity)}">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="color:#60a5fa;flex-shrink:0">
              <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
            </svg>
            <div class="car-action-lbl">Flash Lights</div>
          </button>
        ` : ""}
        ${cfg.car_horn_entity ? html`
          <button class="car-action-btn"
            @click="${() => this._callService("button", "press", cfg.car_horn_entity)}">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="color:#60a5fa;flex-shrink:0">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
            </svg>
            <div class="car-action-lbl">Honk Horn</div>
          </button>
        ` : ""}
      </div>
    ` : "";

    return html`
      <div class="section car-section">

        <!-- Car header -->
        <div class="car-header">
          <div class="car-icon-box">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-8l-2.08-5.99zM6.5 16a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm11 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>
          </div>
          <span class="car-name">${(cfg.car_name || "My Car").toUpperCase()}</span>
          ${cfg.car_location_entity ? html`
            <span class="car-location-badge"
                  style="color:${locColor};background:${locBg};border:1px solid ${locBorder}"
                  @click="${() => this._moreInfo(cfg.car_location_entity)}">${locLabel}</span>
          ` : ""}
        </div>

        <!-- Option B: image right, stats left -->
        ${imgUrl && imgPos === "right" ? html`
          <div class="car-layout-side">
            <div class="car-side-stats">
              ${_statTiles()}
            </div>
            ${_carImage("car-img-side")}
          </div>
        ` : html`
          <!-- Option A: full-width banner image above stats, OR no image -->
          ${imgUrl && imgPos === "top" ? _carImage("car-img-banner") : ""}
          <div class="car-stats" style="grid-template-columns:repeat(${cfg.car_stat_columns||4},1fr)">
            ${_statTiles()}
          </div>
        `}

        <!-- Action buttons -->
        ${_actions()}
      </div>
    `;
  }

  // ── MAIN RENDER ───────────────────────────────────────────────────────────────

  render() {
    if (!this._config) return html``;
    const cfg  = this._config;
    const coverState = this._val(cfg.cover_entity);
    const isOpen = coverState === "open" || coverState === "opening";

    const coverSimpleIcon = "M20 20H4V9H2v13a2 2 0 002 2h16a2 2 0 002-2V9h-2v11zM22 7H2l2-4h16l2 4zM12 2L7 7h10L12 2z";
    const lightIcon       = "M12 2a7 7 0 017 7c0 2.62-1.44 4.9-3.57 6.14L15 17H9l-.43-1.86A7 7 0 015 9a7 7 0 017-7zm3 18H9v1a1 1 0 001 1h4a1 1 0 001-1v-1z";
    const doorIcon        = "M20 20H4V9H2v13a2 2 0 002 2h16a2 2 0 002-2V9h-2v11zM22 7H2l2-4h16l2 4zM12 2L7 7h10L12 2z";
    const motionIcon      = "M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z";
    const ctrlIcon        = "M20 20H4V9H2v13a2 2 0 002 2h16a2 2 0 002-2V9h-2v11zM22 7H2l2-4h16l2 4zM12 2L7 7h10L12 2z";

    return html`
      <ha-card>
        <div class="${this._config.frosted_glass ? 'card card-frosted' : 'card'}">
          <div class="card-body ${cfg.show_car ? 'has-car' : ''}">

          <!-- LEFT COLUMN: everything up to the Car -->
          <div class="col-main">

          <!-- Header -->
          <div class="card-header">
            <svg class="header-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 20H5V8H3v13a2 2 0 002 2h14a2 2 0 002-2V8h-2v11zm1-16H4l-2 2h20l-2-2zM12 3L7 8h10l-5-5z"/>
            </svg>
            <span class="card-title">${cfg.title || "Garaj"}</span>
            <div class="status-dot ${isOpen ? "dot-open" : "dot-closed"}"></div>
          </div>

          <!-- Climate -->
          <div class="section">
            <div class="climate-row">
              ${cfg.temp_sensor ? this._renderClimateTile(
                cfg.temp_sensor,
                cfg.temp_label || "TEMPERATURE",
                cfg.temp_min ?? 0,
                cfg.temp_max ?? 50,
                "temperature"
              ) : ""}
              ${cfg.humidity_sensor ? this._renderClimateTile(
                cfg.humidity_sensor,
                cfg.hum_label || "HUMIDITY",
                0,
                100,
                "humidity"
              ) : ""}
            </div>
          </div>

          <!-- Cover control -->
          ${this._renderCover()}

          <!-- Camera -->
          ${this._renderCamera()}

          <!-- Toggles -->
          <div class="section">
            <div class="toggles-row" style="grid-template-columns:repeat(${cfg.toggle_columns||2},1fr)">
              ${this._renderToggle(cfg.cover_simple, cfg.cover_simple_name || "Garage Door", coverSimpleIcon)}
              ${this._renderToggle(cfg.light_entity, cfg.light_name || "Lumina Garaj", lightIcon)}
            </div>
          </div>

          <!-- Sensors -->
          <div class="section">
            <div class="sensors-row" style="grid-template-columns:repeat(${cfg.sensor_columns||3},1fr)">
              ${this._renderSensorChip(cfg.door_sensor,  cfg.door_sensor_name  || "Ușa garaj",  doorIcon)}
              ${this._renderSensorChip(cfg.motion_sensor,cfg.motion_sensor_name || "Mișcare",    motionIcon)}
              ${this._renderSensorChip(cfg.door_ctrl,    cfg.door_ctrl_name     || "Ușa CTRL",   ctrlIcon)}
            </div>
          </div>

          </div><!-- /col-main -->

          <!-- RIGHT COLUMN: the Car -->
          <div class="col-car">
          ${this._renderCar()}
          </div><!-- /col-car -->

          </div><!-- /card-body -->
        </div>
      </ha-card>
    `;
  }

  // ── STYLES ────────────────────────────────────────────────────────────────────

  static get styles() {
    return css`
      :host { display: block; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }

      ha-card { background: transparent; box-shadow: none; border: none; }
      .card {
        background: radial-gradient(140% 100% at 0% 0%, #1a1410 0%, #050505 60%);
        border-radius: 18px;
        overflow: hidden;
        color: #f4ead2;
        box-shadow: 0 0 0 1px rgba(255,191,89,0.25), 0 4px 30px rgba(0,0,0,0.7), 0 0 36px rgba(212,160,23,0.12);
        border: 1px solid transparent;
        container-type: inline-size;
      }

      /* ── Responsive layout ── */
      /* Mobile / narrow: single stacked column (default). */
      .card-body { display: block; }
      .col-main, .col-car { min-width: 0; }
      /* Desktop / wide card: split into two columns —
         everything up to the Car on the left, the Car on the right. */
      @container (min-width: 640px) {
        .card-body.has-car {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.95fr);
          align-items: stretch;
        }
        .card-body.has-car .col-car {
          border-left: 1px solid rgba(255,191,89,0.18);
        }
        .card-body.has-car .col-car .car-section {
          border-top: none;
          height: 100%;
        }
      }

      /* ── Header ── */
      .card-header {
        display: flex; align-items: center; gap: 10px;
        padding: 14px 16px 11px;
        border-bottom: 1px solid rgba(255,191,89,0.18);
        background: linear-gradient(180deg, rgba(255,191,89,0.06), transparent);
      }
      .header-icon { width: 20px; height: 20px; color: #ffc857; flex-shrink: 0; filter: drop-shadow(0 0 4px rgba(255,200,87,0.6)); }
      .card-title { font-size: 1rem; font-weight: 700; letter-spacing: .1em; color: #ffd98a; flex: 1; text-transform: uppercase; text-shadow: 0 0 12px rgba(255,200,87,0.35); }
      .status-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
      .dot-open   { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,0.7); }
      .dot-closed { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.6); }

      /* ── Section wrapper ── */
      .section { padding: 10px 14px; }
      .section + .section { border-top: 1px solid rgba(255,191,89,0.12); }

      /* ── Climate tiles (room-card style) ── */
      .climate-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .sensor-tile {
        background: rgba(255,255,255,0.025); border-radius: 14px; padding: 10px;
        display: flex; align-items: center; gap: 10px; min-width: 0;
        border: 1px solid rgba(255,191,89,0.22);
        box-shadow: inset 0 0 14px rgba(255,191,89,0.04);
        transition: all 0.2s;
      }
      .sensor-tile:hover { background: rgba(255,191,89,0.06); border-color: rgba(255,191,89,0.55); box-shadow: 0 0 16px rgba(255,191,89,0.18); }
      .gauge-wrap { position: relative; width: 52px; height: 52px; flex-shrink: 0; }
      .gauge-center {
        position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
        display: flex; flex-direction: column; align-items: center; pointer-events: none;
      }
      .gauge-val-sm  { font-size: 10px; font-weight: 700; line-height: 1; }
      .gauge-unit-sm { font-size: 6px; color: rgba(255,217,138,0.55); }
      .sensor-info   { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
      .sensor-value  { font-size: 18px; font-weight: 700; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sensor-unit   { font-size: 11px; font-weight: 400; }
      .sensor-label  { font-size: 9px; letter-spacing: 1.4px; color: rgba(255,217,138,0.45); text-transform: uppercase; margin-top: 2px; }

      /* ── Cover row ── */
      .cover-section { border-top: 1px solid rgba(255,191,89,0.12); }
      .cover-row { display: flex; align-items: center; gap: 10px; }
      .entity-icon {
        width: 34px; height: 34px; background: rgba(255,255,255,0.03); border-radius: 10px;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #ffc857;
        border: 1px solid rgba(255,191,89,0.3); box-shadow: 0 0 10px rgba(255,191,89,0.12);
      }
      .entity-icon svg { width: 18px; height: 18px; }
      .entity-name { font-size: .82rem; font-weight: 600; color: #f4ead2; }
      .entity-sub  { font-size: .7rem; margin-top: 1px; }
      .entity-details { min-width: 0; }
      .entity-name, .entity-sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .cover-seg {
        display: grid; grid-template-columns: 1fr 0.8fr 1fr; margin-top: 12px;
        border: 1px solid rgba(255,191,89,0.35); border-radius: 14px; overflow: hidden;
        background: rgba(255,255,255,0.02); box-shadow: 0 0 18px rgba(255,191,89,0.1);
      }
      .seg-btn {
        display: flex; align-items: center; justify-content: center; gap: 7px;
        height: 54px; border: none; background: transparent; cursor: pointer;
        font-size: .85rem; font-weight: 600; color: #e8d2a0; transition: background 0.15s;
      }
      .seg-btn svg { width: 20px; height: 20px; }
      .seg-btn + .seg-btn { border-left: 1px solid rgba(255,191,89,0.2); }
      .seg-btn:hover  { background: rgba(255,191,89,0.08); }
      .seg-btn:active { background: rgba(255,191,89,0.14); }
      .seg-open  { color: #22c55e; }
      .seg-stop  { color: #f59e0b; }
      .seg-close { color: #ef4444; }

      /* ── Camera ── */
      .camera-box {
        border-radius: 14px; overflow: hidden; position: relative;
        background: #050505; border: 1px solid rgba(255,191,89,0.25);
      }
      room-card-stream, garage-cam-stream { display: block; width: 100%; }
      .cam-overlay {
        position: absolute; bottom: 0; left: 0; right: 0;
        padding: 6px 10px;
        background: linear-gradient(transparent, rgba(0,0,0,0.7));
        display: flex; justify-content: space-between; align-items: center;
      }
      .cam-label { font-size: .6rem; color: #ffd98a; letter-spacing: .08em; text-transform: uppercase; }
      .cam-live  { font-size: .58rem; color: #f87171; border: 1px solid rgba(248,113,113,.4); padding: 1px 5px; border-radius: 3px; font-weight: 600; }
      .camera-unavail { display: flex; align-items: center; justify-content: center; padding: 20px; color: rgba(255,217,138,0.3); font-size: .75rem; }

      /* ── Toggles ── */
      .toggles-row { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }
      .toggle-card {
        background: rgba(255,255,255,0.025); border-radius: 14px; padding: 11px 10px;
        display: flex; flex-direction: column; align-items: center; gap: 5px;
        border: 1px solid rgba(255,191,89,0.22); cursor: pointer; transition: all 0.2s;
        -webkit-tap-highlight-color: transparent;
      }
      .toggle-card:hover { background: rgba(255,191,89,0.06); }
      .toggle-card:active { transform: scale(0.97); }
      .toggle-card.active { border-color: #ffc857; background: rgba(255,191,89,0.1); box-shadow: 0 0 18px rgba(255,191,89,0.25); }
      .toggle-icon { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: rgba(255,217,138,0.4); }
      .toggle-card.active .toggle-icon { color: #ffc857; }
      .toggle-icon svg { width: 18px; height: 18px; }
      .toggle-label { font-size: .65rem; color: rgba(255,217,138,0.6); text-align: center; }
      .toggle-state { font-size: .62rem; color: rgba(255,217,138,0.3); font-weight: 600; }
      .toggle-card.active .toggle-state { color: #ffc857; }

      /* ── Sensor chips ── */
      .sensors-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; }
      .sensor-chip {
        background: rgba(255,255,255,0.025); border-radius: 12px; padding: 8px 6px;
        display: flex; flex-direction: column; align-items: center; gap: 3px;
        border: 1px solid rgba(255,191,89,0.22); transition: all 0.2s;
      }
      .sensor-chip:hover { background: rgba(255,191,89,0.06); }
      .sensor-chip.active { border-color: #ffc857; background: rgba(255,191,89,0.1); box-shadow: 0 0 14px rgba(255,191,89,0.2); }
      .sensor-chip svg { color: rgba(255,217,138,0.4); }
      .sensor-chip.active svg { color: #ffc857; }
      .chip-icon { display:flex; align-items:center; justify-content:center; }
      .sensor-chip-name { font-size: .6rem; color: rgba(255,217,138,0.6); text-align: center; font-weight: 600; }
      .sensor-chip-time { font-size: .56rem; color: rgba(255,217,138,0.3); text-align: center; }
      .sensor-chip.active .sensor-chip-name { color: #ffd98a; }

      /* ── Car section ── */
      .car-section { border-top: 1px solid rgba(255,191,89,0.12); }
      .car-header  { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }

      /* ── Car image layouts ── */
      .car-layout-side { display: flex; gap: 8px; align-items: stretch; margin-bottom: 8px; }
      .car-side-stats  { display: flex; flex-direction: column; gap: 7px; flex: 1; min-width: 0; }
      .car-img-side    {
        width: 140px; flex-shrink: 0;
        background: radial-gradient(120% 120% at 20% 0%, #1a1410 0%, #050505 100%);
        border-radius: 14px; border: 1px solid rgba(255,191,89,0.22);
        display: flex; align-items: center; justify-content: center; overflow: hidden;
      }
      .car-img-side img { width: 100%; height: 100%; object-fit: contain; }
      .car-img-banner  {
        width: 100%;
        background: radial-gradient(120% 120% at 20% 0%, #1a1410 0%, #050505 100%);
        border-radius: 14px; border: 1px solid rgba(255,191,89,0.22);
        overflow: hidden; margin-bottom: 8px;
        display: flex; align-items: center; justify-content: center;
      }
      .car-img-banner img { width: 100%; height: 100%; object-fit: contain; }
      .car-icon-box {
        width: 32px; height: 32px; background: rgba(255,255,255,0.03); border-radius: 10px;
        display: flex; align-items: center; justify-content: center; color: #ffc857; flex-shrink: 0;
        border: 1px solid rgba(255,191,89,0.3);
      }
      .car-name { font-size: .85rem; font-weight: 700; color: #f4ead2; flex: 1; letter-spacing: .04em; }
      .car-location-badge {
        font-size: .62rem; font-weight: 700; padding: 3px 9px; border-radius: 20px;
        cursor: pointer; flex-shrink: 0;
      }
      .car-stats {
        display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-bottom: 8px;
      }
      .car-stat {
        background: rgba(255,255,255,0.025); border-radius: 12px; padding: 9px 10px;
        border: 1px solid rgba(255,191,89,0.2); transition: background 0.15s;
      }
      .car-stat:hover { background: rgba(255,191,89,0.06); }
      .car-stat-val  { font-size: .9rem; font-weight: 700; color: #f4ead2; line-height: 1; }
      .car-stat-unit { font-size: .65rem; color: rgba(255,217,138,0.5); font-weight: 400; }
      .car-stat-lbl  { font-size: .58rem; color: rgba(255,217,138,0.35); text-transform: uppercase; letter-spacing: .05em; margin-top: 3px; }
      .car-stat-sub  { font-size: .62rem; color: rgba(255,217,138,0.5); margin-top: 1px; }
      .car-actions   { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
      .car-action-btn {
        background: rgba(255,255,255,0.025); border: 1px solid rgba(255,191,89,0.22); border-radius: 12px;
        padding: 8px 6px; display: flex; flex-direction: column; align-items: center; gap: 4px;
        cursor: pointer; transition: all 0.15s; font-family: inherit;
        -webkit-tap-highlight-color: transparent;
      }
      .car-action-btn svg { color: #ffc857; }
      .car-action-btn:hover { background: rgba(255,191,89,0.08); border-color: #ffc857; box-shadow: 0 0 14px rgba(255,191,89,0.2); }
      .car-action-btn:active { transform: scale(0.95); }
      .car-action-lbl { font-size: .6rem; color: rgba(255,217,138,0.55); text-align: center; }

      /* ── Frosted Glass (activated by .card-frosted) ── */
      :host {
        --gdc-fg-bg: rgba(8,14,30,0.52);
        --gdc-fg-blur: 22px;
      }
      .card-frosted {
        background: var(--gdc-fg-bg) !important;
        backdrop-filter: blur(var(--gdc-fg-blur)) saturate(180%) !important;
        -webkit-backdrop-filter: blur(var(--gdc-fg-blur)) saturate(180%) !important;
        border: 1px solid rgba(255,255,255,0.09) !important;
        box-shadow: 0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07) !important;
      }
      .card-frosted::before { display: none !important; }
      /* Climate sensor tiles */
      .card-frosted .sensor-tile {
        background: rgba(255,255,255,0.05) !important;
        backdrop-filter: blur(var(--gdc-fg-blur)) !important;
        -webkit-backdrop-filter: blur(var(--gdc-fg-blur)) !important;
        border-color: rgba(255,255,255,0.1) !important;
      }
      .card-frosted .sensor-tile:hover { background: rgba(255,255,255,0.09) !important; }
      /* Cover entity icon */
      .card-frosted .entity-icon {
        background: rgba(255,255,255,0.06) !important;
      }
      /* Cover control segmented bar */
      .card-frosted .cover-seg {
        background: rgba(255,255,255,0.05) !important;
        border-color: rgba(255,255,255,0.12) !important;
      }
      .card-frosted .seg-btn + .seg-btn { border-left-color: rgba(255,255,255,0.12) !important; }
      .card-frosted .seg-btn:hover { background: rgba(255,255,255,0.1) !important; }
      /* Toggle cards */
      .card-frosted .toggle-card {
        background: rgba(255,255,255,0.05) !important;
        backdrop-filter: blur(var(--gdc-fg-blur)) !important;
        -webkit-backdrop-filter: blur(var(--gdc-fg-blur)) !important;
      }
      .card-frosted .toggle-card:hover { background: rgba(255,255,255,0.09) !important; }
      .card-frosted .toggle-card.active { background: rgba(255,191,89,0.12) !important; border-color: #ffc857 !important; }
      /* Sensor chips */
      .card-frosted .sensor-chip {
        background: rgba(255,255,255,0.05) !important;
        backdrop-filter: blur(var(--gdc-fg-blur)) !important;
        -webkit-backdrop-filter: blur(var(--gdc-fg-blur)) !important;
      }
      .card-frosted .sensor-chip:hover { background: rgba(255,255,255,0.09) !important; }
      .card-frosted .sensor-chip.active { background: rgba(255,191,89,0.1) !important; border-color: #ffc857 !important; }
      /* Car stat tiles */
      .card-frosted .car-stat {
        background: rgba(255,255,255,0.05) !important;
        backdrop-filter: blur(var(--gdc-fg-blur)) !important;
        -webkit-backdrop-filter: blur(var(--gdc-fg-blur)) !important;
        border-color: rgba(255,255,255,0.1) !important;
      }
      .card-frosted .car-stat:hover { background: rgba(255,255,255,0.09) !important; }
      /* Car action buttons */
      .card-frosted .car-action-btn {
        background: rgba(255,255,255,0.05) !important;
        border-color: rgba(255,255,255,0.12) !important;
      }
      .card-frosted .car-action-btn:hover { background: rgba(255,191,89,0.1) !important; border-color: #ffc857 !important; }
      /* Car icon box */
      .card-frosted .car-icon-box { background: rgba(255,255,255,0.06) !important; }

      /* ── Just HA Dashboard design adoption ──────────────────────────────
         Gated on --user-* tokens (defined only by the Just HA theme). Falls
         back to the card's original look on every other dashboard/theme. */
      .card {
        background: var(--user-glow-amber, transparent), var(--user-ink-750, radial-gradient(140% 100% at 0% 0%, #1a1410 0%, #050505 60%)) !important;
        border: 1px solid var(--user-line, transparent) !important;
        border-radius: var(--user-radius-lg, 18px) !important;
      }
    `;
  }

  getCardSize() { return 7; }
}

// ─────────────────────────────────────────────
// INLINE CAMERA STREAM (fallback when room-card-stream not available)
// ─────────────────────────────────────────────
class GarageCamStream extends LitElement {
  static get properties() {
    return { hass: {}, stateObj: {} };
  }

  updated(changedProps) {
    if (!changedProps.has("stateObj") && !changedProps.has("hass")) return;
    const stream = this.shadowRoot.querySelector("ha-camera-stream");
    if (!stream) return;
    if (stream._lastStateObj === this.stateObj && stream._lastHass === this.hass) return;
    stream._lastStateObj = this.stateObj;
    stream._lastHass     = this.hass;
    stream.hass     = this.hass;
    stream.stateObj = this.stateObj;
    if (typeof stream.requestUpdate === "function") stream.requestUpdate();
  }

  render() {
    if (!this.stateObj) return html``;
    return html`<ha-camera-stream allow-exoplayer muted playsinline></ha-camera-stream>`;
  }

  static get styles() {
    return css`
      :host { display: block; }
      ha-camera-stream { width: 100%; display: block; max-height: 350px; object-fit: cover; --video-border-radius: 0; }
    `;
  }
}

// ─────────────────────────────────────────────
// EDITOR ELEMENT
// ─────────────────────────────────────────────
class GarageDashboardCardEditor extends LitElement {
  static get properties() {
    return {
      hass:          {},
      _config:       { state: true },
      _openSections: { state: true },
    };
  }

  constructor() {
    super();
    this._openSections = new Set(["general"]);
  }

  setConfig(config) {
    this._config = JSON.parse(JSON.stringify(config));
  }

  _fire(config) {
    const ev = new Event("config-changed", { bubbles: true, composed: true });
    ev.detail = { config };
    this.dispatchEvent(ev);
  }

  _set(key, value) {
    this._config = { ...this._config, [key]: value };
    this._fire(this._config);
  }

  _toggleSection(id) {
    const next = new Set(this._openSections);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this._openSections = next;
  }

  // ── Accordion section ─────────────────────────────────────────────────────────

  _accordion(id, icon, label, content) {
    const open = this._openSections.has(id);
    return html`
      <div class="accordion ${open ? "open" : ""}">
        <div class="accordion-header" @click="${() => this._toggleSection(id)}">
          <ha-icon class="accordion-icon" icon="${icon}"></ha-icon>
          <span class="accordion-label">${label}</span>
          <ha-icon class="accordion-chevron" icon="${open ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
        </div>
        ${open ? html`<div class="accordion-body">${content}</div>` : ""}
      </div>
    `;
  }

  // ── Universal ha-selector wrapper ─────────────────────────────────────────────

  _sel(label, value, selector, onChange, helper) {
    const normalized =
      value === undefined || value === null
        ? "boolean" in selector ? false : "number" in selector ? 0 : ""
        : value;
    return html`
      <ha-selector
        .hass="${this.hass}"
        .selector="${selector}"
        .value="${normalized}"
        .label="${label}"
        .helper="${helper || ""}"
        @value-changed="${(e) => onChange(e.detail.value)}"
      ></ha-selector>
    `;
  }

  // ── Color stop editor ─────────────────────────────────────────────────────────

  _renderColorStops(stopsKey, unit, defaults) {
    const stops = this._config[stopsKey] && this._config[stopsKey].length
      ? this._config[stopsKey]
      : JSON.parse(JSON.stringify(defaults));

    const sorted = [...stops].sort((a, b) => a.pos - b.pos);
    const gradientBar = sorted.length > 1
      ? `linear-gradient(to right,${sorted.map((s) => s.color).join(",")})`
      : (sorted[0]?.color || "#334155");

    const _updateStop = (idx, field, value) => {
      const ns = stops.map((s, i) =>
        i === idx ? { ...s, [field]: field === "pos" ? parseFloat(value) || 0 : value } : s
      );
      this._set(stopsKey, ns);
    };

    const _removeStop = (idx) => {
      if (stops.length <= 2) return;
      this._set(stopsKey, stops.filter((_, i) => i !== idx));
    };

    const _addStop = () => {
      const last = [...stops].sort((a, b) => a.pos - b.pos).pop();
      const newPos = Math.min((last?.pos || 0) + 10, unit === "°C" ? 60 : 100);
      this._set(stopsKey, [...stops, { pos: newPos, color: "#94a3b8" }]);
    };

    return html`
      <div class="gradient-bar" style="background:${gradientBar}"></div>
      ${stops.map((stop, idx) => html`
        <div class="stop-row">
          <div class="stop-dot" style="background:${stop.color}"></div>
          <input class="stop-val-input" type="number"
            .value="${stop.pos}"
            @input="${(e) => _updateStop(idx, "pos", e.target.value)}" />
          <span class="stop-unit-lbl">${unit}</span>
          <span class="stop-arrow">→</span>
          <div class="color-swatch-wrap">
            <input type="color" class="color-swatch-input"
              .value="${stop.color}"
              @input="${(e) => _updateStop(idx, "color", e.target.value)}" />
          </div>
          <button class="btn-remove-sm" ?disabled="${stops.length <= 2}"
            @click="${() => _removeStop(idx)}">✕</button>
        </div>
      `)}
      <div class="stop-actions">
        <button class="btn-add sm" @click="${_addStop}">+ Add stop</button>
        <button class="btn-reset" @click="${() => this._set(stopsKey, JSON.parse(JSON.stringify(defaults)))}">↺ Reset</button>
      </div>
    `;
  }

  // ── SECTION: General ─────────────────────────────────────────────────────────

  _sectionGeneral() {
    const cfg = this._config;
    return html`
      <div class="sub-section">
        <div class="sub-title">Card Identity</div>
        ${this._sel("Card Title", cfg.title, { text: {} }, (v) => this._set("title", v))}
      </div>
      <div class="sub-section">
        <div class="sub-title">Climate Sensors</div>
        ${this._sel("Temperature Entity", cfg.temp_sensor, { entity: { domain: "sensor" } }, (v) => this._set("temp_sensor", v))}
        ${this._sel("Temperature Label", cfg.temp_label, { text: {} }, (v) => this._set("temp_label", v))}
        <div class="two-col">
          ${this._sel("Temp Min (°C)", cfg.temp_min ?? 0, { number: { min: -50, max: 100, step: 1 } }, (v) => this._set("temp_min", v))}
          ${this._sel("Temp Max (°C)", cfg.temp_max ?? 60, { number: { min: -50, max: 200, step: 1 } }, (v) => this._set("temp_max", v))}
        </div>
        ${this._sel("Humidity Entity", cfg.humidity_sensor, { entity: { domain: "sensor" } }, (v) => this._set("humidity_sensor", v))}
        ${this._sel("Humidity Label", cfg.hum_label, { text: {} }, (v) => this._set("hum_label", v))}
      </div>
    `;
  }

  // ── SECTION: Appearance ───────────────────────────────────────────────────────

  _sectionAppearance() {
    const cfg = this._config;
    return html`
      ${this._sel("Frosted Glass Mode", cfg.frosted_glass, { boolean: {} }, (v) => this._set("frosted_glass", v))}
      ${cfg.frosted_glass ? html`
        <p class="hint">
          The card background and all inner tiles use a translucent blur effect.
          Works best when a dynamic wallpaper is visible behind Home Assistant.
        </p>
        ${this._sel("Glass Opacity", cfg.frosted_opacity ?? 0.52,
          { number: { min: 0.1, max: 0.9, step: 0.01, mode: "slider" } },
          (v) => this._set("frosted_opacity", v))}
        ${this._sel("Blur Strength (px)", cfg.frosted_blur ?? 22,
          { number: { min: 4, max: 40, step: 1, mode: "slider" } },
          (v) => this._set("frosted_blur", v))}
      ` : ""}
    `;
  }

  // ── SECTION: Colors ───────────────────────────────────────────────────────────

  _sectionColors() {
    return html`
      <div class="sub-section">
        <div class="sub-title">Temperature Color Stops</div>
        <p class="hint">Enter °C value and pick a color. Arc and value text interpolate smoothly between stops. Min 2 stops.</p>
        ${this._renderColorStops("temp_color_stops", "°C", GDC_DEFAULT_TEMP_STOPS)}
      </div>
      <div class="sub-section">
        <div class="sub-title">Humidity Color Stops</div>
        <p class="hint">Enter % value and pick a color. Default: orange (dry) → green (40–60%) → red (humid).</p>
        ${this._renderColorStops("hum_color_stops", "%", GDC_DEFAULT_HUM_STOPS)}
      </div>
    `;
  }

  // ── SECTION: Devices ─────────────────────────────────────────────────────────

  _sectionDevices() {
    const cfg = this._config;
    return html`
      <div class="sub-section">
        <div class="sub-title">Main Cover (with position control)</div>
        ${this._sel("Cover Entity", cfg.cover_entity, { entity: { domain: "cover" } }, (v) => this._set("cover_entity", v))}
        ${this._sel("Cover Display Name", cfg.cover_name, { text: {} }, (v) => this._set("cover_name", v))}
      </div>
      <div class="sub-section">
        <div class="sub-title">Simple Cover Toggle</div>
        ${this._sel("Entity", cfg.cover_simple, { entity: { domain: "cover" } }, (v) => this._set("cover_simple", v))}
        ${this._sel("Display Name", cfg.cover_simple_name, { text: {} }, (v) => this._set("cover_simple_name", v))}
      </div>
      <div class="sub-section">
        <div class="sub-title">Light</div>
        ${this._sel("Entity", cfg.light_entity, { entity: {} }, (v) => this._set("light_entity", v))}
        ${this._sel("Display Name", cfg.light_name, { text: {} }, (v) => this._set("light_name", v))}
      </div>
      <div class="sub-section">
        <div class="sub-title">Camera</div>
        ${this._sel("Camera Entity", cfg.camera_entity, { entity: { domain: "camera" } }, (v) => this._set("camera_entity", v))}
      </div>
      <div class="sub-section">
        <div class="sub-title">Sensor Chips Row</div>
        ${this._sel("Door Sensor", cfg.door_sensor, { entity: {} }, (v) => this._set("door_sensor", v))}
        ${this._sel("Door Sensor Name", cfg.door_sensor_name, { text: {} }, (v) => this._set("door_sensor_name", v))}
        ${this._sel("Motion Sensor", cfg.motion_sensor, { entity: { domain: "binary_sensor" } }, (v) => this._set("motion_sensor", v))}
        ${this._sel("Motion Sensor Name", cfg.motion_sensor_name, { text: {} }, (v) => this._set("motion_sensor_name", v))}
        ${this._sel("Door Control Entity", cfg.door_ctrl, { entity: {} }, (v) => this._set("door_ctrl", v))}
        ${this._sel("Door Control Name", cfg.door_ctrl_name, { text: {} }, (v) => this._set("door_ctrl_name", v))}
      </div>
    `;
  }

  // ── SECTION: Car ─────────────────────────────────────────────────────────────

  _sectionCar() {
    const cfg = this._config;
    return html`
      <div class="sub-section">
        <div class="sub-title">Layout</div>
        ${this._sel("Car Stats Columns", String(cfg.car_stat_columns || 4),
          { select: { options: ["1","2","3","4"] } },
          (v) => this._set("car_stat_columns", parseInt(v)),
          "Columns for Range, Odometer, Monthly Distance, Doors tiles")}
      </div>
      <div class="sub-section">
        <div class="sub-title">Car Widget</div>
        ${this._sel("Show Car Section", cfg.show_car, { boolean: {} }, (v) => this._set("show_car", v))}
        ${cfg.show_car ? html`
          ${this._sel("Car Display Name", cfg.car_name, { text: {} }, (v) => this._set("car_name", v))}
        ` : ""}
      </div>
      ${cfg.show_car ? html`
        <div class="sub-section">
          <div class="sub-title">Car Image</div>
          ${this._sel("Image Type", cfg.car_image_type || "none",
            { select: { options: [
              { value: "none",   label: "None" },
              { value: "upload", label: "Upload Image" },
              { value: "url",    label: "Image URL" },
            ] } },
            (v) => this._set("car_image_type", v),
            "Uploaded images are stored as base64 in the card config")}

          ${(cfg.car_image_type || "none") === "upload" ? html`
            ${cfg.car_image_data ? html`
              <div class="img-preview-box">
                <div class="img-preview-inner">
                  <img class="img-preview-img" src="${cfg.car_image_data}" alt="Car image">
                  <div class="img-preview-actions">
                    <button class="img-action-btn" title="Replace image"
                      @click="${() => this.shadowRoot.querySelector("#carImgFileInput").click()}">↑</button>
                    <button class="img-action-btn img-action-remove" title="Remove image"
                      @click="${() => this._set("car_image_data", "")}">✕</button>
                  </div>
                </div>
                <div class="img-meta-bar"><span class="img-meta-name">Image uploaded · base64</span></div>
              </div>
            ` : html`
              <div class="upload-area"
                @click="${() => this.shadowRoot.querySelector("#carImgFileInput").click()}">
                <div class="upload-icon">🖼️</div>
                <div class="upload-text">Click to choose an image</div>
                <div class="upload-sub">JPG, PNG, WEBP · max 2 MB recommended</div>
              </div>
            `}
            <input type="file" id="carImgFileInput" accept="image/*" style="display:none"
              @change="${(e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => this._set("car_image_data", ev.target.result);
                reader.readAsDataURL(file);
              }}" />
          ` : ""}

          ${(cfg.car_image_type || "none") === "url" ? html`
            ${this._sel("Image URL", cfg.car_image_url, { text: {} },
              (v) => this._set("car_image_url", v),
              "Use a public URL or a path like /local/car.png")}
          ` : ""}

          ${(cfg.car_image_type || "none") !== "none" ? html`
            ${this._sel("Image Position", cfg.car_image_position || "right",
              { select: { options: [
                { value: "right", label: "Right — beside stats (Option B)" },
                { value: "top",   label: "Top — full width banner (Option A)" },
              ] } },
              (v) => this._set("car_image_position", v))}
            ${(cfg.car_image_position || "right") === "top" ? html`
              ${this._sel("Banner Height (px)", cfg.car_image_height ?? 175,
                { number: { min: 50, max: 500, step: 5 } },
                (v) => this._set("car_image_height", v))}
            ` : ""}
          ` : ""}
        </div>

        <div class="sub-section">
          <div class="sub-title">Location & Status</div>
          ${this._sel("Location / Device Tracker Entity", cfg.car_location_entity,
            { entity: {} }, (v) => this._set("car_location_entity", v))}
        </div>

        <div class="sub-section">
          <div class="sub-title">Stats</div>
          ${this._sel("Range Sensor (km remaining)", cfg.car_range_entity, { entity: { domain: "sensor" } }, (v) => this._set("car_range_entity", v))}
          ${this._sel("Odometer Sensor (total km)", cfg.car_odometer_entity, { entity: { domain: "sensor" } }, (v) => this._set("car_odometer_entity", v))}
          ${this._sel("Monthly Distance Sensor", cfg.car_monthly_distance_entity, { entity: { domain: "sensor" } }, (v) => this._set("car_monthly_distance_entity", v))}
          ${this._sel("Monthly Trips Sensor", cfg.car_monthly_trips_entity, { entity: { domain: "sensor" } }, (v) => this._set("car_monthly_trips_entity", v))}
          ${this._sel("Doors Locked Sensor / Entity", cfg.car_doors_entity, { entity: {} }, (v) => this._set("car_doors_entity", v))}
          ${cfg.car_doors_entity ? html`
            ${this._sel("Door Lock Logic", cfg.car_doors_locked_when || "on",
              { select: { options: [
                { value: "on",  label: "Locked when: ON (lock sensor — default)" },
                { value: "off", label: "Locked when: OFF (door-open binary sensor)" },
              ] } },
              (v) => this._set("car_doors_locked_when", v))}
          ` : ""}
        </div>

        <div class="sub-section">
          <div class="sub-title">Action Buttons</div>
          <p class="hint">These should be button.* entities. Pressing them calls button.press.</p>
          ${this._sel("Update Data Button", cfg.car_update_entity, { entity: { domain: "button" } }, (v) => this._set("car_update_entity", v))}
          ${this._sel("Flash Lights Button", cfg.car_flash_entity, { entity: { domain: "button" } }, (v) => this._set("car_flash_entity", v))}
          ${this._sel("Honk Horn Button", cfg.car_horn_entity, { entity: { domain: "button" } }, (v) => this._set("car_horn_entity", v))}
        </div>
      ` : ""}
    `;
  }

  render() {
    if (!this._config) return html``;
    return html`
      <div class="editor-root">
        ${this._accordion("general",    "mdi:home",           "General",    this._sectionGeneral())}
        ${this._accordion("appearance", "mdi:palette",        "Appearance", this._sectionAppearance())}
        ${this._accordion("colors",     "mdi:palette-swatch", "Colors",     this._sectionColors())}
        ${this._accordion("devices",    "mdi:garage",         "Devices",    this._sectionDevices())}
        ${this._accordion("car",        "mdi:car",            "Car",        this._sectionCar())}
      </div>
    `;
  }

  static get styles() {
    return css`
      :host { display: block; }
      .editor-root { display: flex; flex-direction: column; }

      /* ── Accordion ── */
      .accordion { border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.12)); }
      .accordion:last-child { border-bottom: none; }
      .accordion-header {
        display: flex; align-items: center; gap: 12px;
        padding: 12px 16px; cursor: pointer;
        transition: background 0.15s; user-select: none;
      }
      .accordion-header:hover { background: rgba(var(--rgb-primary-color, 249,115,22), 0.06); }
      .accordion.open > .accordion-header { background: rgba(var(--rgb-primary-color, 249,115,22), 0.08); }
      .accordion-icon { color: var(--primary-color, #03a9f4); --mdc-icon-size: 22px; flex-shrink: 0; }
      .accordion-label {
        flex: 1; font-size: 0.78rem; font-weight: 600;
        letter-spacing: 0.08em; text-transform: uppercase;
        color: var(--primary-text-color);
      }
      .accordion-chevron { color: var(--secondary-text-color); --mdc-icon-size: 20px; flex-shrink: 0; }
      .accordion-body {
        padding: 8px 16px 16px;
        display: flex; flex-direction: column;
        background: var(--secondary-background-color);
      }

      /* ── Sub-sections ── */
      .sub-section { margin-bottom: 16px; }
      .sub-section:last-child { margin-bottom: 0; }
      .sub-title {
        font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.08em; color: var(--primary-color, #03a9f4);
        margin-bottom: 4px; padding-bottom: 4px;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.12));
      }
      .hint { font-size: 0.73rem; color: var(--secondary-text-color); margin: 4px 0 8px; line-height: 1.5; }

      /* ── ha-selector spacing ── */
      ha-selector { display: block; margin-bottom: 8px; }

      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; }

      /* ── Color stop editor ── */
      .gradient-bar { height: 10px; border-radius: 5px; margin: 4px 0 10px; border: 1px solid var(--divider-color); }
      .stop-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
      .stop-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.15); }
      .stop-val-input { width: 62px; flex: none; padding: 5px 7px; font-size: 0.78rem; border: 1px solid var(--divider-color); border-radius: 6px; background: var(--secondary-background-color); color: var(--primary-text-color); }
      .stop-unit-lbl { font-size: 0.72rem; color: var(--secondary-text-color); flex-shrink: 0; width: 18px; }
      .stop-arrow { font-size: 0.75rem; color: var(--secondary-text-color); flex-shrink: 0; }
      .color-swatch-wrap { width: 32px; height: 28px; border-radius: 5px; border: 1px solid var(--divider-color); overflow: hidden; flex-shrink: 0; }
      .color-swatch-input { width: 200%; height: 200%; margin: -25%; border: none; cursor: pointer; padding: 0; }
      .stop-actions { display: flex; gap: 8px; margin-top: 4px; }

      /* ── Car image upload ── */
      .upload-area {
        border: 1.5px dashed var(--divider-color); border-radius: 10px;
        padding: 20px 14px; text-align: center;
        background: rgba(255,255,255,0.02); cursor: pointer;
        transition: all 0.2s; margin: 4px 0 8px;
      }
      .upload-area:hover { border-color: var(--primary-color); background: rgba(3,169,244,0.04); }
      .upload-icon { font-size: 1.5rem; display: block; margin-bottom: 5px; opacity: 0.45; }
      .upload-text { font-size: 0.78rem; color: var(--secondary-text-color); font-weight: 500; }
      .upload-sub  { font-size: 0.64rem; color: var(--disabled-text-color); margin-top: 3px; }
      .img-preview-box { margin: 4px 0 8px; border-radius: 10px; overflow: hidden; background: var(--secondary-background-color); border: 1px solid var(--divider-color); }
      .img-preview-inner { position: relative; width: 100%; height: 130px; display: flex; align-items: center; justify-content: center; }
      .img-preview-img { max-width: 100%; max-height: 100%; object-fit: contain; }
      .img-preview-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 5px; }
      .img-action-btn {
        width: 26px; height: 26px; border-radius: 6px;
        background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
        border: 1px solid rgba(255,255,255,0.12);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; color: rgba(255,255,255,0.75); font-size: 0.72rem;
        transition: all 0.15s; font-family: inherit;
      }
      .img-action-btn:hover { background: rgba(99,179,237,0.25); border-color: #60a5fa; color: #fff; }
      .img-action-remove:hover { background: rgba(239,68,68,0.3); border-color: #ef4444; color: #ef4444; }
      .img-meta-bar { padding: 5px 10px; background: rgba(0,0,0,0.2); font-size: 0.6rem; color: var(--disabled-text-color); border-top: 1px solid rgba(255,255,255,0.05); }
      .img-meta-name { color: var(--secondary-text-color); font-weight: 600; }

      .btn-add { width: 100%; padding: 8px; font-size: 0.78rem; font-weight: 600; border: 1px dashed var(--primary-color); border-radius: 6px; background: transparent; color: var(--primary-color); cursor: pointer; }
      .btn-add.sm { width: auto; padding: 6px 10px; font-size: 0.72rem; }
      .btn-remove-sm { padding: 2px 5px; font-size: 0.68rem; border: 1px solid var(--error-color, #ef4444); border-radius: 4px; background: transparent; color: var(--error-color, #ef4444); cursor: pointer; flex-shrink: 0; }
      .btn-remove-sm:disabled { opacity: 0.3; cursor: not-allowed; }
      .btn-reset { padding: 6px 10px; font-size: 0.72rem; font-weight: 600; border: 1px solid var(--divider-color); border-radius: 6px; background: transparent; color: var(--secondary-text-color); cursor: pointer; }
    `;
  }
}

// ── REGISTER ──────────────────────────────────────────────────────────────────
if (!customElements.get("garage-cam-stream")) {
  customElements.define("garage-cam-stream", GarageCamStream);
}
customElements.define("garage-dashboard-card", GarageDashboardCard);
customElements.define("garage-dashboard-card-editor", GarageDashboardCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "garage-dashboard-card",
  name: "Garage Dashboard Card",
  description: "Comprehensive garage card — climate gauges, cover control, camera, toggles, sensors, and optional car widget.",
  preview: true,
  documentationURL: "https://github.com/robman2026/garage-dashboard-card",
});

console.info(
  "%c GARAGE-DASHBOARD-CARD %c v3.1.0 ",
  "color:white;background:#f97316;font-weight:bold;padding:2px 4px;border-radius:3px 0 0 3px;",
  "color:#f97316;background:#0f172a;font-weight:bold;padding:2px 4px;border-radius:0 3px 3px 0;"
);
