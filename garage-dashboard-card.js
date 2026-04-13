/**
 * Garage Dashboard Card
 * A custom Home Assistant card for comprehensive garage monitoring and control.
 * https://github.com/yourusername/garage-dashboard-card
 */

class GarageDashboardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._cameraRefreshInterval = null;
  }

  static get properties() {
    return {};
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");

    this._config = {
      title: config.title || "Garaj",
      temp_sensor: config.temp_sensor || null,
      humidity_sensor: config.humidity_sensor || null,
      cover_entity: config.cover_entity || null,
      cover_simple: config.cover_simple || null,
      light_entity: config.light_entity || null,
      camera_entity: config.camera_entity || null,
      door_sensor: config.door_sensor || null,
      motion_sensor: config.motion_sensor || null,
      door_ctrl: config.door_ctrl || null,
      distance_entity: config.distance_entity || null,
      camera_refresh_interval: config.camera_refresh_interval || 5000,
      temp_min: config.temp_min || 0,
      temp_max: config.temp_max || 40,
    };

    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.updateStates();
  }

  getState(entityId) {
    if (!this._hass || !entityId) return null;
    return this._hass.states[entityId] || null;
  }

  getStateValue(entityId, fallback = "unavailable") {
    const state = this.getState(entityId);
    return state ? state.state : fallback;
  }

  getAttr(entityId, attr, fallback = null) {
    const state = this.getState(entityId);
    return state && state.attributes[attr] !== undefined
      ? state.attributes[attr]
      : fallback;
  }

  relativeTime(entityId) {
    const state = this.getState(entityId);
    if (!state) return "";
    const last = new Date(state.last_changed);
    const diff = Math.floor((Date.now() - last) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  formatTemp(val) {
    return val !== null && val !== undefined ? parseFloat(val).toFixed(1) : "--";
  }

  formatHum(val) {
    return val !== null && val !== undefined ? parseFloat(val).toFixed(0) : "--";
  }

  tempGaugeAngle(temp) {
    const min = this._config.temp_min;
    const max = this._config.temp_max;
    const clamped = Math.max(min, Math.min(max, parseFloat(temp) || 0));
    return ((clamped - min) / (max - min)) * 180 - 90; // -90 to +90 deg
  }

  coverIcon(state) {
    if (state === "open") return "M19 19H5V8H3v13a2 2 0 002 2h14a2 2 0 002-2V8h-2v11zm1-16H4l-2 2h20l-2-2zM12 3L7 8h10l-5-5z";
    if (state === "opening") return "M12 2L4 9h3v9h3v-6h4v6h3V9h3L12 2z";
    if (state === "closing") return "M12 22L4 15h3V6h3v6h4V6h3v9h3L12 22z";
    return "M20 20H4V9H2v13a2 2 0 002 2h16a2 2 0 002-2V9h-2v11zM22 7H2l2-4h16l2 4zM12 2L7 7h10L12 2z";
  }

  doorStatusColor(state) {
    if (state === "open" || state === "on") return "#ef4444";
    if (state === "opening" || state === "closing") return "#f59e0b";
    return "#22c55e";
  }

  callService(domain, service, data = {}) {
    if (this._hass) this._hass.callService(domain, service, data);
  }

  // Interpolates temperature color matching gauge-card-pro segments (range 0–50°C)
  // Stops: 0→#2391FF, 17→#14FF6A, 25→#F8FF42, 35→#FF3502
  _tempColor(t) {
    const stops = [
      { pos: 0,  r: 0x23, g: 0x91, b: 0xFF },
      { pos: 17, r: 0x14, g: 0xFF, b: 0x6A },
      { pos: 25, r: 0xF8, g: 0xFF, b: 0x42 },
      { pos: 35, r: 0xFF, g: 0x35, b: 0x02 },
      { pos: 50, r: 0xFF, g: 0x35, b: 0x02 },
    ];
    const clamped = Math.max(0, Math.min(50, t));
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (clamped >= stops[i].pos && clamped <= stops[i + 1].pos) {
        lo = stops[i]; hi = stops[i + 1]; break;
      }
    }
    const range = hi.pos - lo.pos || 1;
    const f = (clamped - lo.pos) / range;
    const r = Math.round(lo.r + f * (hi.r - lo.r));
    const g = Math.round(lo.g + f * (hi.g - lo.g));
    const b = Math.round(lo.b + f * (hi.b - lo.b));
    return `rgb(${r},${g},${b})`;
  }

  // Humidity color: normal 20–60% = green, below = blue (too dry), above = red (too humid)
  _humColor(h) {
    if (h < 20) return "#2391FF";   // too dry — blue
    if (h <= 60) return "#14FF6A";  // normal — green
    return "#FF3502";               // too humid — red
  }

  handleCoverAction(action) {
    if (!this._config.cover_entity) return;
    const svc =
      action === "open" ? "open_cover" : action === "close" ? "close_cover" : "stop_cover";
    this.callService("cover", svc, { entity_id: this._config.cover_entity });
  }

  handleLightToggle() {
    if (!this._config.light_entity) return;
    this.callService("light", "toggle", { entity_id: this._config.light_entity });
  }

  handleCoverSimpleToggle() {
    if (!this._config.cover_simple) return;
    const state = this.getStateValue(this._config.cover_simple);
    const svc = state === "open" ? "close_cover" : "open_cover";
    this.callService("cover", svc, { entity_id: this._config.cover_simple });
  }

  getCameraUrl() {
    if (!this._config.camera_entity || !this._hass) return null;
    const entity = this.getState(this._config.camera_entity);
    if (!entity) return null;
    const token = entity.attributes.access_token;
    return `/api/camera_proxy/${this._config.camera_entity}?token=${token}&t=${Date.now()}`;
  }

  refreshCamera() {
    const img = this.shadowRoot.getElementById("garage-camera");
    if (img) {
      const url = this.getCameraUrl();
      if (url) img.src = url;
    }
  }

  startCameraRefresh() {
    this.stopCameraRefresh();
    if (this._config.camera_entity) {
      this._cameraRefreshInterval = setInterval(
        () => this.refreshCamera(),
        this._config.camera_refresh_interval
      );
    }
  }

  stopCameraRefresh() {
    if (this._cameraRefreshInterval) {
      clearInterval(this._cameraRefreshInterval);
      this._cameraRefreshInterval = null;
    }
  }

  disconnectedCallback() {
    this.stopCameraRefresh();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>${this.styles()}</style>
      <div class="card">
        <div class="card-header">
          <svg class="header-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 20H5V9H3v13a2 2 0 002 2h14a2 2 0 002-2V9h-2v11zM21 7H3L5 3h14l2 4zM12 2L7 7h10L12 2z"/>
          </svg>
          <span class="card-title">${this._config.title}</span>
          <div class="status-dot" id="status-dot"></div>
        </div>

        <!-- Temp & Humidity — compact twin pills -->
        <div class="section climate-section">
          <div class="climate-pill">
            <svg class="ring-svg" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#1e293b" stroke-width="4"/>
              <circle id="temp-ring" cx="22" cy="22" r="18" fill="none" stroke="#f97316"
                stroke-width="4" stroke-linecap="round" stroke-dasharray="113" stroke-dashoffset="85"
                transform="rotate(-90 22 22)"/>
            </svg>
            <div class="climate-text">
              <div class="climate-icon-label">🌡</div>
              <div class="climate-value" id="temp-val">--.-°C</div>
              <div class="climate-sub">Temperature</div>
            </div>
          </div>
          <div class="climate-divider"></div>
          <div class="climate-pill">
            <svg class="ring-svg" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#1e293b" stroke-width="4"/>
              <circle id="hum-ring" cx="22" cy="22" r="18" fill="none" stroke="#38bdf8"
                stroke-width="4" stroke-linecap="round" stroke-dasharray="113" stroke-dashoffset="47"
                transform="rotate(-90 22 22)"/>
            </svg>
            <div class="climate-text">
              <div class="climate-icon-label">💧</div>
              <div class="climate-value" id="hum-val">--%</div>
              <div class="climate-sub">Humidity</div>
            </div>
          </div>
        </div>

        <!-- Cover Control -->
        <div class="section cover-section" id="cover-section">
          <div class="cover-info">
            <div class="entity-icon cover-icon-wrap">
              <svg viewBox="0 0 24 24" fill="currentColor" id="cover-svg-icon">
                <path d="M20 20H4V9H2v13a2 2 0 002 2h16a2 2 0 002-2V9h-2v11zM22 7H2l2-4h16l2 4zM12 2L7 7h10L12 2z"/>
              </svg>
            </div>
            <div class="entity-details">
              <div class="entity-name">Ușa la Garaj</div>
              <div class="entity-state" id="cover-state-text">Closed · 0% · --</div>
            </div>
          </div>
          <div class="cover-controls">
            <button class="ctrl-btn" id="btn-open" title="Open" onclick="">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18h16v2H4zm8-16L4 9h4v7h8V9h4z"/></svg>
            </button>
            <button class="ctrl-btn ctrl-stop" id="btn-stop" title="Stop">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
            </button>
            <button class="ctrl-btn" id="btn-close" title="Close">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v2H4zm8 16l8-7h-4V7H8v6H4z"/></svg>
            </button>
          </div>
        </div>

        <!-- Camera Feed -->
        <div class="section camera-section" id="camera-section" style="display:none">
          <img id="garage-camera" class="camera-feed" alt="Garage Camera" />
          <div class="camera-overlay">
            <span class="camera-label">Garage</span>
          </div>
        </div>

        <!-- Toggles Row -->
        <div class="section toggles-section">
          <button class="toggle-card" id="toggle-cover-simple">
            <div class="toggle-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 20H4V9H2v13a2 2 0 002 2h16a2 2 0 002-2V9h-2v11zM22 7H2l2-4h16l2 4zM12 2L7 7h10L12 2z"/></svg>
            </div>
            <div class="toggle-label">Garage Door</div>
            <div class="toggle-state" id="cover-simple-state">Off</div>
          </button>
          <button class="toggle-card" id="toggle-light">
            <div class="toggle-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 017 7c0 2.62-1.44 4.9-3.57 6.14L15 17H9l-.43-1.86A7 7 0 015 9a7 7 0 017-7zm3 18H9v1a1 1 0 001 1h4a1 1 0 001-1v-1z"/></svg>
            </div>
            <div class="toggle-label">Lumina Garaj</div>
            <div class="toggle-state" id="light-state">Off</div>
          </button>
        </div>

        <!-- Sensor Row -->
        <div class="section sensors-section">
          <div class="sensor-chip" id="door-sensor-chip">
            <div class="sensor-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 20H4V9H2v13a2 2 0 002 2h16a2 2 0 002-2V9h-2v11zM22 7H2l2-4h16l2 4zM12 2L7 7h10L12 2z"/></svg>
            </div>
            <div class="sensor-info">
              <div class="sensor-name">Ușa garaj</div>
              <div class="sensor-time" id="door-time">--</div>
            </div>
          </div>
          <div class="sensor-chip" id="motion-sensor-chip">
            <div class="sensor-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/></svg>
            </div>
            <div class="sensor-info">
              <div class="sensor-name">Mișcare</div>
              <div class="sensor-time" id="motion-time">--</div>
            </div>
          </div>
          <div class="sensor-chip" id="ctrl-sensor-chip">
            <div class="sensor-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 20H4V9H2v13a2 2 0 002 2h16a2 2 0 002-2V9h-2v11zM22 7H2l2-4h16l2 4zM12 2L7 7h10L12 2z"/></svg>
            </div>
            <div class="sensor-info">
              <div class="sensor-name">Ușa CTRL</div>
              <div class="sensor-time" id="ctrl-time">--</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.addEventListeners();
    this.startCameraRefresh();
    this.updateStates();
  }

  addEventListeners() {
    const root = this.shadowRoot;
    root.getElementById("btn-open")?.addEventListener("click", () => this.handleCoverAction("open"));
    root.getElementById("btn-stop")?.addEventListener("click", () => this.handleCoverAction("stop"));
    root.getElementById("btn-close")?.addEventListener("click", () => this.handleCoverAction("close"));
    root.getElementById("toggle-light")?.addEventListener("click", () => this.handleLightToggle());
    root.getElementById("toggle-cover-simple")?.addEventListener("click", () => this.handleCoverSimpleToggle());
  }

  updateStates() {
    if (!this._hass || !this._config) return;
    const root = this.shadowRoot;

    // Temperature & Humidity rings
    const temp = this.getStateValue(this._config.temp_sensor);
    const hum = this.getStateValue(this._config.humidity_sensor);
    if (root.getElementById("temp-val")) {
      root.getElementById("temp-val").textContent =
        temp !== "unavailable" ? `${this.formatTemp(temp)}°C` : "--.-°C";
    }
    if (root.getElementById("hum-val")) {
      root.getElementById("hum-val").textContent =
        hum !== "unavailable" ? `${this.formatHum(hum)}%` : "--%";
    }
    // Temp ring — segments matching gauge-card-pro config (range 0–50°C)
    // Stops: 0→#2391FF, 17→#14FF6A, 25→#F8FF42, 35→#FF3502, 50→#FF3502
    const tempRing = root.getElementById("temp-ring");
    if (tempRing && temp !== "unavailable") {
      const t = parseFloat(temp);
      const pct = Math.max(0, Math.min(1, t / 50));
      tempRing.setAttribute("stroke-dashoffset", (113 * (1 - pct)).toFixed(1));
      tempRing.setAttribute("stroke", this._tempColor(t));
    }
    // Hum ring — normal 20–60%, below=dry(blue), above=humid(red)
    const humRing = root.getElementById("hum-ring");
    if (humRing && hum !== "unavailable") {
      const h = parseFloat(hum);
      const pct = Math.max(0, Math.min(1, h / 100));
      humRing.setAttribute("stroke-dashoffset", (113 * (1 - pct)).toFixed(1));
      humRing.setAttribute("stroke", this._humColor(h));
    }

    // Cover
    const coverState = this.getStateValue(this._config.cover_entity);
    const coverPos = this.getAttr(this._config.cover_entity, "current_position", 0);
    const coverTime = this.relativeTime(this._config.cover_entity);
    if (root.getElementById("cover-state-text")) {
      const label = coverState.charAt(0).toUpperCase() + coverState.slice(1);
      root.getElementById("cover-state-text").textContent = `${label} · ${coverPos}% · ${coverTime}`;
      root.getElementById("cover-state-text").style.color = this.doorStatusColor(coverState);
    }

    // Status dot
    const dot = root.getElementById("status-dot");
    if (dot) {
      const isOpen = coverState === "open" || coverState === "opening";
      dot.style.backgroundColor = isOpen ? "#ef4444" : "#22c55e";
    }

    // Camera
    const camSection = root.getElementById("camera-section");
    if (this._config.camera_entity && camSection) {
      camSection.style.display = "";
      const url = this.getCameraUrl();
      const img = root.getElementById("garage-camera");
      if (img && url && !img.src.includes(this._config.camera_entity)) img.src = url;
    }

    // Cover Simple
    const simpleState = this.getStateValue(this._config.cover_simple);
    const toggleCover = root.getElementById("toggle-cover-simple");
    if (toggleCover) {
      const isOn = simpleState === "open";
      toggleCover.classList.toggle("active", isOn);
      if (root.getElementById("cover-simple-state"))
        root.getElementById("cover-simple-state").textContent = isOn ? "Open" : "Closed";
    }

    // Light
    const lightState = this.getStateValue(this._config.light_entity);
    const toggleLight = root.getElementById("toggle-light");
    if (toggleLight) {
      const isOn = lightState === "on";
      toggleLight.classList.toggle("active", isOn);
      if (root.getElementById("light-state"))
        root.getElementById("light-state").textContent = isOn ? "On" : "Off";
    }

    // Sensors
    if (root.getElementById("door-time"))
      root.getElementById("door-time").textContent = this.relativeTime(this._config.door_sensor);
    if (root.getElementById("motion-time"))
      root.getElementById("motion-time").textContent = this.relativeTime(this._config.motion_sensor);
    if (root.getElementById("ctrl-time"))
      root.getElementById("ctrl-time").textContent = this.relativeTime(this._config.door_ctrl);

    // Sensor state colors
    const motionState = this.getStateValue(this._config.motion_sensor);
    const motionChip = root.getElementById("motion-sensor-chip");
    if (motionChip) motionChip.classList.toggle("sensor-active", motionState === "on");

    const doorSensorState = this.getStateValue(this._config.door_sensor);
    const doorChip = root.getElementById("door-sensor-chip");
    if (doorChip) doorChip.classList.toggle("sensor-active", doorSensorState === "on" || doorSensorState === "open");
  }

  styles() {
    return `
      :host {
        display: block;
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      }

      .card {
        background: #0f172a;
        border-radius: 16px;
        overflow: hidden;
        color: #e2e8f0;
        box-shadow: 0 4px 24px rgba(0,0,0,0.4);
        border: 1px solid #1e293b;
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 18px 12px;
        border-bottom: 1px solid #1e293b;
      }

      .header-icon {
        width: 22px;
        height: 22px;
        color: #f97316;
      }

      .card-title {
        font-size: 1.1rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: #f1f5f9;
        flex: 1;
        text-transform: uppercase;
      }

      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow: 0 0 6px #22c55e88;
        transition: background 0.3s, box-shadow 0.3s;
      }

      .section {
        padding: 14px 18px;
        border-bottom: 1px solid #1e293b;
      }

      .section:last-child {
        border-bottom: none;
      }

      /* Climate pills */
      .climate-section {
        display: flex;
        align-items: center;
        gap: 0;
        padding: 10px 18px;
      }

      .climate-pill {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px 4px;
      }

      .climate-divider {
        width: 1px;
        height: 40px;
        background: #1e293b;
        flex-shrink: 0;
        margin: 0 6px;
      }

      .ring-svg {
        width: 44px;
        height: 44px;
        flex-shrink: 0;
      }

      .climate-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .climate-icon-label {
        font-size: 0.7rem;
        line-height: 1;
      }

      .climate-value {
        font-size: 1.15rem;
        font-weight: 800;
        color: #f1f5f9;
        line-height: 1.2;
        letter-spacing: -0.01em;
      }

      .climate-sub {
        font-size: 0.63rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.07em;
      }

      /* Cover */
      .cover-section {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .cover-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
      }

      .entity-icon {
        width: 38px;
        height: 38px;
        background: #1e293b;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .entity-icon svg {
        width: 20px;
        height: 20px;
        color: #f97316;
      }

      .cover-icon-wrap svg {
        color: #f97316;
      }

      .entity-name {
        font-size: 0.9rem;
        font-weight: 600;
        color: #e2e8f0;
      }

      .entity-state {
        font-size: 0.75rem;
        color: #22c55e;
        margin-top: 2px;
        transition: color 0.3s;
      }

      .cover-controls {
        display: flex;
        gap: 6px;
      }

      .ctrl-btn {
        width: 34px;
        height: 34px;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
        transition: background 0.2s, color 0.2s, border-color 0.2s;
      }

      .ctrl-btn:hover {
        background: #334155;
        color: #f1f5f9;
        border-color: #475569;
      }

      .ctrl-btn:active {
        background: #475569;
      }

      .ctrl-btn svg {
        width: 18px;
        height: 18px;
      }

      .ctrl-stop {
        color: #ef4444;
        border-color: #7f1d1d;
      }

      .ctrl-stop:hover {
        background: #7f1d1d;
        color: #fca5a5;
      }

      /* Camera */
      .camera-section {
        padding: 0;
        position: relative;
        overflow: hidden;
        max-height: 220px;
      }

      .camera-feed {
        width: 100%;
        display: block;
        object-fit: cover;
        filter: brightness(0.95);
      }

      .camera-overlay {
        position: absolute;
        bottom: 8px;
        right: 10px;
        background: rgba(0,0,0,0.6);
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.7rem;
        color: #94a3b8;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      /* Toggles */
      .toggles-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .toggle-card {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 14px 12px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        transition: background 0.2s, border-color 0.2s;
        color: #94a3b8;
      }

      .toggle-card:hover {
        background: #273549;
        border-color: #475569;
      }

      .toggle-card.active {
        background: #1c3052;
        border-color: #3b82f6;
        color: #60a5fa;
      }

      .toggle-icon {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .toggle-icon svg {
        width: 28px;
        height: 28px;
      }

      .toggle-label {
        font-size: 0.78rem;
        font-weight: 600;
        color: #e2e8f0;
        text-align: center;
      }

      .toggle-state {
        font-size: 0.7rem;
        color: inherit;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .toggle-card.active .toggle-state {
        color: #60a5fa;
      }

      /* Sensors */
      .sensors-section {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 8px;
      }

      .sensor-chip {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 10px 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        transition: border-color 0.3s, background 0.3s;
      }

      .sensor-chip.sensor-active {
        border-color: #f59e0b;
        background: #1c1a0a;
      }

      .sensor-icon {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #475569;
        transition: color 0.3s;
      }

      .sensor-chip.sensor-active .sensor-icon {
        color: #f59e0b;
      }

      .sensor-icon svg {
        width: 22px;
        height: 22px;
      }

      .sensor-info {
        text-align: center;
      }

      .sensor-name {
        font-size: 0.68rem;
        color: #94a3b8;
        font-weight: 600;
      }

      .sensor-time {
        font-size: 0.65rem;
        color: #64748b;
        margin-top: 1px;
      }
    `;
  }

  getCardSize() {
    return 6;
  }

  static getConfigElement() {
    return document.createElement("garage-dashboard-card-editor");
  }

  static getStubConfig() {
    return {
      title: "Garaj",
      temp_sensor: "sensor.garage_temperature",
      humidity_sensor: "sensor.garage_humidity",
      cover_entity: "cover.usa_la_garaj",
      cover_simple: "cover.garage_door_simple",
      light_entity: "light.lumina_garaj",
      camera_entity: "camera.garage",
      door_sensor: "binary_sensor.usa_garaj",
      motion_sensor: "binary_sensor.miscare",
      door_ctrl: "cover.usa_garaj_ctrl",
      distance_entity: "sensor.garaj_distance",
    };
  }
}

