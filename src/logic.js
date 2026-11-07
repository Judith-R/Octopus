// Reine Logik des Teamplaners: keine Browser- oder Netzwerk-Abhängigkeiten.
// Wird von der Web-App UND vom Erinnerungs-Skript verwendet und ist getestet (siehe test/).

export const TIME_ZONE = 'Europe/Vienna';

// ---------------------------------------------------------------- Grunddaten

export function newId(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

export function emptyState() {
  return {
    project: { title: 'Mein Gruppenprojekt', topic: '', deadline: '' },
    requirements: [],
    members: [],
    tasks: [],
    meetings: [],
  };
}

// Macht aus beliebigen (ggf. unvollständigen) Daten einen gültigen Zustand.
export function normalizeState(raw) {
  const base = emptyState();
  const s = raw && typeof raw === 'object' ? raw : {};
  const arr = (x) => (Array.isArray(x) ? x : []);
  return {
    project: { ...base.project, ...(s.project || {}) },
    requirements: arr(s.requirements),
    members: arr(s.members),
    tasks: arr(s.tasks).map((t) => ({ ...t, dependsOn: arr(t.dependsOn) })),
    meetings: arr(s.meetings).map((m) => ({
      ...m,
      todos: arr(m.todos).map((t) => ({ ...t, doneBy: arr(t.doneBy) })),
    })),
  };
}

export const REQUIREMENT_PRESETS = [
  { label: 'Seitenanzahl', kind: 'number', unit: 'Seiten', min: 15, max: 20 },
  { label: 'Wortanzahl', kind: 'number', unit: 'Wörter', min: 4000, max: 5000 },
  { label: 'Anzahl Quellen', kind: 'number', unit: 'Quellen', min: 10, max: null },
  { label: 'Schriftart und -größe (z. B. Times New Roman, 12 pt)', kind: 'check' },
  { label: 'Zeilenabstand (z. B. 1,5-fach)', kind: 'check' },
  { label: 'Seitenränder laut Vorgabe', kind: 'check' },
  { label: 'Einheitlicher Zitierstil', kind: 'check' },
  { label: 'Literaturverzeichnis', kind: 'check' },
  { label: 'Deckblatt und Inhaltsverzeichnis', kind: 'check' },
];

export function demoState() {
  return normalizeState({
    project: {
      title: 'Seminararbeit Nachhaltigkeit',
      topic: 'Beispieldaten – bitte durch euer eigenes Thema ersetzen',
      deadline: '2027-01-15',
    },
    requirements: [
      { id: 'r1', label: 'Seitenanzahl', kind: 'number', unit: 'Seiten', min: 15, max: 20, current: 9 },
      { id: 'r2', label: 'Wortanzahl', kind: 'number', unit: 'Wörter', min: 4000, max: 5000, current: 2600 },
      { id: 'r3', label: 'Schriftart und -größe (Times New Roman, 12 pt)', kind: 'check', done: true },
      { id: 'r4', label: 'Zeilenabstand 1,5-fach', kind: 'check', done: false },
      { id: 'r5', label: 'Einheitlicher Zitierstil (APA)', kind: 'check', done: false },
    ],
    members: [
      { id: 'm1', name: 'Anna', email: '', role: 'Recherche' },
      { id: 'm2', name: 'Ben', email: '', role: 'Gliederung' },
      { id: 'm3', name: 'Clara', email: '', role: 'Schreiben' },
      { id: 'm4', name: 'David', email: '', role: 'Schreiben' },
    ],
    tasks: [
      { id: 't1', title: 'Literatur recherchieren', assigneeId: 'm1', due: '2026-11-20', progress: 100, dependsOn: [], notes: '' },
      { id: 't2', title: 'Gliederung erstellen', assigneeId: 'm2', due: '2026-11-27', progress: 75, dependsOn: ['t1'], notes: '' },
      { id: 't3', title: 'Kapitel 1 schreiben', assigneeId: 'm3', due: '2026-12-11', progress: 25, dependsOn: ['t2'], notes: '' },
      { id: 't4', title: 'Kapitel 2 schreiben', assigneeId: 'm4', due: '2026-12-11', progress: 0, dependsOn: ['t2'], notes: '' },
      { id: 't5', title: 'Texte zusammenführen und formatieren', assigneeId: 'm1', due: '2026-12-22', progress: 0, dependsOn: ['t3', 't4'], notes: '' },
      { id: 't6', title: 'Korrekturlesen', assigneeId: 'm2', due: '2027-01-08', progress: 0, dependsOn: ['t5'], notes: '' },
    ],
    meetings: [
      {
        id: 'x1',
        date: '2026-11-12',
        time: '18:00',
        place: 'Bibliothek, Gruppenraum 3',
        agenda: 'Gliederung besprechen',
        todos: [{ id: 'd1', text: 'Mindestens 3 relevante Quellen ausfindig machen', doneBy: ['m1'] }],
      },
    ],
  });
}

// ---------------------------------------------------------------- Datum

const parseISO = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export function isISODate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISO(s));
}

