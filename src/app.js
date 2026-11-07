import * as L from './logic.js';
import { createStorage } from './storage.js';
import { CONFIG } from '../config.js';

// ------------------------------------------------------------------ Zustand

const storage = createStorage(CONFIG);
let state = L.emptyState();
let version = 0;
let tab = 'overview';
let saveChain = Promise.resolve();

const TABS = ['overview', 'team', 'tasks', 'reqs', 'meetings'];
const PROGRESS_STEPS = [0, 25, 50, 75, 100];

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function toast(msg, ms = 4000) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), ms);
}

// ------------------------------------------------------------------ Speichern

function queueSave() {
  saveChain = saveChain.then(doSave);
}

async function doSave() {
  try {
    const res = await storage.save(state, version);
    if (res.conflict) {
      toast('Jemand anderes hat gleichzeitig etwas geändert. Die neuesten Daten wurden geladen – bitte die Änderung wiederholen.', 8000);
      await reload();
      return;
    }
    version = res.version;
  } catch (err) {
    toast(err.message, 8000);
  }
}

async function reload() {
  const r = await storage.load();
  state = L.normalizeState(r.state);
  version = r.version;
  render();
}

function change(fn) {
  fn();
  render();
  queueSave();
}

// ------------------------------------------------------------------ Start

async function boot() {
  let r = null;
  for (let attempt = 0; attempt < 3 && !r; attempt++) {
    try {
      r = await storage.load();
    } catch (err) {
      if (err.code === 'NOAUTH' && storage.setTeamCode) {
        const code = prompt(
          attempt === 0
            ? 'Bitte den Team-Code eingeben (den kennt, wer die Datenbank eingerichtet hat):'
            : 'Der Code hat nicht gepasst. Bitte noch einmal eingeben:'
        );
        if (!code) return fatal('Ohne Team-Code können keine Daten geladen werden. Seite neu laden, um es erneut zu versuchen.');
        storage.setTeamCode(code.trim());
        continue;
      }
      return fatal(err.message);
    }
  }
  if (!r) return fatal('Der Team-Code war dreimal falsch. Seite neu laden, um es erneut zu versuchen.');

  state = L.normalizeState(r.state);
  version = r.version;
  tab = tabFromHash();
  render();
  if (r.state === null && storage.mode === 'supabase') queueSave(); // leeres Projekt anlegen

  if (storage.mode === 'supabase') {
    setInterval(async () => {
      if (document.hidden || $('#dlg').open) return;
      await saveChain;
      try {
        const latest = await storage.load();
        if (latest.version !== version) {
          state = L.normalizeState(latest.state);
          version = latest.version;
          render();
        }
      } catch {
        /* nächster Versuch in 30 Sekunden */
      }
    }, 30000);
  }
}

function fatal(msg) {
  $('#main').innerHTML = `<div class="empty"><h2>Das hat nicht geklappt</h2><p>${esc(msg)}</p></div>`;
}

function tabFromHash() {
  const h = location.hash.slice(1);
  return TABS.includes(h) ? h : 'overview';
}

// ------------------------------------------------------------------ Bausteine

const bar = (p) =>
  `<div class="bar ${p >= 100 ? 'done' : ''}" role="progressbar" aria-valuenow="${p ?? 0}" aria-valuemin="0" aria-valuemax="100"><span style="width:${p ?? 0}%"></span></div>`;

const memberName = (id) => state.members.find((m) => m.id === id)?.name;

function relativeDays(iso, today) {
  const d = L.daysBetween(today, iso);
  if (d === 0) return 'heute';
  if (d === 1) return 'morgen';
  if (d > 1) return `in ${d} Tagen`;
  return `vor ${-d} Tag${-d === 1 ? '' : 'en'}`;
}

function meetingWhen(m) {
  return `${L.weekday(m.date)}, ${L.formatDate(m.date)}${m.time ? ` · ${esc(m.time)} Uhr` : ''}`;
}

function taskLine(t) {
  const wait = L.blockers(t, state.tasks);
  const who = memberName(t.assigneeId) || 'nicht zugeteilt';
  return `<li><strong>${esc(t.title)}</strong> <span class="muted">– ${esc(who)}</span>${
    wait.length ? `<span class="sub muted small" style="display:block">wartet auf: ${wait.map((w) => esc(w.title)).join(', ')}</span>` : ''
  }</li>`;
}

