/**
 * Vehicle Dashboard Card
 * A generic, fully configurable vehicle status card for Home Assistant
 * Repository: https://github.com/robman2026/Garage-Dashboard-Card
 * Style: Samsung Premium (Glassmorphism & Soft Glow) + Modern HA elements
 * Version: 1.0.0
 */

// ─────────────────────────────────────────────
//  EDITOR (Visual Config via getConfigForm)
// ─────────────────────────────────────────────
class VehicleDashboardCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) this._render();
  }

  _render() {
    this._rendered = true;
    // The editor is handled via getConfigForm on the main card class.
    // This element is a placeholder — HA uses getConfigForm() directly.
  }
}
customElements.define("vehicle-dashboard-card-editor", VehicleDashboardCardEditor);

// ─────────────────────────────────────────────
//  MAIN CARD
// ─────────────────────────────────────────────
class VehicleDashboardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._refreshTimer = null;
  }

  // ── HA API ──────────────────────────────────
  static getConfigElement() {
    return document.createElement("vehicle-dashboard-card-editor");
  }

  static getStubConfig() {
    return {
      title: "My Vehicle",
      subtitle: "Car",
      car_image: "",
      odometer_entity: "",
      lock_entity: "",
      location_entity: "",
      range_entity: "",
      daily_distance_entity: "",
      daily_trips_entity: "",
      monthly_distance_entity: "",
      monthly_trips_entity: "",
      last_updated_entity: "",
      doors_locked_entity: "",
      flash_lights_entity: "",
      honk_horn_entity: "",
      update_data_entity: "",
      flash_lights_label: "Flash Lights",
      honk_horn_label: "Honk Horn",
      update_data_label: "Update Data",
    };
  }

  static getConfigForm() {
    return {
      schema: [
        // ── Appearance ──────────────────────────
        {
          type: "expandable",
          name: "appearance",
          title: "Appearance",
          flatten: true,
          schema: [
            { name: "title", selector: { text: {} } },
            { name: "subtitle", selector: { text: {} } },
            { name: "car_image", selector: { text: {} } },
          ],
        },
        // ── Status Sensors ──────────────────────
        {
          type: "expandable",
          name: "status",
          title: "Status Sensors",
          flatten: true,
          schema: [
            { name: "odometer_entity", selector: { entity: { domain: "sensor" } } },
            { name: "lock_entity", selector: { entity: {} } },
            { name: "location_entity", selector: { entity: {} } },
            { name: "range_entity", selector: { entity: { domain: "sensor" } } },
            { name: "last_updated_entity", selector: { entity: {} } },
            { name: "doors_locked_entity", selector: { entity: {} } },
          ],
        },
        // ── Trip Statistics ─────────────────────
        {
          type: "expandable",
          name: "trips",
          title: "Trip Statistics",
          flatten: true,
          schema: [
            { name: "daily_distance_entity", selector: { entity: { domain: "sensor" } } },
            { name: "daily_trips_entity", selector: { entity: { domain: "sensor" } } },
            { name: "monthly_distance_entity", selector: { entity: { domain: "sensor" } } },
            { name: "monthly_trips_entity", selector: { entity: { domain: "sensor" } } },
          ],
        },
        // ── Action Buttons ──────────────────────
        {
          type: "expandable",
          name: "actions",
          title: "Action Buttons",
          flatten: true,
          schema: [
            {
              type: "grid",
              name: "",
              flatten: true,
              column_min_width: "200px",
              schema: [
                { name: "flash_lights_entity", selector: { entity: { domain: "button" } } },
                { name: "flash_lights_label", selector: { text: {} } },
                { name: "honk_horn_entity", selector: { entity: { domain: "button" } } },
                { name: "honk_horn_label", selector: { text: {} } },
                { name: "update_data_entity", selector: { entity: { domain: "button" } } },
                { name: "update_data_label", selector: { text: {} } },
              ],
            },
          ],
        },
      ],
      computeLabel: (schema) => {
        const labels = {
          title: "Card Title",
          subtitle: "Subtitle (e.g. Car brand/model)",
          car_image: "Car Image URL or /local/ path",
          odometer_entity: "Odometer Sensor",
          lock_entity: "Lock Status Entity",
          location_entity: "Location Sensor",
          range_entity: "Range Sensor",
          last_updated_entity: "Last Updated Sensor",
          doors_locked_entity: "Doors Locked Entity",
          daily_distance_entity: "Daily Distance Sensor",
          daily_trips_entity: "Daily Trips Sensor",
          monthly_distance_entity: "Monthly Distance Sensor",
          monthly_trips_entity: "Monthly Trips Sensor",
          flash_lights_entity: "Flash Lights Button Entity",
          flash_lights_label: "Flash Lights Button Label",
          honk_horn_entity: "Honk Horn Button Entity",
          honk_horn_label: "Honk Horn Button Label",
          update_data_entity: "Update Data Button Entity",
          update_data_label: "Update Data Button Label",
        };
        return labels[schema.name] || schema.name;
      },
    };
  }

  setConfig(config) {
    this._config = {
      title: "My Vehicle",
      subtitle: "",
      car_image: "",
      flash_lights_label: "Flash Lights",
      honk_horn_label: "Honk Horn",
      update_data_label: "Update Data",
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    return { rows: 8, columns: 6, min_rows: 6 };
  }

  // ── Helpers ──────────────────────────────────
  _state(entityId) {
    if (!entityId || !this._hass) return null;
    return this._hass.states[entityId] || null;
  }

  _val(entityId, fallback = "—") {
    const s = this._state(entityId);
    if (!s) return fallback;
    return s.state === "unknown" || s.state === "unavailable" ? fallback : s.state;
  }

  _attr(entityId, attr, fallback = "—") {
    const s = this._state(entityId);
    if (!s || s.attributes[attr] === undefined) return fallback;
    return s.attributes[attr];
  }

  _unit(entityId) {
    return this._attr(entityId, "unit_of_measurement", "");
  }

  _friendly(entityId) {
    return this._attr(entityId, "friendly_name", entityId || "");
  }

  _isLocked() {
    const v = this._val(this._config.lock_entity, "").toLowerCase();
    return v === "locked" || v === "on" || v === "true";
  }

  _callService(domain, service, entityId) {
    if (!this._hass || !entityId) return;
    this._hass.callService(domain, service, { entity_id: entityId });
  }

  _pressButton(entityId) {
    if (!this._hass || !entityId) return;
    this._hass.callService("button", "press", { entity_id: entityId });
  }

  // ── Render ───────────────────────────────────
  _render() {
    if (!this._config) return;

    const cfg = this._config;
    const locked = this._isLocked();
    const odometer = this._val(cfg.odometer_entity);
    const odomUnit = this._unit(cfg.odometer_entity);
    const location = this._val(cfg.location_entity);
    const range = this._val(cfg.range_entity);
    const rangeUnit = this._unit(cfg.range_entity);
    const lastUpdated = this._val(cfg.last_updated_entity);
    const doorsLocked = this._val(cfg.doors_locked_entity);
    const dailyDist = this._val(cfg.daily_distance_entity);
    const dailyDistUnit = this._unit(cfg.daily_distance_entity);
    const dailyTrips = this._val(cfg.daily_trips_entity);
    const monthlyDist = this._val(cfg.monthly_distance_entity);
    const monthlyDistUnit = this._unit(cfg.monthly_distance_entity);
    const monthlyTrips = this._val(cfg.monthly_trips_entity);

    const lockIcon = locked
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;

    const lockColor = locked ? "#4ade80" : "#f87171";
    const lockLabel = locked ? "Locked" : "Unlocked";

    const hasImage = cfg.car_image && cfg.car_image.trim() !== "";

    // Stat tiles helper
    const tile = (icon, value, unit, label) => `
      <div class="stat-tile">
        <div class="stat-icon">${icon}</div>
        <div class="stat-value">${value}<span class="stat-unit">${unit}</span></div>
        <div class="stat-label">${label}</div>
      </div>`;

    // SVG icons
    const icons = {
      odo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2"/><path d="M12 6v6l4 2"/></svg>`,
      range: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6l6 6-6 6"/><path d="M21 6l-6 6 6 6"/></svg>`,
      distDay: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M5 15V9a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v6"/></svg>`,
      tripsDay: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`,
      distMonth: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M5 15V9a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v6"/><path d="M9 9h6"/></svg>`,
      tripsMonth: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/><line x1="9" y1="8" x2="15" y2="8"/></svg>`,
      location: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
      flash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
      horn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
      update: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
      clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      doors: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="2" width="18" height="20" rx="2"/><line x1="12" y1="10" x2="12" y2="14"/></svg>`,
      car: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2l2-3h8l2 3h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
    };

    const hasActions = cfg.flash_lights_entity || cfg.honk_horn_entity || cfg.update_data_entity;
    const hasStats = cfg.daily_distance_entity || cfg.daily_trips_entity ||
      cfg.monthly_distance_entity || cfg.monthly_trips_entity;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .card {
          background: linear-gradient(145deg, #0f1729 0%, #111827 50%, #0a1020 100%);
          border-radius: 20px;
          border: 1px solid rgba(99, 179, 237, 0.15);
          box-shadow:
            0 0 0 1px rgba(99, 179, 237, 0.05),
            0 8px 32px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          overflow: hidden;
          color: #e2e8f0;
          position: relative;
        }

        /* Soft glow top-right corner */
        .card::before {
          content: '';
          position: absolute;
          top: -60px;
          right: -60px;
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(99, 179, 237, 0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        /* ── Header ── */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 18px 18px 0 18px;
        }

        .header-left .brand {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2px;
          color: #64748b;
          text-transform: uppercase;
        }

        .header-left .model {
          font-size: 22px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: 1px;
          margin-top: 2px;
        }

        .lock-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
          border: 1px solid;
          transition: all 0.3s ease;
        }

        .lock-badge.locked {
          background: rgba(74, 222, 128, 0.1);
          border-color: rgba(74, 222, 128, 0.3);
          color: #4ade80;
        }

        .lock-badge.unlocked {
          background: rgba(248, 113, 113, 0.1);
          border-color: rgba(248, 113, 113, 0.3);
          color: #f87171;
        }

        .lock-badge svg {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        /* ── Car Image ── */
        .image-section {
          padding: 16px 18px 8px;
          position: relative;
        }

        .car-image {
          width: 100%;
          max-height: 180px;
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 8px 24px rgba(99, 179, 237, 0.15));
          border-radius: 10px;
        }

        .car-icon-placeholder {
          width: 100%;
          height: 130px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(99, 179, 237, 0.2);
        }

        .car-icon-placeholder svg {
          width: 80px;
          height: 80px;
        }

        /* ── Primary Info ── */
        .primary-info {
          display: flex;
          gap: 10px;
          padding: 4px 18px 14px;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
        }

        .info-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 12px;
          font-size: 13px;
          color: #94a3b8;
        }

        .info-chip svg {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
          color: #60a5fa;
        }

        .info-chip strong {
          color: #e2e8f0;
          font-weight: 600;
        }

        /* ── Divider ── */
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(99, 179, 237, 0.15), transparent);
          margin: 0 18px;
        }

        /* ── Stats Grid ── */
        .stats-section {
          padding: 14px 18px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .stat-tile {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: background 0.2s;
        }

        .stat-tile:hover {
          background: rgba(99, 179, 237, 0.05);
          border-color: rgba(99, 179, 237, 0.15);
        }

        .stat-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(96, 165, 250, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-icon svg {
          width: 16px;
          height: 16px;
          color: #60a5fa;
        }

        .stat-text {
          flex: 1;
          min-width: 0;
        }

        .stat-value {
          font-size: 15px;
          font-weight: 700;
          color: #f1f5f9;
          line-height: 1.2;
        }

        .stat-unit {
          font-size: 11px;
          font-weight: 400;
          color: #64748b;
          margin-left: 2px;
        }

        .stat-label {
          font-size: 11px;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── Actions ── */
        .actions-section {
          padding: 0 18px 14px;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 14px 8px;
          background: rgba(96, 165, 250, 0.06);
          border: 1px solid rgba(96, 165, 250, 0.15);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #93c5fd;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        .action-btn:hover {
          background: rgba(96, 165, 250, 0.12);
          border-color: rgba(96, 165, 250, 0.35);
          box-shadow: 0 0 12px rgba(96, 165, 250, 0.15);
          transform: translateY(-1px);
        }

        .action-btn:active {
          transform: translateY(0);
          background: rgba(96, 165, 250, 0.2);
        }

        .action-btn svg {
          width: 20px;
          height: 20px;
        }

        .action-btn .btn-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #64748b;
          text-align: center;
          line-height: 1.2;
        }

        /* ── Footer ── */
        .footer {
          padding: 0 18px 16px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .footer-chip {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          font-size: 11px;
          color: #475569;
          flex: 1;
          min-width: 140px;
        }

        .footer-chip svg {
          width: 12px;
          height: 12px;
          flex-shrink: 0;
          color: #334155;
        }

        .footer-chip span {
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .section-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #334155;
          padding: 0 0 8px 0;
        }
      </style>

      <div class="card">
        <!-- Header -->
        <div class="header">
          <div class="header-left">
            ${cfg.subtitle ? `<div class="brand">${cfg.subtitle}</div>` : ""}
            <div class="model">${cfg.title || "My Vehicle"}</div>
          </div>
          ${cfg.lock_entity ? `
            <div class="lock-badge ${locked ? "locked" : "unlocked"}">
              <span style="width:14px;height:14px;display:flex">${lockIcon}</span>
              ${lockLabel}
            </div>
          ` : ""}
        </div>

        <!-- Car Image -->
        <div class="image-section">
          ${hasImage
            ? `<img class="car-image" src="${cfg.car_image}" alt="${cfg.title}" onerror="this.style.display='none'">`
            : `<div class="car-icon-placeholder">${icons.car}</div>`
          }
        </div>

        <!-- Primary Info: Odometer + Location -->
        ${(cfg.odometer_entity || cfg.location_entity) ? `
          <div class="primary-info">
            ${cfg.odometer_entity ? `
              <div class="info-chip">
                ${icons.odo}
                <strong>${odometer}</strong><span style="margin-left:2px;font-size:11px;color:#475569">${odomUnit}</span>
              </div>` : ""}
            ${cfg.location_entity ? `
              <div class="info-chip">
                ${icons.location}
                <strong>${location}</strong>
              </div>` : ""}
            ${cfg.range_entity ? `
              <div class="info-chip">
                ${icons.range}
                <strong>${range}</strong><span style="margin-left:2px;font-size:11px;color:#475569">${rangeUnit}</span>
              </div>` : ""}
          </div>
        ` : ""}

        ${hasStats ? `<div class="divider"></div>` : ""}

        <!-- Trip Statistics -->
        ${hasStats ? `
          <div class="stats-section">
            <div class="section-title">Statistics</div>
            <div class="stats-grid">
              ${cfg.daily_distance_entity ? `
                <div class="stat-tile">
                  <div class="stat-icon">${icons.distDay}</div>
                  <div class="stat-text">
                    <div class="stat-value">${dailyDist}<span class="stat-unit">${dailyDistUnit}</span></div>
                    <div class="stat-label">Daily Distance</div>
                  </div>
                </div>` : ""}
              ${cfg.daily_trips_entity ? `
                <div class="stat-tile">
                  <div class="stat-icon">${icons.tripsDay}</div>
                  <div class="stat-text">
                    <div class="stat-value">${dailyTrips}</div>
                    <div class="stat-label">Daily Trips</div>
                  </div>
                </div>` : ""}
              ${cfg.monthly_distance_entity ? `
                <div class="stat-tile">
                  <div class="stat-icon">${icons.distMonth}</div>
                  <div class="stat-text">
                    <div class="stat-value">${monthlyDist}<span class="stat-unit">${monthlyDistUnit}</span></div>
                    <div class="stat-label">Monthly Distance</div>
                  </div>
                </div>` : ""}
              ${cfg.monthly_trips_entity ? `
                <div class="stat-tile">
                  <div class="stat-icon">${icons.tripsMonth}</div>
                  <div class="stat-text">
                    <div class="stat-value">${monthlyTrips}</div>
                    <div class="stat-label">Monthly Trips</div>
                  </div>
                </div>` : ""}
            </div>
          </div>
        ` : ""}

        ${hasActions ? `<div class="divider"></div>` : ""}

        <!-- Action Buttons -->
        ${hasActions ? `
          <div class="actions-section" style="padding-top:14px">
            <div class="section-title">Controls</div>
            <div class="actions-grid">
              ${cfg.flash_lights_entity ? `
                <button class="action-btn" id="btn-flash">
                  ${icons.flash}
                  <span class="btn-label">${cfg.flash_lights_label || "Flash Lights"}</span>
                </button>` : ""}
              ${cfg.honk_horn_entity ? `
                <button class="action-btn" id="btn-honk">
                  ${icons.horn}
                  <span class="btn-label">${cfg.honk_horn_label || "Honk Horn"}</span>
                </button>` : ""}
              ${cfg.update_data_entity ? `
                <button class="action-btn" id="btn-update">
                  ${icons.update}
                  <span class="btn-label">${cfg.update_data_label || "Update Data"}</span>
                </button>` : ""}
            </div>
          </div>
        ` : ""}

        <!-- Footer: Doors + Last Updated -->
        ${(cfg.doors_locked_entity || cfg.last_updated_entity) ? `
          <div class="divider"></div>
          <div class="footer">
            ${cfg.doors_locked_entity ? `
              <div class="footer-chip">
                ${icons.doors}
                <span><strong style="color:#64748b">Doors:</strong> ${doorsLocked}</span>
              </div>` : ""}
            ${cfg.last_updated_entity ? `
              <div class="footer-chip">
                ${icons.clock}
                <span><strong style="color:#64748b">Updated:</strong> ${lastUpdated}</span>
              </div>` : ""}
          </div>
        ` : ""}
      </div>
    `;

    // ── Event listeners ──────────────────────
    const btnFlash = this.shadowRoot.getElementById("btn-flash");
    if (btnFlash) {
      btnFlash.addEventListener("click", () => {
        this._pressButton(this._config.flash_lights_entity);
        this._ripple(btnFlash);
      });
    }

    const btnHonk = this.shadowRoot.getElementById("btn-honk");
    if (btnHonk) {
      btnHonk.addEventListener("click", () => {
        this._pressButton(this._config.honk_horn_entity);
        this._ripple(btnHonk);
      });
    }

    const btnUpdate = this.shadowRoot.getElementById("btn-update");
    if (btnUpdate) {
      btnUpdate.addEventListener("click", () => {
        this._pressButton(this._config.update_data_entity);
        this._ripple(btnUpdate);
      });
    }
  }

  // Quick visual feedback on button press
  _ripple(el) {
    el.style.boxShadow = "0 0 20px rgba(96, 165, 250, 0.4)";
    el.style.borderColor = "rgba(96, 165, 250, 0.6)";
    setTimeout(() => {
      el.style.boxShadow = "";
      el.style.borderColor = "";
    }, 400);
  }
}

customElements.define("vehicle-dashboard-card", VehicleDashboardCard);

// ── Register in card picker ─────────────────
window.customCards = window.customCards || [];
window.customCards.push({
  type: "vehicle-dashboard-card",
  name: "Vehicle Dashboard Card",
  preview: true,
  description: "A sleek, fully configurable vehicle status card. Supports any car with sensors from Nissan Connect, Tesla, BMW, or other integrations.",
  documentationURL: "https://github.com/robman2026/Garage-Dashboard-Card",
});