export function daysBetween(fromISO, toISO) {
  return Math.round((parseISO(toISO) - parseISO(fromISO)) / 86400000);
}

export function addDays(iso, n) {
  return new Date(parseISO(iso) + n * 86400000).toISOString().slice(0, 10);
}

// Heutiges Datum (YYYY-MM-DD) in der Zeitzone der Gruppe.
export function todayISO(now = new Date(), tz = TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function formatDate(iso) {
  if (!isISODate(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function weekday(iso) {
  return new Intl.DateTimeFormat('de-AT', { weekday: 'long', timeZone: 'UTC' }).format(new Date(parseISO(iso)));
}

export function sortedMeetings(meetings) {
  return [...meetings].sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));
}

export function nextMeeting(meetings, today) {
  return sortedMeetings(meetings).find((m) => isISODate(m.date) && m.date >= today) || null;
}

// ---------------------------------------------------------------- Aufgaben

export function taskStatus(task) {
  const p = task.progress || 0;
  return p >= 100 ? 'erledigt' : p > 0 ? 'in Arbeit' : 'offen';
}

// Unfertige Aufgaben, auf die diese Aufgabe noch wartet.
export function blockers(task, tasks) {
  return (task.dependsOn || [])
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t) => t && (t.progress || 0) < 100);
}

// Würde "taskId hängt von depId ab" einen Kreis erzeugen (A wartet auf B, B wartet auf A)?
export function wouldCreateCycle(tasks, taskId, depId) {
  if (taskId === depId) return true;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set();
  const stack = [depId];
  while (stack.length) {
    const id = stack.pop();
    if (id === taskId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const d of byId.get(id)?.dependsOn || []) stack.push(d);
  }
  return false;
}

export function hasCycle(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const state = new Map(); // 1 = in Arbeit, 2 = fertig
  const visit = (id) => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const d of byId.get(id)?.dependsOn || []) if (byId.has(d) && visit(d)) return true;
    state.set(id, 2);
    return false;
  };
  return tasks.some((t) => visit(t.id));
}

// Stufe 1 = kann sofort starten, Stufe 2 = wartet auf Stufe 1, usw.
export function taskLevels(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map();
  const visiting = new Set();
  const level = (id) => {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) return 1; // Schutz vor Kreisen
    visiting.add(id);
    let l = 1;
    for (const d of byId.get(id).dependsOn || []) if (byId.has(d)) l = Math.max(l, level(d) + 1);
    visiting.delete(id);
    memo.set(id, l);
    return l;
  };
  return Object.fromEntries(tasks.map((t) => [t.id, level(t.id)]));
}

const average = (nums) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null);

export function memberProgress(memberId, tasks) {
  return average(tasks.filter((t) => t.assigneeId === memberId).map((t) => t.progress || 0));
}

export function overallProgress(tasks) {
  return average(tasks.map((t) => t.progress || 0));
}

export function removeTask(state, id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  for (const t of state.tasks) t.dependsOn = t.dependsOn.filter((d) => d !== id);
}