// ------------------------------------------------------------------ Ansichten

function viewOverview() {
  const { tasks, members, requirements, meetings, project } = state;
  if (!members.length && !tasks.length && !requirements.length && !meetings.length) return viewWelcome();

  const today = L.todayISO();
  const overall = L.overallProgress(tasks);
  const done = tasks.filter((t) => (t.progress || 0) >= 100).length;
  const next = L.nextMeeting(meetings, today);
  const sum = L.requirementsSummary(requirements);

  let deadline = '<div class="big">–</div><div class="muted">noch nicht festgelegt</div>';
  if (L.isISODate(project.deadline)) {
    const d = L.daysBetween(today, project.deadline);
    const sub = d > 0 ? `noch ${plural(d, 'Tag', 'Tage')}` : d === 0 ? 'heute!' : `seit ${plural(-d, 'Tag', 'Tagen')} überschritten`;
    deadline = `<div class="big">${L.formatDate(project.deadline)}</div><div class="${d < 0 ? 'pill bad' : 'muted'}">${sub}</div>`;
  }

  const nextCard = next
    ? `<div class="big">${L.formatDate(next.date)}</div>
       <div class="muted">${meetingWhen(next)} (${relativeDays(next.date, today)})${next.place ? `<br>${esc(next.place)}` : ''}</div>
       ${next.todos.length ? `<ul>${next.todos.map((t) => `<li>${esc(t.text)}</li>`).join('')}</ul>` : ''}`
    : '<div class="big">–</div><div class="muted">Kein Termin geplant</div>';

  const open = tasks.filter((t) => (t.progress || 0) < 100);
  const ready = open.filter((t) => !L.blockers(t, tasks).length);
  const waiting = open.filter((t) => L.blockers(t, tasks).length);

  return `
    <div class="page-head">
      <div><h1>${esc(project.title)}</h1>${project.topic ? `<p class="muted">${esc(project.topic)}</p>` : ''}</div>
      <button data-action="edit-project">Projekt bearbeiten</button>
    </div>

    <div class="grid">
      <div class="card">
        <div class="label">Gesamtfortschritt</div>
        <div class="big">${overall ?? 0} %</div>
        ${bar(overall ?? 0)}
        <p class="muted small" style="margin-top:.5rem">${done} von ${tasks.length} Aufgaben erledigt</p>
      </div>
      <div class="card"><div class="label">Abgabetermin</div>${deadline}</div>
      <div class="card"><div class="label">Nächstes Treffen</div>${nextCard}</div>
      <div class="card">
        <div class="label">Formale Vorgaben</div>
        <div class="big">${sum.ok} / ${sum.total}</div>
        ${bar(sum.total ? Math.round((sum.ok / sum.total) * 100) : 0)}
        <p class="muted small" style="margin-top:.5rem">erfüllt</p>
      </div>
    </div>

    <section>
      <h2>Fortschritt im Team</h2>
      <div class="card">
        ${
          members.length
            ? members
                .map((m) => {
                  const p = L.memberProgress(m.id, tasks);
                  return `<div class="row"><span>${esc(m.name)}</span>${bar(p ?? 0)}<span class="pct">${p === null ? '–' : p + ' %'}</span></div>`;
                })
                .join('')
            : '<p class="muted">Noch keine Personen angelegt.</p>'
        }
      </div>
    </section>

    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
      <div class="card"><h3>Kann jetzt starten</h3>${
        ready.length ? `<ul>${ready.map(taskLine).join('')}</ul>` : '<p class="muted">Keine offenen Aufgaben ohne Vorarbeit.</p>'
      }</div>
      <div class="card"><h3>Wartet auf Vorarbeit</h3>${
        waiting.length ? `<ul>${waiting.map(taskLine).join('')}</ul>` : '<p class="muted">Nichts blockiert.</p>'
      }</div>
    </div>`;
}

function viewWelcome() {
  return `<div class="empty">
    <h1>Willkommen beim Teamplaner</h1>
    <p>Hier organisiert ihr eure Gruppenarbeit: Team, Aufgaben mit Abhängigkeiten, formale Vorgaben und Termine.</p>
    <div class="btns">
      <button class="primary" data-action="edit-project">Projekt einrichten</button>
      <button data-action="load-demo">Mit Beispieldaten ausprobieren</button>
    </div>
  </div>`;
}

