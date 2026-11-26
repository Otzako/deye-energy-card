const DEFAULTS = {
  battery_soc: "sensor.deye_battery",
  battery_power: "sensor.deye_battery_power",
  battery_capacity: "sensor.deye_battery_capacity",
  grid_status: "binary_sensor.deye_grid",
  grid_voltage: "sensor.deye_grid_l1_voltage",
  grid_current: "sensor.deye_grid_l1_current",
  pv_power: "sensor.deye_pv_power",
  load_power: "sensor.deye_load_power",
  grid_power: "sensor.deye_grid_power",
  today_production: "sensor.deye_today_production",
  today_load: "sensor.deye_today_load_consumption",
  today_import: "sensor.deye_today_energy_import",
};

const I18N = {
  uk: {
    level: "Заряд батареї", capacity: "Ємність",
    charge: "Заряд", discharge: "Розряд", idle: "Очікування",
    chargeSub: "Іде заряд", dischargeSub: "Іде розряд", idleSub: "Без струму",
    gridOn: "Мережа є", gridOff: "Мережі немає",
    pv: "Вироблення", load: "Споживання", grid: "Мережа", bat: "Батарея",
    produced: "Зібрано сьогодні", consumed: "Витрачено сьогодні", bought: "Куплено сьогодні",
  },
  ru: {
    level: "Заряд батареи", capacity: "Ёмкость",
    charge: "Заряд", discharge: "Разряд", idle: "Ожидание",
    chargeSub: "Идёт заряд", dischargeSub: "Идёт разряд", idleSub: "Без тока",
    gridOn: "Сеть есть", gridOff: "Сети нет",
    pv: "Выработка", load: "Потребление", grid: "Сеть", bat: "Батарея",
    produced: "Собрано сегодня", consumed: "Потрачено сегодня", bought: "Куплено сегодня",
  },
  en: {
    level: "Battery level", capacity: "Capacity",
    charge: "Charging", discharge: "Discharging", idle: "Idle",
    chargeSub: "Charging", dischargeSub: "Discharging", idleSub: "Idle",
    gridOn: "Grid on", gridOff: "Grid off",
    pv: "Solar", load: "Load", grid: "Grid", bat: "Battery",
    produced: "Produced today", consumed: "Used today", bought: "Bought today",
  },
};

const LABELS = {
  uk: {
    battery_soc: "Заряд батареї, %", battery_power: "Потужність батареї (мінус = заряд)",
    battery_capacity: "Ємність батареї", grid_status: "Стан мережі (binary_sensor)",
    grid_voltage: "Напруга мережі", grid_current: "Струм мережі",
    pv_power: "Потужність панелей", load_power: "Споживання", grid_power: "Потужність мережі",
    today_production: "Вироблено за день", today_load: "Спожито за день", today_import: "Куплено за день",
    name_pv: "Назва плитки: панелі", name_load: "Назва плитки: споживання",
    name_grid: "Назва плитки: мережа", name_battery: "Назва плитки: батарея",
  },
  ru: {
    battery_soc: "Заряд батареи, %", battery_power: "Мощность батареи (минус = заряд)",
    battery_capacity: "Ёмкость батареи", grid_status: "Состояние сети (binary_sensor)",
    grid_voltage: "Напряжение сети", grid_current: "Ток сети",
    pv_power: "Мощность панелей", load_power: "Потребление", grid_power: "Мощность сети",
    today_production: "Выработано за день", today_load: "Потреблено за день", today_import: "Куплено за день",
    name_pv: "Название плитки: панели", name_load: "Название плитки: потребление",
    name_grid: "Название плитки: сеть", name_battery: "Название плитки: батарея",
  },
  en: {
    battery_soc: "Battery level, %", battery_power: "Battery power (negative = charging)",
    battery_capacity: "Battery capacity", grid_status: "Grid status (binary_sensor)",
    grid_voltage: "Grid voltage", grid_current: "Grid current",
    pv_power: "Solar power", load_power: "Load power", grid_power: "Grid power",
    today_production: "Produced today", today_load: "Used today", today_import: "Bought today",
    name_pv: "Tile name: solar", name_load: "Tile name: load",
    name_grid: "Tile name: grid", name_battery: "Tile name: battery",
  },
};

class DeyeEnergyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-entity]");
      if (!t) return;
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId: t.dataset.entity }, bubbles: true, composed: true,
      }));
    });
  }

  setConfig(config) {
    this._c = config;
    this._last = null;
    this._render();
  }

  set hass(h) {
    this._hass = h;
    this._render();
  }

  connectedCallback() {
    this._timer = setInterval(() => this._render(), 60000);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
  }

  getCardSize() { return 5; }

  static getConfigElement() {
    return document.createElement("deye-energy-card-editor");
  }

  static getStubConfig() {
    return { ...DEFAULTS };
  }

  _esc(s) {
    return String(s).replace(/[&<>"']/g, (ch) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
  }

  _st(key) {
    const id = this._c && this._c[key];
    return id && this._hass ? this._hass.states[id] || null : null;
  }

  _num(key) {
    const s = this._st(key);
    if (!s) return null;
    const n = parseFloat(s.state);
    return isNaN(n) ? null : n;
  }

  _fmtNum(n, unit, digits) {
    const nf = new Intl.NumberFormat(this._loc, { maximumFractionDigits: digits });
    return `${nf.format(n)} ${unit || ""}`.trim();
  }

  _fmt(key, digits = 0) {
    const s = this._st(key);
    const n = this._num(key);
    if (!s || n === null) return "—";
    return this._fmtNum(n, s.attributes.unit_of_measurement, digits);
  }

  _rel(iso) {
    const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    const rtf = new Intl.RelativeTimeFormat(this._loc, { numeric: "always" });
    if (sec < 3600) return rtf.format(-Math.max(1, Math.floor(sec / 60)), "minute");
    if (sec < 86400) return rtf.format(-Math.floor(sec / 3600), "hour");
    return rtf.format(-Math.floor(sec / 86400), "day");
  }

  _render() {
    if (!this._c || !this._hass) return;
    const h = this._hass;
    const c = this._c;
    this._loc = (h.locale && h.locale.language) || h.language || "en";
    const L = I18N[this._loc.slice(0, 2)] || I18N.en;
    const e = (s) => this._esc(s);

    const soc = this._num("battery_soc");
    const bp = this._num("battery_power");
    const mode = bp === null || Math.abs(bp) < 5 ? "idle" : bp < 0 ? "charge" : "discharge";
    const modeColor = { charge: "#4caf50", discharge: "#ff9800", idle: "" }[mode];
    const barColor = soc === null ? "transparent" : soc >= 50 ? "#4caf50" : soc >= 20 ? "#ff9800" : "#e53935";
    const pct = soc === null ? 0 : Math.max(0, Math.min(100, soc));
    const cap = c.battery_capacity ? `${L.capacity} ${this._fmt("battery_capacity", 1)}` : "";

    let gridRow = "";
    const gs = this._st("grid_status");
    if (gs) {
      const known = gs.state === "on" || gs.state === "off";
      const on = gs.state === "on";
      const dot = !known ? "var(--secondary-text-color)" : on ? "#4caf50" : "#e53935";
      const extra = [
        this._rel(gs.last_changed),
        c.grid_voltage ? this._fmt("grid_voltage", 0) : "",
        c.grid_current ? this._fmt("grid_current", 2) : "",
      ].filter(Boolean).join(" · ");
      gridRow = `<div class="grid-row" data-entity="${e(c.grid_status)}">
        <span class="dot" style="background:${dot}"></span>
        <span>${known ? (on ? L.gridOn : L.gridOff) : "—"}</span>
        <span class="muted">· ${e(extra)}</span></div>`;
    }

    const tiles = [
      ["pv_power", c.name_pv || L.pv, "mdi:solar-power",
        c.today_production ? `${L.produced} ${this._fmt("today_production", 1)}` : "", "", "today_production"],
      ["load_power", c.name_load || L.load, "mdi:home",
        c.today_load ? `${L.consumed} ${this._fmt("today_load", 1)}` : "", "", "today_load"],
      ["grid_power", c.name_grid || L.grid, "mdi:transmission-tower",
        c.today_import ? `${L.bought} ${this._fmt("today_import", 1)}` : "", "", "today_import"],
      ["battery_power", c.name_battery || L.bat, "mdi:battery",
        c.battery_power && bp !== null ? L[mode + "Sub"] : "", modeColor, ""],
    ].map(([key, name, icon, sub, accent, subKey]) => `
      <div class="tile${accent ? " mode" : ""}"${accent ? ` style="--tile-accent:${accent}"` : ""}${c[key] ? ` data-entity="${e(c[key])}"` : ""}>
        <div class="lb"><ha-icon icon="${icon}"></ha-icon>${e(name)}</div>
        <div class="v">${this._fmt(key, 0)}</div>
        ${sub ? `<div class="s"${subKey && c[subKey] ? ` data-entity="${e(c[subKey])}"` : ""}>${e(sub)}</div>` : ""}
      </div>`).join("");

    const html = `
      <style>
        :host { display: block; }
        ha-card { padding: 14px; overflow: hidden; }
        .battery-row { display: flex; align-items: center; margin-bottom: 12px; }
        .battery { position: relative; flex: 1; min-width: 0; height: 60px; box-sizing: border-box;
                   border: 2px solid color-mix(in srgb, var(--primary-text-color) 35%, transparent);
                   border-radius: 12px; overflow: hidden; cursor: pointer;
                   background: color-mix(in srgb, var(--primary-text-color) 6%, transparent); }
        .fill { position: absolute; left: 0; top: 0; bottom: 0; }
        .inside { position: absolute; inset: 0; display: flex; flex-direction: column;
                  align-items: center; justify-content: center; pointer-events: none; }
        .pct { font-size: 24px; font-weight: 500; line-height: 1.2; }
        .cap { font-size: 12px; color: var(--secondary-text-color); pointer-events: auto; cursor: pointer; }
        .nub { width: 5px; height: 22px; margin-left: 2px; border-radius: 0 3px 3px 0;
               background: color-mix(in srgb, var(--primary-text-color) 35%, transparent); }
        .lb { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--secondary-text-color); }
        .lb ha-icon { --mdc-icon-size: 14px; }
        .grid-row { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 12px; flex-wrap: wrap; cursor: pointer; }
        .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
        .muted, .s { color: var(--secondary-text-color); }
        .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .tile { border-radius: 8px; padding: 10px 12px; cursor: pointer;
                background: color-mix(in srgb, var(--primary-text-color) 6%, transparent); }
        .tile.mode { background: color-mix(in srgb, var(--tile-accent) 16%, transparent); }
        .tile.mode .v { color: var(--tile-accent); }
        .v { font-size: 22px; font-weight: 500; line-height: 1.3; }
        .s { font-size: 12px; }
      </style>
      <ha-card>
        <div class="battery-row">
          <div class="battery"${c.battery_soc ? ` data-entity="${e(c.battery_soc)}"` : ""}>
            <div class="fill" style="width:${pct}%;background:color-mix(in srgb, ${barColor} 65%, transparent)"></div>
            <div class="inside">
              <div class="pct">${soc === null ? "—" : Math.round(soc) + "%"}</div>
              ${cap ? `<div class="cap"${c.battery_capacity ? ` data-entity="${e(c.battery_capacity)}"` : ""}>${e(cap)}</div>` : ""}
            </div>
          </div>
          <div class="nub"></div>
        </div>
        ${gridRow}
        <div class="tiles">${tiles}</div>
      </ha-card>`;

    if (html !== this._last) {
      this.shadowRoot.innerHTML = html;
      this._last = html;
    }
  }

class DeyeEnergyCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._update();
  }

  set hass(h) {
    this._hass = h;
    this._update();
  }

  _schema() {
    const ent = (name, domain) => ({ name, selector: { entity: { domain } } });
    const txt = (name) => ({ name, selector: { text: {} } });
    return [
      ent("battery_soc", "sensor"), ent("battery_power", "sensor"), ent("battery_capacity", "sensor"),
      ent("grid_status", "binary_sensor"), ent("grid_voltage", "sensor"), ent("grid_current", "sensor"),
      ent("pv_power", "sensor"), ent("load_power", "sensor"), ent("grid_power", "sensor"),
      ent("today_production", "sensor"), ent("today_load", "sensor"), ent("today_import", "sensor"),
      txt("name_pv"), txt("name_load"), txt("name_grid"), txt("name_battery"),
    ];
  }

  _update() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.schema = this._schema();
      this._form.computeLabel = (s) => {
        const lang = ((this._hass.locale && this._hass.locale.language) || this._hass.language || "en").slice(0, 2);
        return (LABELS[lang] || LABELS.en)[s.name] || s.name;
      };
      this._form.addEventListener("value-changed", (ev) => {
        const config = { ...ev.detail.value };
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", {
          detail: { config }, bubbles: true, composed: true,
        }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
  }
}

customElements.define("deye-energy-card", DeyeEnergyCard);
customElements.define("deye-energy-card-editor", DeyeEnergyCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "deye-energy-card",
  name: "Deye: енергія (Deye Energy Card)",
  description: "Компактна картка інвертора Deye: батарея, мережа, потужності",
  preview: true,
});
