// Speicherung der Projektdaten.
//  - Ohne Einstellungen in config.js: Demo-Modus, die Daten bleiben nur in diesem Browser.
//  - Mit Supabase-Einstellungen: alle im Team sehen und bearbeiten dieselben Daten.
// Beide Varianten haben dieselben zwei Funktionen: load() und save().

const LOCAL_KEY = 'teamplaner-daten-v1';
const CODE_KEY = 'teamplaner-team-code';

export function createStorage(config = {}) {
  if (config.supabaseUrl && config.supabaseKey) return supabaseStorage(config);
  return localStorage_();
}

function localStorage_() {
  return {
    mode: 'local',
    async load() {
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw) return { state: JSON.parse(raw), version: 0 };
      } catch {
        /* beschädigte Daten ignorieren */
      }
      return { state: null, version: 0 };
    },
    async save(state) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
      return { ok: true, version: 0 };
    },
  };
}

function supabaseStorage({ supabaseUrl, supabaseKey }) {
  const url = supabaseUrl.replace(/\/+$/, '') + '/rest/v1/project_state';

  const headers = () => {
    const h = {
      apikey: supabaseKey,
      'Content-Type': 'application/json',
      'x-team-code': localStorage.getItem(CODE_KEY) || '',
    };
    // Klassische Keys sind JWTs (beginnen mit "eyJ"), neue "sb_publishable_"-Keys nicht.
    if (supabaseKey.startsWith('eyJ')) h.Authorization = `Bearer ${supabaseKey}`;
    return h;
  };

  return {
    mode: 'supabase',
    setTeamCode(code) {
      localStorage.setItem(CODE_KEY, code);
    },
    async load() {
      const r = await fetch(`${url}?id=eq.1&select=data,version`, { headers: headers() });
      if (!r.ok) throw new Error(`Laden fehlgeschlagen (HTTP ${r.status}). Stimmen URL und Key in config.js?`);
      const rows = await r.json();
      if (!rows.length) {
        // Bei falschem Team-Code liefert die Datenbank bewusst "keine Zeilen".
        const err = new Error('Team-Code falsch oder schema.sql noch nicht ausgeführt.');
        err.code = 'NOAUTH';
        throw err;
      }
      const { data, version } = rows[0];
      const empty = !data || Object.keys(data).length === 0;
      return { state: empty ? null : data, version };
    },
    // Speichert nur, wenn niemand anderes inzwischen etwas geändert hat (version stimmt noch).
    async save(state, version) {
      const r = await fetch(`${url}?id=eq.1&version=eq.${version}`, {
        method: 'PATCH',
        headers: { ...headers(), Prefer: 'return=representation' },
        body: JSON.stringify({ data: state, version: version + 1, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error(`Speichern fehlgeschlagen (HTTP ${r.status})`);
      const rows = await r.json();
      if (!rows.length) return { ok: false, conflict: true };
      return { ok: true, version: rows[0].version };
    },
  };
}