function viewTeam() {
  const items = state.members
    .map((m) => {
      const mine = state.tasks.filter((t) => t.assigneeId === m.id);
      const p = L.memberProgress(m.id, state.tasks);
      return `<div class="item">
        <div class="item-head">
          <div><h3>${esc(m.name)}</h3>
            <span class="muted small">${esc(m.role || 'keine Rolle')} · ${m.email ? esc(m.email) : 'keine E-Mail hinterlegt'}</span></div>
          <button class="small" data-action="edit-member" data-id="${esc(m.id)}">Bearbeiten</button>
        </div>
        <div class="row" style="grid-template-columns:1fr 3rem"><div>${bar(p ?? 0)}</div><span class="pct">${p === null ? '–' : p + ' %'}</span></div>
        <div class="muted small">${plural(mine.length, 'Aufgabe', 'Aufgaben')}, ${mine.filter((t) => (t.progress || 0) >= 100).length} erledigt</div>
      </div>`;
    })
    .join('');

  return `
    <div class="page-head">
      <div><h1>Team</h1><p class="muted">Wer arbeitet mit? Die E-Mail-Adresse wird für die Treffen-Erinnerung gebraucht.</p></div>
      <button class="primary" data-action="add-member">+ Person hinzufügen</button>
    </div>
    ${items ? `<div class="list">${items}</div>` : '<div class="empty"><p>Noch niemand im Team.</p></div>'}`;
}

function viewTasks() {
  const today = L.todayISO();
  const levels = L.taskLevels(state.tasks);
  const sorted = [...state.tasks].sort(
    (a, b) => levels[a.id] - levels[b.id] || (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title)
  );

  const rows = sorted
    .map((t) => {
      const p = t.progress || 0;
      const wait = L.blockers(t, state.tasks);
      const steps = PROGRESS_STEPS.includes(p) ? PROGRESS_STEPS : [...PROGRESS_STEPS, p].sort((a, b) => a - b);
      const overdue = L.isISODate(t.due) && t.due < today && p < 100;
      const waitCell = p >= 100 ? '<span class="muted">–</span>' : wait.length
        ? wait.map((w) => `<span class="pill warn">${esc(w.title)}</span>`).join(' ')
        : '<span class="pill ok">kann starten</span>';
      return `<tr class="${p >= 100 ? 'is-done' : ''}">
        <td><span class="pill blue">${levels[t.id]}</span></td>
        <td><strong>${esc(t.title)}</strong>${t.notes ? `<span class="sub">${esc(t.notes)}</span>` : ''}</td>
        <td>${esc(memberName(t.assigneeId) || '–')}</td>
        <td>${L.isISODate(t.due) ? L.formatDate(t.due) : '–'}${overdue ? ' <span class="pill bad">überfällig</span>' : ''}</td>
        <td>${waitCell}</td>
        <td><select data-change="task-progress" data-id="${esc(t.id)}" aria-label="Fortschritt">${steps
          .map((s) => `<option value="${s}" ${s === p ? 'selected' : ''}>${s} %</option>`)
          .join('')}</select></td>
        <td><button class="small" data-action="edit-task" data-id="${esc(t.id)}">Bearbeiten</button></td>
      </tr>`;
    })
    .join('');

  return `
    <div class="page-head">
      <div><h1>Aufgaben</h1>
        <p class="muted">Die <span class="pill blue">Stufe</span> zeigt die Reihenfolge: Stufe 1 kann sofort starten, Stufe 2 wartet auf Stufe 1 usw.</p></div>
      <button class="primary" data-action="add-task">+ Aufgabe hinzufügen</button>
    </div>
    ${
      rows
        ? `<div class="table-wrap"><table>
            <thead><tr><th>Stufe</th><th>Aufgabe</th><th>Verantwortlich</th><th>Fällig</th><th>Wartet auf</th><th>Fortschritt</th><th></th></tr></thead>
            <tbody>${rows}</tbody></table></div>`
        : '<div class="empty"><p>Noch keine Aufgaben.</p></div>'
    }`;
}

