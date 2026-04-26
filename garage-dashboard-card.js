/**
 * garage-dashboard-card.js
 * Garage Dashboard Card for Home Assistant
 * GitHub: https://github.com/robman2026/garage-dashboard-card
 * Version: 3.0.1
 *
 * Changelog v3.0.7:
 *  - Fix: doors locked state now respects car_doors_locked_when config option
 *    "on"  → binary_sensor "on" means locked (default for lock-type sensors)
 *    "off" → binary_sensor "off" means locked (for door-open sensors where on=unlocked)
 *    Configurable via visual editor toggle in Car tab
 *
 * Changelog v3.0.1:
 *  - Converted from vanilla HTMLElement to LitElement (same architecture as room-card)
 *  - Climate section: room-card compact tile style (52×52 SVG arc + value + label)
 *  - Configurable color stops for temperature and humidity (shared with room-card)
 *  - Car section: location/status badge, range, odometer, monthly distance,
 *    doors locked state, action buttons (Update Data, Flash Lights, Horn)
 *  - Visual editor: tab-based, searchable entity dropdowns, color stop editor,
 *    car section toggle with all entity fields
 *  - Uses room-card-stream sub-element for camera (if already registered)
 *    or falls back to ha-camera-stream directly
 *  - remove Camera label
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
      car_doors_locked_when: "off",
      ...config,
    };
  }

  set hass(hass) {
    this._hass = hass;
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
          <div class="cover-btns">
            <button class="ctrl-btn" title="Open"
              @click="${() => this._callService("cover", "open_cover", eid)}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18h16v2H4zm8-16L4 9h4v7h8V9h4z"/></svg>
            </button>
            <button class="ctrl-btn ctrl-stop" title="Stop"
              @click="${() => this._callService("cover", "stop_cover", eid)}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
            </button>
            <button class="ctrl-btn" title="Close"
              @click="${() => this._callService("cover", "close_cover", eid)}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v2H4zm8 16l8-7h-4V7H8v6H4z"/></svg>
            </button>
          </div>
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
    // Normalise to lowercase — handles Lock, lock, locked, Locked, on, off, etc.
    const doorsStateLc = doorsState ? doorsState.toLowerCase() : null;
    // car_doors_locked_when: "off"  → binary_sensor off=locked (default — most car integrations)
    //                        "on"   → binary_sensor on=locked (standard lock entities)
    //                        "lock" → state is lock/locked (car integrations)
    const lockedWhen  = (cfg.car_doors_locked_when || "off").toLowerCase();
    const doorsLocked = doorsStateLc !== null && (
      doorsStateLc === lockedWhen ||
      doorsStateLc === "locked" ||
      doorsStateLc === "lock"
    );
    const doorsColor  = doorsLocked ? "#22c55e" : "#ef4444";
    const doorsLabel  = doorsState ? (doorsLocked ? "Locked" : "Unlocked") : "--";
    const doorsAgo    = cfg.car_doors_entity ? this._agoStr(cfg.car_doors_entity) : "";

    // Format number helper
    const fmt = (val) => {
      if (val === null || val === "unavailable") return "--";
      const n = parseFloat(val);
      return isNaN(n) ? val : n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    };

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

        <!-- Stats grid -->
        <div class="car-stats" style="grid-template-columns:repeat(${cfg.car_stat_columns||4},1fr)">
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
        </div>

        <!-- Action buttons -->
        ${(cfg.car_update_entity || cfg.car_flash_entity || cfg.car_horn_entity) ? html`
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
        ` : ""}
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
        <div class="card">

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

          <!-- Car -->
          ${this._renderCar()}

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
        background: #0f172a;
        border-radius: 16px;
        overflow: hidden;
        color: #e2e8f0;
        box-shadow: 0 4px 24px rgba(0,0,0,0.4);
        border: 1px solid #1e293b;
      }

      /* ── Header ── */
      .card-header {
        display: flex; align-items: center; gap: 10px;
        padding: 14px 16px 11px;
        border-bottom: 1px solid #1e293b;
      }
      .header-icon { width: 20px; height: 20px; color: #f97316; flex-shrink: 0; }
      .card-title { font-size: 1rem; font-weight: 700; letter-spacing: .06em; color: #f1f5f9; flex: 1; text-transform: uppercase; }
      .status-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
      .dot-open   { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,0.7); }
      .dot-closed { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.6); }

      /* ── Section wrapper ── */
      .section { padding: 10px 14px; }
      .section + .section { border-top: 1px solid #1e293b; }

      /* ── Climate tiles (room-card style) ── */
      .climate-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .sensor-tile {
        background: #1e293b; border-radius: 12px; padding: 10px;
        display: flex; align-items: center; gap: 10px; min-width: 0;
        border: 1px solid rgba(255,255,255,0.06);
        transition: background 0.2s;
      }
      .sensor-tile:hover { background: #263348; }
      .gauge-wrap { position: relative; width: 52px; height: 52px; flex-shrink: 0; }
      .gauge-center {
        position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
        display: flex; flex-direction: column; align-items: center; pointer-events: none;
      }
      .gauge-val-sm  { font-size: 10px; font-weight: 700; line-height: 1; }
      .gauge-unit-sm { font-size: 6px; color: rgba(255,255,255,0.8); }
      .sensor-info   { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
      .sensor-value  { font-size: 18px; font-weight: 700; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sensor-unit   { font-size: 11px; font-weight: 400; }
      .sensor-label  { font-size: 9px; letter-spacing: 1.4px; color: rgba(255,255,255,0.9); text-transform: uppercase; margin-top: 2px; }

      /* ── Cover row ── */
      .cover-section { border-top: 1px solid #1e293b; }
      .cover-row { display: flex; align-items: center; gap: 10px; }
      .entity-icon {
        width: 34px; height: 34px; background: #1e293b; border-radius: 8px;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #94a3b8;
      }
      .entity-icon svg { width: 18px; height: 18px; }
      .entity-name { font-size: .82rem; font-weight: 600; color: #e2e8f0; }
      .entity-sub  { font-size: .7rem; margin-top: 1px; }
      .cover-btns  { display: flex; gap: 5px; }
      .ctrl-btn {
        width: 30px; height: 30px; border-radius: 7px;
        border: 1px solid #334155; background: #1e293b; color: #94a3b8;
        display: flex; align-items: center; justify-content: center; cursor: pointer;
        transition: all 0.15s;
      }
      .ctrl-btn svg { width: 15px; height: 15px; }
      .ctrl-btn:hover { background: #263348; color: #e2e8f0; }
      .ctrl-btn:active { transform: scale(0.93); }
      .ctrl-btn.ctrl-stop { border-color: #7F3D1D4D; background: #1c0e0e; color: #B36262; }
      .ctrl-btn.ctrl-stop:hover { background: #2d1010; }

      /* ── Camera ── */
      .camera-box {
        border-radius: 12px; overflow: hidden; position: relative;
        background: #0a0e1a; border: 1px solid rgba(255,255,255,0.08);
      }
      room-card-stream, garage-cam-stream { display: block; width: 100%; }
      .cam-overlay {
        position: absolute; bottom: 0; left: 0; right: 0;
        padding: 6px 10px;
        background: linear-gradient(transparent, rgba(0,0,0,0.6));
        display: flex; justify-content: space-between; align-items: center;
      }
      .cam-label { font-size: .6rem; color: rgba(255,255,255,0.5); letter-spacing: .08em; text-transform: uppercase; }
      .cam-live  { font-size: .58rem; color: #f87171; border: 1px solid rgba(248,113,113,.4); padding: 1px 5px; border-radius: 3px; font-weight: 600; }
      .camera-unavail { display: flex; align-items: center; justify-content: center; padding: 20px; color: rgba(255,255,255,0.3); font-size: .75rem; }

      /* ── Toggles ── */
      .toggles-row { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }
      .toggle-card {
        background: #1e293b; border-radius: 12px; padding: 11px 10px;
        display: flex; flex-direction: column; align-items: center; gap: 5px;
        border: 1px solid transparent; cursor: pointer; transition: all 0.2s;
        -webkit-tap-highlight-color: transparent;
      }
      .toggle-card:hover { background: #263348; }
      .toggle-card:active { transform: scale(0.97); }
      .toggle-card.active { border-color: #f97316; background: #1c130a; }
      .toggle-icon { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: #FEFCFF; }
      .toggle-card.active .toggle-icon { color: #f97316; }
      .toggle-icon svg { width: 18px; height: 18px; }
      .toggle-label { font-size: .65rem; color: #FEFCFF; text-align: center; }
      .toggle-state { font-size: .62rem; color: #FEFCFF; font-weight: 600; }
      .toggle-card.active .toggle-state { color: #f97316; }

      /* ── Sensor chips ── */
      .sensors-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; }
      .sensor-chip {
        background: #1e293b; border-radius: 10px; padding: 8px 6px;
        display: flex; flex-direction: column; align-items: center; gap: 3px;
        border: 1px solid transparent; transition: all 0.2s;
      }
      .sensor-chip:hover { background: #263348; }
      .sensor-chip.active { border-color: #f59e0b; background: #1c1a0a; }
      .sensor-chip svg { color: #FEFCFF; }
      .sensor-chip.active svg { color: #f59e0b; }
      .chip-icon { display:flex; align-items:center; justify-content:center; }
      .sensor-chip-name { font-size: .6rem; color: #FEFCFF; text-align: center; font-weight: 600; }
      .sensor-chip-time { font-size: .56rem; color: #FEFCFF; text-align: center; }
      .sensor-chip.active .sensor-chip-name { color: #fcd34d; }

      /* ── Car section ── */
      .car-section { border-top: 1px solid #1e293b; }
      .car-header  { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
      .car-icon-box {
        width: 32px; height: 32px; background: #1e293b; border-radius: 8px;
        display: flex; align-items: center; justify-content: center; color: #60a5fa; flex-shrink: 0;
      }
      .car-name { font-size: .85rem; font-weight: 700; color: #e2e8f0; flex: 1; letter-spacing: .04em; }
      .car-location-badge {
        font-size: .62rem; font-weight: 700; padding: 3px 9px; border-radius: 20px;
        cursor: pointer; flex-shrink: 0;
      }
      .car-stats {
        display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-bottom: 8px;
      }
      .car-stat {
        background: #1e293b; border-radius: 10px; padding: 9px 10px;
        border: 1px solid rgba(255,255,255,0.05); transition: background 0.15s;
      }
      .car-stat:hover { background: #263348; }
      .car-stat-val  { font-size: .9rem; font-weight: 700; color: #e2e8f0; line-height: 1; }
      .car-stat-unit { font-size: .65rem; color: #94a3b8; font-weight: 400; }
      .car-stat-lbl  { font-size: .58rem; color: #64748b; text-transform: uppercase; letter-spacing: .05em; margin-top: 3px; }
      .car-stat-sub  { font-size: .62rem; color: #94a3b8; margin-top: 1px; }
      .car-actions   { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
      .car-action-btn {
        background: #1e293b; border: 1px solid #334155; border-radius: 10px;
        padding: 8px 6px; display: flex; flex-direction: column; align-items: center; gap: 4px;
        cursor: pointer; transition: all 0.15s; font-family: inherit;
        -webkit-tap-highlight-color: transparent;
      }
      .car-action-btn svg { color: #60a5fa; }
      .car-action-btn:hover { background: #263348; border-color: #60a5fa; }
      .car-action-btn:active { transform: scale(0.95); }
      .car-action-lbl { font-size: .6rem; color: #94a3b8; text-align: center; }
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
      hass:       {},
      _config:    { state: true },
      _activeTab: { state: true },
      _search:    { state: true },
    };
  }

  constructor() {
    super();
    this._activeTab = "general";
    this._search    = {};
  }

  setConfig(config) {
    this._config = JSON.parse(JSON.stringify(config));
    this._search = {};
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

  _entities(...domains) {
    if (!this.hass) return [];
    return Object.keys(this.hass.states)
      .filter((id) => !domains.length || domains.some((d) => id.startsWith(d + ".")))
      .sort();
  }

  // ── Searchable entity dropdown ────────────────────────────────────────────────

  _entitySearch(searchKey, currentValue, onChange, domains, placeholder) {
    const base     = domains && domains.length ? this._entities(...domains) : this._entities();
    const query    = (this._search[searchKey] || "").toLowerCase().trim();
    const filtered = query ? base.filter((e) => e.toLowerCase().includes(query)) : base;

    const label = (eid) => {
      if (!this.hass) return eid;
      const fn = this.hass.states[eid]?.attributes?.friendly_name;
      return fn ? `${fn}  (${eid})` : eid;
    };

    return html`
      <div class="search-select-wrap">
        <input class="ed-input search-input" type="text"
          placeholder="🔍 Search entities..."
          .value="${this._search[searchKey] || ""}"
          @input="${(e) => { this._search = { ...this._search, [searchKey]: e.target.value }; }}" />
        <select class="ed-select"
          @change="${(e) => { onChange(e.target.value); this._search = { ...this._search, [searchKey]: "" }; }}">
          <option value="">${placeholder || "— select entity —"}</option>
          ${filtered.slice(0, 200).map((eid) => html`
            <option value="${eid}" ?selected="${eid === currentValue}">${label(eid)}</option>
          `)}
          ${filtered.length > 200 ? html`<option disabled>…${filtered.length - 200} more</option>` : ""}
        </select>
        ${currentValue ? html`<div class="selected-badge">${currentValue}</div>` : ""}
      </div>
    `;
  }

  // ── Shared controls ───────────────────────────────────────────────────────────

  _txt(lbl, value, onChange, placeholder) {
    return html`
      <label class="ed-label">${lbl}</label>
      <input class="ed-input" type="text" .value="${value || ""}" placeholder="${placeholder || ""}"
        @input="${(e) => onChange(e.target.value)}" />
    `;
  }

  _num(lbl, value, onChange, placeholder) {
    return html`
      <label class="ed-label">${lbl}</label>
      <input class="ed-input" type="number" .value="${value !== undefined ? String(value) : ""}" placeholder="${placeholder || ""}"
        @input="${(e) => onChange(parseFloat(e.target.value) || 0)}" />
    `;
  }

  _toggle(lbl, value, onChange) {
    return html`
      <div class="toggle-row">
        <span class="ed-label">${lbl}</span>
        <label class="toggle-wrap">
          <input type="checkbox" ?checked="${value}" @change="${(e) => onChange(e.target.checked)}" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  }

  _numSelect(lbl, value, options, onChange) {
    return html`
      <div class="toggle-row">
        <span class="ed-label">${lbl}</span>
        <select class="ed-select inline-select"
          @change="${(e) => onChange(parseInt(e.target.value))}">
          ${options.map((o) => html`<option value="${o}" ?selected="${o === (value || options[0])}">${o}</option>`)}
        </select>
      </div>
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
          <input class="ed-input stop-val-input" type="number"
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

  // ── TAB: General ─────────────────────────────────────────────────────────────

  _tabGeneral() {
    const cfg = this._config;
    return html`
      <div class="section">
        <div class="section-title">Card Identity</div>
        ${this._txt("Card Title", cfg.title, (v) => this._set("title", v), "e.g. Garaj")}
      </div>
      <div class="section">
        <div class="section-title">Climate Sensors</div>
        <label class="ed-label">Temperature Entity</label>
        ${this._entitySearch("temp", cfg.temp_sensor, (v) => this._set("temp_sensor", v), ["sensor"], "— select temp sensor —")}
        ${this._txt("Temperature Label", cfg.temp_label, (v) => this._set("temp_label", v), "TEMPERATURE")}
        <div class="two-col">
          ${this._num("Temp Min (°C)", cfg.temp_min, (v) => this._set("temp_min", v), "0")}
          ${this._num("Temp Max (°C)", cfg.temp_max, (v) => this._set("temp_max", v), "50")}
        </div>
        <label class="ed-label">Humidity Entity</label>
        ${this._entitySearch("hum", cfg.humidity_sensor, (v) => this._set("humidity_sensor", v), ["sensor"], "— select humidity sensor —")}
        ${this._txt("Humidity Label", cfg.hum_label, (v) => this._set("hum_label", v), "HUMIDITY")}
      </div>
    `;
  }

  // ── TAB: Colors ───────────────────────────────────────────────────────────────

  _tabColors() {
    return html`
      <div class="section">
        <div class="section-title">Temperature Color Stops</div>
        <p class="hint">Enter °C value and pick a color. Arc and value text interpolate smoothly between stops. Min 2 stops.</p>
        ${this._renderColorStops("temp_color_stops", "°C", GDC_DEFAULT_TEMP_STOPS)}
      </div>
      <div class="section">
        <div class="section-title">Humidity Color Stops</div>
        <p class="hint">Enter % value and pick a color. Default: orange (dry) → green (40–60%) → red (humid).</p>
        ${this._renderColorStops("hum_color_stops", "%", GDC_DEFAULT_HUM_STOPS)}
      </div>
    `;
  }

  // ── TAB: Cover & Sensors ──────────────────────────────────────────────────────

  _tabDevices() {
    const cfg = this._config;
    return html`
      <div class="section">
        <div class="section-title">Main Cover (with position control)</div>
        <label class="ed-label">Cover Entity</label>
        ${this._entitySearch("cover", cfg.cover_entity, (v) => this._set("cover_entity", v), ["cover"], "— select cover —")}
        ${this._txt("Cover Display Name", cfg.cover_name, (v) => this._set("cover_name", v), "Ușa la Garaj")}
      </div>
      <div class="section">
        <div class="section-title">Simple Cover Toggle</div>
        <label class="ed-label">Entity</label>
        ${this._entitySearch("cover_simple", cfg.cover_simple, (v) => this._set("cover_simple", v), ["cover"], "— select cover —")}
        ${this._txt("Display Name", cfg.cover_simple_name, (v) => this._set("cover_simple_name", v), "Garage Door")}
      </div>
      <div class="section">
        <div class="section-title">Light</div>
        <label class="ed-label">Entity</label>
        ${this._entitySearch("light", cfg.light_entity, (v) => this._set("light_entity", v), ["light", "switch"], "— select light —")}
        ${this._txt("Display Name", cfg.light_name, (v) => this._set("light_name", v), "Lumina Garaj")}
      </div>
      <div class="section">
        <div class="section-title">Camera</div>
        <label class="ed-label">Camera Entity</label>
        ${this._entitySearch("camera", cfg.camera_entity, (v) => this._set("camera_entity", v), ["camera"], "— select camera —")}
      </div>
      <div class="section">
        <div class="section-title">Sensor Chips Row</div>
        <label class="ed-label">Door Sensor</label>
        ${this._entitySearch("door_sensor", cfg.door_sensor, (v) => this._set("door_sensor", v), ["binary_sensor", "cover"], "— select sensor —")}
        ${this._txt("Door Sensor Name", cfg.door_sensor_name, (v) => this._set("door_sensor_name", v), "Ușa garaj")}
        <label class="ed-label">Motion Sensor</label>
        ${this._entitySearch("motion_sensor", cfg.motion_sensor, (v) => this._set("motion_sensor", v), ["binary_sensor"], "— select sensor —")}
        ${this._txt("Motion Sensor Name", cfg.motion_sensor_name, (v) => this._set("motion_sensor_name", v), "Mișcare")}
        <label class="ed-label">Door Control Entity</label>
        ${this._entitySearch("door_ctrl", cfg.door_ctrl, (v) => this._set("door_ctrl", v), ["cover", "binary_sensor"], "— select entity —")}
        ${this._txt("Door Control Name", cfg.door_ctrl_name, (v) => this._set("door_ctrl_name", v), "Ușa CTRL")}
      </div>
    `;
  }

  // ── TAB: Car ─────────────────────────────────────────────────────────────────

  _tabCar() {
    const cfg = this._config;
    return html`
      <div class="section">
        <div class="section-title">Layout</div>
        <p class="hint">How many columns to use for the car stat tiles (Range, Odometer, Monthly Distance, Doors).</p>
        ${this._numSelect("Car Stats Columns", cfg.car_stat_columns || 4, [1,2,3,4],
            (v) => this._set("car_stat_columns", v))}
      </div>
      <div class="section">
        <div class="section-title">Car Widget</div>
        ${this._toggle("Show Car Section", cfg.show_car, (v) => this._set("show_car", v))}
        ${cfg.show_car ? html`
          ${this._txt("Car Display Name", cfg.car_name, (v) => this._set("car_name", v), "e.g. My Car")}
        ` : ""}
      </div>
      ${cfg.show_car ? html`
        <div class="section">
          <div class="section-title">Location & Status</div>
          <label class="ed-label">Location / Device Tracker Entity</label>
          ${this._entitySearch("car_loc", cfg.car_location_entity, (v) => this._set("car_location_entity", v),
            ["device_tracker", "sensor", "binary_sensor"], "— select entity —")}
        </div>
        <div class="section">
          <div class="section-title">Stats</div>
          <label class="ed-label">Range Sensor (km remaining)</label>
          ${this._entitySearch("car_range", cfg.car_range_entity, (v) => this._set("car_range_entity", v), ["sensor"], "— select sensor —")}
          <label class="ed-label">Odometer Sensor (total km)</label>
          ${this._entitySearch("car_odo", cfg.car_odometer_entity, (v) => this._set("car_odometer_entity", v), ["sensor"], "— select sensor —")}
          <label class="ed-label">Monthly Distance Sensor</label>
          ${this._entitySearch("car_monthly", cfg.car_monthly_distance_entity, (v) => this._set("car_monthly_distance_entity", v), ["sensor"], "— select sensor —")}
          <label class="ed-label">Monthly Trips Sensor (optional)</label>
          ${this._entitySearch("car_trips", cfg.car_monthly_trips_entity, (v) => this._set("car_monthly_trips_entity", v), ["sensor"], "— select sensor —")}
          <label class="ed-label">Doors Locked Sensor / Entity</label>
          ${this._entitySearch("car_doors", cfg.car_doors_entity, (v) => this._set("car_doors_entity", v),
            ["binary_sensor", "sensor", "lock"], "— select entity —")}
          ${cfg.car_doors_entity ? html`
            <div class="toggle-row" style="margin-top:6px">
              <span class="ed-label" style="margin:0">
                ${cfg.car_doors_locked_when === "off"
                  ? "Locked when: OFF (door-open sensor)"
                  : "Locked when: ON (lock sensor — default)"}
              </span>
              <label class="toggle-wrap">
                <input type="checkbox"
                  ?checked="${(cfg.car_doors_locked_when || 'off') === 'off'}"
                  @change="${(e) => this._set('car_doors_locked_when', e.target.checked ? 'off' : 'on')}" />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <p class="hint" style="margin-top:4px">
              Toggle ON if your sensor reports <strong>on = unlocked</strong>
              (e.g. a door-open binary sensor). Leave OFF for standard lock entities
              where <strong>on = locked</strong>.
            </p>
          ` : ""}
        </div>
        <div class="section">
          <div class="section-title">Action Buttons</div>
          <p class="hint">These should be button.* entities. Pressing them calls button.press.</p>
          <label class="ed-label">Update Data Button Entity</label>
          ${this._entitySearch("car_update", cfg.car_update_entity, (v) => this._set("car_update_entity", v), ["button"], "— select button —")}
          <label class="ed-label">Flash Lights Button Entity</label>
          ${this._entitySearch("car_flash", cfg.car_flash_entity, (v) => this._set("car_flash_entity", v), ["button"], "— select button —")}
          <label class="ed-label">Honk Horn Button Entity</label>
          ${this._entitySearch("car_horn", cfg.car_horn_entity, (v) => this._set("car_horn_entity", v), ["button"], "— select button —")}
        </div>
      ` : ""}
    `;
  }

  render() {
    if (!this._config) return html``;
    const tabs = [
      { id: "general", label: "General"  },
      { id: "colors",  label: "Colors"   },
      { id: "devices", label: "Devices"  },
      { id: "car",     label: "Car"      },
    ];
    return html`
      <div class="editor-root">
        <div class="tab-bar">
          ${tabs.map((t) => html`
            <button class="tab-btn ${this._activeTab === t.id ? "active" : ""}"
              @click="${() => (this._activeTab = t.id)}">${t.label}</button>
          `)}
        </div>
        <div class="tab-content">
          ${this._activeTab === "general" ? this._tabGeneral() : ""}
          ${this._activeTab === "colors"  ? this._tabColors()  : ""}
          ${this._activeTab === "devices" ? this._tabDevices() : ""}
          ${this._activeTab === "car"     ? this._tabCar()     : ""}
        </div>
      </div>
    `;
  }

  static get styles() {
    return css`
      :host { display: block; font-family: 'Segoe UI', sans-serif; }
      .editor-root { display: flex; flex-direction: column; }

      .tab-bar { display: flex; flex-wrap: wrap; border-bottom: 1px solid rgba(0,0,0,0.15); background: var(--card-background-color, #1e293b); border-radius: 8px 8px 0 0; }
      .tab-btn { flex: 1; min-width: 60px; padding: 8px 4px; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; border: none; background: transparent; color: var(--secondary-text-color, #94a3b8); cursor: pointer; transition: background 0.15s, color 0.15s; text-transform: uppercase; }
      .tab-btn.active { color: var(--primary-color, #f97316); border-bottom: 2px solid var(--primary-color, #f97316); background: rgba(249,115,22,0.06); }

      .tab-content { padding: 12px 4px; display: flex; flex-direction: column; gap: 4px; }
      .section { margin-bottom: 10px; }
      .section-title { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--primary-color, #f97316); margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(249,115,22,0.2); }
      .hint { font-size: 0.73rem; color: var(--secondary-text-color, #94a3b8); margin: 0 0 8px; line-height: 1.5; }

      .ed-label { display: block; font-size: 0.72rem; font-weight: 600; color: var(--secondary-text-color, #64748b); margin-bottom: 3px; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
      .ed-input { width: 100%; padding: 7px 10px; font-size: 0.82rem; border: 1px solid var(--divider-color, #334155); border-radius: 6px; background: var(--secondary-background-color, #0f172a); color: var(--primary-text-color, #e2e8f0); box-sizing: border-box; transition: border-color 0.15s; }
      .ed-input:focus { outline: none; border-color: var(--primary-color, #f97316); }

      .ed-select { width: 100%; padding: 7px 10px; font-size: 0.82rem; border: 1px solid var(--divider-color, #334155); border-radius: 6px; background: var(--secondary-background-color, #0f172a); color: var(--primary-text-color, #e2e8f0); box-sizing: border-box; cursor: pointer; margin-top: 4px; }

      .search-select-wrap { display: flex; flex-direction: column; gap: 4px; margin-bottom: 4px; }
      .search-input { font-size: 0.8rem; }
      .selected-badge { font-size: 0.67rem; color: var(--primary-color, #f97316); background: rgba(249,115,22,0.1); border-radius: 4px; padding: 2px 6px; word-break: break-all; }

      .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; gap: 8px; }
      .toggle-wrap { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
      .toggle-wrap input { display: none; }
      .toggle-slider { position: absolute; inset: 0; background: #334155; border-radius: 11px; cursor: pointer; transition: background 0.2s; }
      .toggle-slider::before { content: ""; position: absolute; left: 3px; top: 3px; width: 16px; height: 16px; background: white; border-radius: 50%; transition: transform 0.2s; }
      .toggle-wrap input:checked + .toggle-slider { background: var(--primary-color, #f97316); }
      .toggle-wrap input:checked + .toggle-slider::before { transform: translateX(18px); }

      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

      /* Color stop editor */
      .gradient-bar { height: 10px; border-radius: 5px; margin-bottom: 10px; border: 1px solid var(--divider-color, #334155); }
      .stop-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
      .stop-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.15); }
      .stop-val-input { width: 62px !important; flex: none !important; padding: 5px 7px !important; font-size: 0.78rem !important; }
      .stop-unit-lbl { font-size: 0.72rem; color: var(--secondary-text-color, #64748b); flex-shrink: 0; width: 18px; }
      .stop-arrow { font-size: 0.75rem; color: var(--secondary-text-color, #64748b); flex-shrink: 0; }
      .color-swatch-wrap { width: 32px; height: 28px; border-radius: 5px; border: 1px solid var(--divider-color, #334155); overflow: hidden; flex-shrink: 0; }
      .color-swatch-input { width: 200%; height: 200%; margin: -25%; border: none; cursor: pointer; padding: 0; }
      .stop-actions { display: flex; gap: 8px; margin-top: 4px; }

      .btn-add { width: 100%; padding: 8px; font-size: 0.78rem; font-weight: 600; border: 1px dashed var(--primary-color, #f97316); border-radius: 6px; background: transparent; color: var(--primary-color, #f97316); cursor: pointer; }
      .btn-add.sm { width: auto; padding: 6px 10px; font-size: 0.72rem; }
      .btn-remove-sm { padding: 2px 5px; font-size: 0.68rem; border: 1px solid #ef4444; border-radius: 4px; background: transparent; color: #ef4444; cursor: pointer; flex-shrink: 0; }
      .btn-remove-sm:disabled { opacity: 0.3; cursor: not-allowed; }
      .btn-reset { padding: 6px 10px; font-size: 0.72rem; font-weight: 600; border: 1px solid var(--divider-color, #334155); border-radius: 6px; background: transparent; color: var(--secondary-text-color, #94a3b8); cursor: pointer; }
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
  "%c GARAGE-DASHBOARD-CARD %c v3.0.7 ",
  "color:white;background:#f97316;font-weight:bold;padding:2px 4px;border-radius:3px 0 0 3px;",
  "color:#f97316;background:#0f172a;font-weight:bold;padding:2px 4px;border-radius:0 3px 3px 0;"
);