// Visual editor
class GarageDashboardCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...config };
    this.render();
  }

  get _fields() {
    return [
      { key: "title", label: "Card Title", type: "text" },
      { key: "temp_sensor", label: "Temperature Sensor", type: "text" },
      { key: "humidity_sensor", label: "Humidity Sensor", type: "text" },
      { key: "cover_entity", label: "Cover Entity (with controls)", type: "text" },
      { key: "cover_simple", label: "Cover Simple Toggle", type: "text" },
      { key: "light_entity", label: "Light Entity", type: "text" },
      { key: "camera_entity", label: "Camera Entity", type: "text" },
      { key: "door_sensor", label: "Door Binary Sensor", type: "text" },
      { key: "motion_sensor", label: "Motion Sensor", type: "text" },
      { key: "door_ctrl", label: "Door Control Entity", type: "text" },
      { key: "distance_entity", label: "Distance Sensor (optional)", type: "text" },
      { key: "camera_refresh_interval", label: "Camera Refresh (ms)", type: "number" },
    ];
  }

  _valueChanged(key, value) {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config } }));
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        .editor { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; color: var(--primary-text-color); }
        input { padding: 8px 10px; border-radius: 6px; border: 1px solid var(--divider-color); background: var(--secondary-background-color); color: var(--primary-text-color); font-size: 0.9rem; }
      </style>
      <div class="editor">
        ${this._fields.map(f => `
          <label>
            ${f.label}
            <input type="${f.type}" data-key="${f.key}" value="${this._config[f.key] || ""}" />
          </label>
        `).join("")}
      </div>
    `;

    this.shadowRoot.querySelectorAll("input").forEach(input => {
      input.addEventListener("change", (e) => this._valueChanged(e.target.dataset.key, e.target.value));
    });
  }
}

customElements.define("garage-dashboard-card", GarageDashboardCard);
customElements.define("garage-dashboard-card-editor", GarageDashboardCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "garage-dashboard-card",
  name: "Garage Dashboard Card",
  description: "A comprehensive garage monitoring and control card with camera, sensors, covers, and climate data.",
  preview: true,
  documentationURL: "https://github.com/yourusername/garage-dashboard-card",
});

console.info(
  "%c GARAGE-DASHBOARD-CARD %c v1.0.0 ",
  "color: white; background: #f97316; font-weight: bold; padding: 2px 4px; border-radius: 3px 0 0 3px;",
  "color: #f97316; background: #1e293b; font-weight: bold; padding: 2px 4px; border-radius: 0 3px 3px 0;"
);