function viewReqs() {
  const sum = L.requirementsSummary(state.requirements);
  const rows = state.requirements
    .map((r) => {
      const st = L.requirementState(r);
      const actual =
        r.kind === 'check'
          ? `<label><input type="checkbox" data-change="req-done" data-id="${esc(r.id)}" ${r.done ? 'checked' : ''}> erledigt</label>`
          : `<input type="number" step="any" data-change="req-current" data-id="${esc(r.id)}" value="${r.current ?? ''}" aria-label="Aktueller Wert"> ${esc(r.unit || '')}`;
      return `<tr>
        <td><strong>${esc(r.label)}</strong></td>
        <td>${esc(L.describeRange(r))}</td>
        <td>${actual}</td>
        <td><span class="pill ${st.state}">${esc(st.text)}</span></td>
        <td><button class="small" data-action="edit-req" data-id="${esc(r.id)}">Bearbeiten</button></td>
      </tr>`;
    })
    .join('');

  return `
    <div class="page-head">
      <div><h1>Formale Vorgaben</h1>
        <p class="muted">${sum.total ? `${sum.ok} von ${sum.total} Vorgaben erfüllt.` : 'Seitenzahl, Wörter, Formatierung … alles, was die Lehrperson verlangt.'}</p></div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button data-action="add-presets">Typische Vorgaben einfügen</button>
        <button class="primary" data-action="add-req">+ Vorgabe hinzufügen</button>
      </div>
    </div>
    ${
      rows
        ? `<div class="table-wrap"><table>
            <thead><tr><th>Vorgabe</th><th>Soll</th><th>Ist</th><th>Status</th><th></th></tr></thead>
            <tbody>${rows}</tbody></table></div>`
        : '<div class="empty"><p>Noch keine Vorgaben. Mit „Typische Vorgaben einfügen“ bekommt ihr eine Startliste, die ihr anpassen könnt.</p></div>'
    }`;
}

function viewMeetings() {
  const today = L.todayISO();
  const mailCount = state.members.filter((m) => L.isEmail(m.email)).length;
  const all = L.sortedMeetings(state.meetings);
  const upcoming = all.filter((m) => m.date >= today);
  const past = all.filter((m) => m.date < today).reverse();

  const card = (m) => {
    const isPast = m.date < today;
    const remindDate = L.addDays(m.date, -1);
    let reminder = '';
    if (!isPast && remindDate >= today) {
      reminder = mailCount
        ? `<span class="pill blue">Erinnerung am ${L.formatDate(remindDate)} an ${plural(mailCount, 'Person', 'Personen')}</span>`
        : '<span class="pill warn">Keine E-Mail-Adressen im Team hinterlegt</span>';
    }
    const todos = m.todos
      .map(
        (t) => `<li><div>${esc(t.text)}</div><div class="chips">${state.members
          .map(
            (mb) =>
              `<button type="button" class="chip ${t.doneBy.includes(mb.id) ? 'on' : ''}" data-action="toggle-todo" data-m="${esc(m.id)}" data-t="${esc(t.id)}" data-mb="${esc(mb.id)}" title="Klicken zum Umschalten">${
                t.doneBy.includes(mb.id) ? '✓ ' : ''
              }${esc(mb.name)}</button>`
          )
          .join('')}</div></li>`
      )
      .join('');
    return `<div class="item ${isPast ? 'past' : ''}">
      <div class="item-head">
        <div><h3>${meetingWhen(m)}</h3>
          <span class="muted small">${m.place ? esc(m.place) : 'kein Ort angegeben'}${isPast ? '' : ' · ' + relativeDays(m.date, today)}</span></div>
        <button class="small" data-action="edit-meeting" data-id="${esc(m.id)}">Bearbeiten</button>
      </div>
      ${m.agenda ? `<p style="margin:.5rem 0 0">${esc(m.agenda)}</p>` : ''}
      ${reminder ? `<p style="margin:.5rem 0 0">${reminder}</p>` : ''}
      ${todos ? `<h3 style="margin-top:.75rem" class="small muted">Aufgaben bis zum Treffen (grün = erledigt)</h3><ul class="todos">${todos}</ul>` : ''}
    </div>`;
  };

  const dl = state.project.deadline;
  const deadlineCard = L.isISODate(dl)
    ? `<div class="item"><div class="item-head"><div><h3>Abgabetermin: ${L.weekday(dl)}, ${L.formatDate(dl)}</h3>
        <span class="muted small">${relativeDays(dl, today)} · im Bereich „Übersicht → Projekt bearbeiten“ änderbar</span></div></div></div>`
    : `<div class="item"><span class="muted">Abgabetermin noch nicht festgelegt (Übersicht → Projekt bearbeiten).</span></div>`;

  return `
    <div class="page-head">
      <div><h1>Termine</h1><p class="muted">Einen Tag vor jedem Treffen bekommt jede Person mit E-Mail-Adresse eine Erinnerung samt ihren offenen Aufgaben.</p></div>
      <button class="primary" data-action="add-meeting">+ Treffen hinzufügen</button>
    </div>
    <section><div class="list">${deadlineCard}</div></section>
    <section><h2>Kommende Treffen</h2>${
      upcoming.length ? `<div class="list">${upcoming.map(card).join('')}</div>` : '<div class="empty"><p>Kein Treffen geplant.</p></div>'
    }</section>
    ${past.length ? `<section><h2>Vergangene Treffen</h2><div class="list">${past.map(card).join('')}</div></section>` : ''}`;
}