export function removeMember(state, id) {
  state.members = state.members.filter((m) => m.id !== id);
  for (const t of state.tasks) if (t.assigneeId === id) t.assigneeId = null;
  for (const m of state.meetings) for (const td of m.todos) td.doneBy = td.doneBy.filter((x) => x !== id);
}

// ---------------------------------------------------------------- Formale Vorgaben

export function requirementState(req) {
  if (req.kind === 'check') {
    return req.done ? { state: 'ok', text: 'erfüllt' } : { state: 'open', text: 'offen' };
  }
  const c = req.current;
  const unit = req.unit ? ` ${req.unit}` : '';
  if (c === null || c === undefined || c === '' || Number.isNaN(Number(c))) {
    return { state: 'open', text: 'noch nicht erfasst' };
  }
  const n = Number(c);
  if (req.min != null && n < req.min) return { state: 'low', text: `noch ${req.min - n}${unit} bis zum Minimum` };
  if (req.max != null && n > req.max) return { state: 'high', text: `${n - req.max}${unit} zu viel` };
  return { state: 'ok', text: 'im Rahmen' };
}

export function requirementsSummary(reqs) {
  const ok = reqs.filter((r) => requirementState(r).state === 'ok').length;
  return { ok, total: reqs.length };
}

export function describeRange(req) {
  if (req.kind === 'check') return 'Ja/Nein';
  const unit = req.unit ? ` ${req.unit}` : '';
  if (req.min != null && req.max != null) return `${req.min}–${req.max}${unit}`;
  if (req.min != null) return `mindestens ${req.min}${unit}`;
  if (req.max != null) return `höchstens ${req.max}${unit}`;
  return 'keine Grenze';
}

// ---------------------------------------------------------------- Erinnerungen

export const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export function buildReminder(state, meeting, member) {
  const when = `${weekday(meeting.date)}, ${formatDate(meeting.date)}${meeting.time ? ` um ${meeting.time} Uhr` : ''}`;
  const lines = [`Hallo ${member.name},`, ''];
  lines.push(`morgen findet unser Gruppentreffen statt: ${when}${meeting.place ? ` (${meeting.place})` : ''}.`);
  if (meeting.agenda) lines.push(`Thema: ${meeting.agenda}`);

  const todos = meeting.todos.filter((t) => !t.doneBy.includes(member.id));
  if (todos.length) {
    lines.push('', 'Bis dahin solltest du erledigt haben:');
    for (const t of todos) lines.push(`  - ${t.text}`);
  }

  const mine = state.tasks.filter((t) => t.assigneeId === member.id && (t.progress || 0) < 100);
  if (mine.length) {
    lines.push('', 'Deine offenen Aufgaben im Projekt:');
    for (const t of mine) {
      const wait = blockers(t, state.tasks);
      const extra = wait.length ? `, wartet auf: ${wait.map((w) => w.title).join(', ')}` : '';
      const due = isISODate(t.due) ? `, fällig am ${formatDate(t.due)}` : '';
      lines.push(`  - ${t.title} (${t.progress || 0} %${due}${extra})`);
    }
  }

  const dl = state.project.deadline;
  if (isISODate(dl)) {
    const left = daysBetween(meeting.date, dl);
    if (left >= 0) lines.push('', `Abgabetermin der Arbeit: ${formatDate(dl)} (ab dem Treffen noch ${left} Tage).`);
  }
  lines.push('', 'Bis morgen!', state.project.title || 'Teamplaner');

  return {
    subject: `Erinnerung: Gruppentreffen morgen, ${formatDate(meeting.date)}${meeting.time ? ` um ${meeting.time} Uhr` : ''}`,
    text: lines.join('\n'),
  };
}

// Alle E-Mails, die heute verschickt werden sollen (Treffen findet morgen statt).
export function remindersFor(state, today) {
  const tomorrow = addDays(today, 1);
  const out = [];
  for (const meeting of state.meetings.filter((m) => m.date === tomorrow)) {
    for (const member of state.members.filter((m) => isEmail(m.email))) {
      out.push({ to: member.email.trim(), name: member.name, ...buildReminder(state, meeting, member) });
    }
  }
  return out;
}
