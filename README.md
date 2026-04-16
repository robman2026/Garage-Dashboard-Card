# Garage Dashboard Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/garage-dashboard-card)

A sleek, all-in-one custom Home Assistant Lovelace card for comprehensive garage monitoring and control. Combines temperature/humidity, cover controls, live camera feed, lights, and sensors into a single cohesive dark-themed panel.

![Garage Dashboard Card Preview](preview.png)

---

## ✨ Features

- 🌡️ **Temperature & Humidity Gauge** — animated arc gauge with color gradient needle
- 🚗 **Cover Controls** — open / stop / close with position percentage and last-changed time
- 📷 **Live Camera Feed** — auto-refreshing camera image with configurable interval
- 💡 **Light Toggle** — one-tap garage light control with on/off state indicator
- 🔄 **Simple Cover Toggle** — optional secondary door toggle
- 📍 **Distance Sensor** — shows distance/location badge (optional)
- 🚨 **Binary Sensors Row** — door sensor, motion sensor, and door control with relative timestamps
- 🟢 **Status Dot** — live indicator in the header showing whether the garage is open or closed

---

## 📦 Installation

### Via HACS (Recommended)

1. Open HACS in your Home Assistant instance
2. Go to **Frontend** → click the **⋮** menu → **Custom repositories**
3. Add `https://github.com/robman2026/garage-dashboard-card` as a **Lovelace** repository
4. Click **Install** on the "Garage Dashboard Card" card
5. Refresh your browser

### Manual

1. Download `garage-dashboard-card.js` from the [latest release](https://github.com/yourusername/garage-dashboard-card/releases)
2. Copy it to `config/www/garage-dashboard-card/garage-dashboard-card.js`
3. Add the resource in **Settings → Dashboards → Resources**:
4. Restart Home Assistant or clear your browser cache
   
## Cards in this repository

### Garage Dashboard Card
Resource URL: `/hacsfiles/Garage-Dashboard-Card/garage-dashboard-card.js`

```
## ⚙️ Configuration

Add the card to your Lovelace dashboard via the UI editor or YAML:

```yaml
type: custom:garage-dashboard-card
title: Garaj
temp_sensor: sensor.garage_temperature
humidity_sensor: sensor.garage_humidity
cover_entity: cover.usa_la_garaj
cover_simple: cover.garage_door_simple
light_entity: light.lumina_garaj
camera_entity: camera.garage
door_sensor: binary_sensor.usa_garaj
motion_sensor: binary_sensor.miscare
door_ctrl: cover.usa_garaj_ctrl
distance_entity: sensor.garaj_distance
camera_refresh_interval: 5000
temp_min: 0
temp_max: 40
```

---

## 🔧 Configuration Options

| Option | Type | Default | Required | Description |
|---|---|---|---|---|
| `title` | `string` | `Garaj` | No | Card title shown in header |
| `temp_sensor` | `string` | — | No | Temperature sensor entity ID |
| `humidity_sensor` | `string` | — | No | Humidity sensor entity ID |
| `cover_entity` | `string` | — | No | Main cover entity (with up/stop/down controls) |
| `cover_simple` | `string` | — | No | Secondary toggle-style cover entity |
| `light_entity` | `string` | — | No | Light entity to toggle |
| `camera_entity` | `string` | — | No | Camera entity for live feed |
| `door_sensor` | `binary_sensor` | — | No | Door binary sensor entity |
| `motion_sensor` | `binary_sensor` | — | No | Motion binary sensor entity |
| `door_ctrl` | `string` | — | No | Door control entity |
| `distance_entity` | `string` | — | No | Distance/location sensor (optional badge) |
| `camera_refresh_interval` | `number` | `5000` | No | Camera refresh interval in ms |
| `temp_min` | `number` | `0` | No | Minimum value for temperature gauge |
| `temp_max` | `number` | `40` | No | Maximum value for temperature gauge |

All entities are optional — omitting one simply hides that section from the card.

---

## 🎨 Design

The card uses a dark slate color scheme (`#0f172a` base) designed to blend naturally with Home Assistant's default dark theme. Key design highlights:

- Arc gauge with a smooth blue→green→yellow→red gradient
- Animated needle driven by the live temperature value  
- Color-coded door state (green = closed, red = open, amber = moving)
- Active sensor chips highlighted in amber on motion/door events
- Active toggles illuminate in blue
- Auto-refreshing camera with timestamp overlay

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgements

Built for the Home Assistant community. Inspired by the official Lovelace mushroom cards and custom-card-ux guidelines.