function render() {
  $('#brand-title').textContent = state.project.title || 'Teamplaner';
  document.title = `${state.project.title || 'Teamplaner'} – Teamplaner`;
  for (const b of document.querySelectorAll('#tabs button')) {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  const badge = $('#mode-badge');
  const local = storage.mode === 'local';
  badge.textContent = local ? 'Demo-Modus' : 'Gemeinsame Daten';
  badge.className = 'badge' + (local ? ' warn' : '');

  const notice = $('#notice');
  notice.hidden = !local;
  if (local) {
    notice.textContent =
      'Demo-Modus: Die Daten liegen nur in diesem Browser. Damit alle im Team dieselben Daten sehen und E-Mail-Erinnerungen verschickt werden können, richtet die gemeinsame Datenbank ein (README, Schritt 2).';
  }

  const views = { overview: viewOverview, team: viewTeam, tasks: viewTasks, reqs: viewReqs, meetings: viewMeetings };
  $('#main').innerHTML = views[tab]();
}

// ------------------------------------------------------------------ Dialoge

function openDialog({ title, body, onSave, onDelete }) {
  const dlg = $('#dlg');
  $('#dlg-title').textContent = title;
  $('#dlg-body').innerHTML = body;
  $('#dlg-form').onsubmit = (e) => {
    e.preventDefault();
    if (onSave(new FormData($('#dlg-form'))) !== false) dlg.close();
  };
  const del = $('#dlg-delete');
  del.hidden = !onDelete;
  del.onclick = () => {
    if (confirm('Wirklich löschen?')) {
      onDelete();
      dlg.close();
    }
  };
  dlg.showModal();
}

const field = (label, input, hint = '') =>
  `<label class="field">${esc(label)}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}${input}</label>`;

const textInput = (name, value = '', extra = '') => `<input type="text" name="${name}" value="${esc(value)}" ${extra}>`;
const numOrNull = (v) => (v === '' || v === null ? null : Number(v));

function editProject() {
  const p = state.project;
  openDialog({
    title: 'Projekt',
    body:
      field('Titel', textInput('title', p.title, 'required')) +
      field('Thema / Fach', textInput('topic', p.topic)) +
      field('Abgabetermin', `<input type="date" name="deadline" value="${esc(p.deadline)}">`),
    onSave: (fd) =>
      change(() => {
        state.project = { title: fd.get('title').trim(), topic: fd.get('topic').trim(), deadline: fd.get('deadline') };
      }),
  });
}

function editMember(id) {
  const m = state.members.find((x) => x.id === id) || { id: null, name: '', email: '', role: '' };
  openDialog({
    title: m.id ? 'Person bearbeiten' : 'Person hinzufügen',
    body:
      field('Name', textInput('name', m.name, 'required')) +
      field('E-Mail-Adresse', `<input type="email" name="email" value="${esc(m.email)}">`, 'Für die Erinnerung einen Tag vor jedem Treffen') +
      field('Rolle (optional)', textInput('role', m.role)),
    onSave: (fd) =>
      change(() => {
        const data = { name: fd.get('name').trim(), email: fd.get('email').trim(), role: fd.get('role').trim() };
        if (m.id) Object.assign(m, data);
        else state.members.push({ id: L.newId('m'), ...data });
      }),
    onDelete: m.id ? () => change(() => L.removeMember(state, m.id)) : null,
  });
}

function editTask(id) {
  const t = state.tasks.find((x) => x.id === id) || { id: null, title: '', assigneeId: null, due: '', progress: 0, dependsOn: [], notes: '' };
  const others = state.tasks.filter((o) => o.id !== t.id);
  const deps = others.length
    ? others
        .map((o) => {
          const cycle = t.id && L.wouldCreateCycle(state.tasks, t.id, o.id) && !t.dependsOn.includes(o.id);
          return `<label class="${cycle ? 'off' : ''}"><input type="checkbox" name="dep" value="${esc(o.id)}" ${
            t.dependsOn.includes(o.id) ? 'checked' : ''
          } ${cycle ? 'disabled' : ''}> ${esc(o.title)}${cycle ? ' (würde sich im Kreis drehen)' : ''}</label>`;
        })
        .join('')
    : '<span class="muted">Noch keine anderen Aufgaben.</span>';

  openDialog({
    title: t.id ? 'Aufgabe bearbeiten' : 'Aufgabe hinzufügen',
    body:
      field('Aufgabe', textInput('title', t.title, 'required')) +
      `<div class="two">${field(
        'Verantwortlich',
        `<select name="assignee"><option value="">– niemand –</option>${state.members
          .map((m) => `<option value="${esc(m.id)}" ${m.id === t.assigneeId ? 'selected' : ''}>${esc(m.name)}</option>`)
          .join('')}</select>`
      )}${field('Fällig am', `<input type="date" name="due" value="${esc(t.due)}">`)}</div>` +
      `<label class="field">Kann erst starten, wenn fertig ist:<span class="checks">${deps}</span></label>` +
      field('Notizen', `<textarea name="notes">${esc(t.notes)}</textarea>`),
    onSave: (fd) =>
      change(() => {
        const data = {
          title: fd.get('title').trim(),
          assigneeId: fd.get('assignee') || null,
          due: fd.get('due'),
          dependsOn: fd.getAll('dep'),
          notes: fd.get('notes').trim(),
        };
        if (t.id) Object.assign(t, data);
        else state.tasks.push({ id: L.newId('t'), progress: 0, ...data });
      }),
    onDelete: t.id ? () => change(() => L.removeTask(state, t.id)) : null,
  });
}

function editReq(id) {
  const r = state.requirements.find((x) => x.id === id) || { id: null, label: '', kind: 'number', unit: '', min: null, max: null };
  openDialog({
    title: r.id ? 'Vorgabe bearbeiten' : 'Vorgabe hinzufügen',
    body:
      field('Bezeichnung', textInput('label', r.label, 'required'), 'z. B. „Seitenanzahl“ oder „Schriftart Times New Roman, 12 pt“') +
      field(
        'Art der Vorgabe',
        `<select name="kind" data-change="req-kind"><option value="number" ${r.kind === 'number' ? 'selected' : ''}>Zahl mit Grenzen (Seiten, Wörter …)</option><option value="check" ${r.kind === 'check' ? 'selected' : ''}>Ja/Nein (Formatierung …)</option></select>`
      ) +
      `<div id="num-fields" ${r.kind === 'check' ? 'hidden' : ''}>
        ${field('Einheit', textInput('unit', r.unit, 'placeholder="z. B. Seiten"'))}
        <div class="two">
          ${field('Minimum', `<input type="number" step="any" name="min" value="${r.min ?? ''}">`, 'leer = keine Untergrenze')}
          ${field('Maximum', `<input type="number" step="any" name="max" value="${r.max ?? ''}">`, 'leer = keine Obergrenze')}
        </div>
      </div>`,
    onSave: (fd) => {
      const kind = fd.get('kind');
      const min = numOrNull(fd.get('min'));
      const max = numOrNull(fd.get('max'));
      if (kind === 'number' && min !== null && max !== null && min > max) {
        toast('Das Minimum darf nicht größer als das Maximum sein.');
        return false;
      }
      change(() => {
        const data = { label: fd.get('label').trim(), kind, unit: kind === 'number' ? fd.get('unit').trim() : '', min: kind === 'number' ? min : null, max: kind === 'number' ? max : null };
        if (r.id) Object.assign(r, data);
        else state.requirements.push({ id: L.newId('r'), current: null, done: false, ...data });
      });
    },
    onDelete: r.id ? () => change(() => (state.requirements = state.requirements.filter((x) => x.id !== r.id))) : null,
  });
}

function editMeeting(id) {
  const m = state.meetings.find((x) => x.id === id) || { id: null, date: '', time: '', place: '', agenda: '', todos: [] };
  openDialog({
    title: m.id ? 'Treffen bearbeiten' : 'Treffen hinzufügen',
    body:
      `<div class="two">${field('Datum', `<input type="date" name="date" value="${esc(m.date)}" required>`)}${field(
        'Uhrzeit',
        `<input type="time" name="time" value="${esc(m.time)}">`
      )}</div>` +
      field('Ort', textInput('place', m.place)) +
      field('Thema', textInput('agenda', m.agenda)) +
      field(
        'Aufgaben bis zum Treffen (für alle)',
        `<textarea name="todos" placeholder="Mindestens 3 relevante Quellen ausfindig machen">${esc(m.todos.map((t) => t.text).join('\n'))}</textarea>`,
        'Eine Aufgabe pro Zeile'
      ),
    onSave: (fd) =>
      change(() => {
        const old = new Map(m.todos.map((t) => [t.text, t]));
        const todos = fd
          .get('todos')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((text) => old.get(text) || { id: L.newId('d'), text, doneBy: [] });
        const data = { date: fd.get('date'), time: fd.get('time'), place: fd.get('place').trim(), agenda: fd.get('agenda').trim(), todos };
        if (m.id) Object.assign(m, data);
        else state.meetings.push({ id: L.newId('x'), ...data });
      }),
    onDelete: m.id ? () => change(() => (state.meetings = state.meetings.filter((x) => x.id !== m.id))) : null,
  });
}

// ------------------------------------------------------------------ Aktionen

const actions = {
  tab: (d) => (location.hash = d.tab),
  'dlg-cancel': () => $('#dlg').close(),
  'edit-project': editProject,
  'add-member': () => editMember(null),
  'edit-member': (d) => editMember(d.id),
  'add-task': () => editTask(null),
  'edit-task': (d) => editTask(d.id),
  'add-req': () => editReq(null),
  'edit-req': (d) => editReq(d.id),
  'add-meeting': () => editMeeting(null),
  'edit-meeting': (d) => editMeeting(d.id),
  'load-demo': () => change(() => (state = L.demoState())),
  'add-presets': () => {
    const have = new Set(state.requirements.map((r) => r.label));
    const fresh = L.REQUIREMENT_PRESETS.filter((p) => !have.has(p.label));
    if (!fresh.length) return toast('Alle typischen Vorgaben sind schon vorhanden.');
    change(() => state.requirements.push(...fresh.map((p) => ({ id: L.newId('r'), current: null, done: false, unit: '', min: null, max: null, ...p }))));
    toast('Bitte die Grenzen an eure Aufgabenstellung anpassen („Bearbeiten“).', 6000);
  },
  'toggle-todo': (d) =>
    change(() => {
      const todo = state.meetings.find((m) => m.id === d.m)?.todos.find((t) => t.id === d.t);
      if (!todo) return;
      todo.doneBy = todo.doneBy.includes(d.mb) ? todo.doneBy.filter((x) => x !== d.mb) : [...todo.doneBy, d.mb];
    }),
  export: () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `teamplaner-${L.todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  import: () => $('#import-file').click(),
};

const changes = {
  'task-progress': (d, el) =>
    change(() => {
      const t = state.tasks.find((x) => x.id === d.id);
      if (t) t.progress = Number(el.value);
    }),
  'req-current': (d, el) =>
    change(() => {
      const r = state.requirements.find((x) => x.id === d.id);
      if (r) r.current = el.value === '' ? null : Number(el.value);
    }),
  'req-done': (d, el) =>
    change(() => {
      const r = state.requirements.find((x) => x.id === d.id);
      if (r) r.done = el.checked;
    }),
  'req-kind': (d, el) => {
    $('#num-fields').hidden = el.value === 'check';
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action](el.dataset, el);
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && changes[el.dataset.change]) changes[el.dataset.change](el.dataset, el);
});

$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const imported = L.normalizeState(JSON.parse(await file.text()));
    if (!confirm('Die aktuellen Daten werden durch die importierte Datei ersetzt. Fortfahren?')) return;
    change(() => (state = imported));
  } catch {
    toast('Die Datei konnte nicht gelesen werden.');
  }
});

window.addEventListener('hashchange', () => {
  tab = tabFromHash();
  render();
  window.scrollTo(0, 0);
});

boot();
