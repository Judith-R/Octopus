import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/logic.js';

const T = (id, progress, dependsOn = [], assigneeId = 'm1') => ({ id, title: 'Aufgabe ' + id, progress, dependsOn, assigneeId });

test('Fortschritt: Person und Gesamtprojekt', () => {
  const tasks = [T('a', 100), T('b', 50), T('c', 0, [], 'm2')];
  assert.equal(L.memberProgress('m1', tasks), 75);
  assert.equal(L.memberProgress('m2', tasks), 0);
  assert.equal(L.memberProgress('m9', tasks), null);
  assert.equal(L.overallProgress(tasks), 50);
  assert.equal(L.overallProgress([]), null);
});

test('Abhängigkeiten: blockierende Aufgaben', () => {
  const tasks = [T('a', 100), T('b', 40), T('c', 0, ['a', 'b'])];
  assert.deepEqual(L.blockers(tasks[2], tasks).map((t) => t.id), ['b']);
  tasks[1].progress = 100;
  assert.equal(L.blockers(tasks[2], tasks).length, 0);
});

test('Abhängigkeiten: Kreise werden erkannt', () => {
  const tasks = [T('a', 0), T('b', 0, ['a']), T('c', 0, ['b'])];
  assert.equal(L.hasCycle(tasks), false);
  assert.equal(L.wouldCreateCycle(tasks, 'a', 'c'), true); // a -> c -> b -> a
  assert.equal(L.wouldCreateCycle(tasks, 'a', 'a'), true);
  assert.equal(L.wouldCreateCycle(tasks, 'c', 'a'), false);
  tasks[0].dependsOn = ['c'];
  assert.equal(L.hasCycle(tasks), true);
});

test('Stufen der Aufgaben', () => {
  const tasks = [T('a', 0), T('b', 0, ['a']), T('c', 0, ['a']), T('d', 0, ['b', 'c'])];
  assert.deepEqual(L.taskLevels(tasks), { a: 1, b: 2, c: 2, d: 3 });
});

test('Aufgabe/Person löschen räumt Verweise auf', () => {
  const s = L.normalizeState({
    members: [{ id: 'm1', name: 'A' }],
    tasks: [T('a', 0), T('b', 0, ['a'])],
    meetings: [{ id: 'x', date: '2026-11-12', todos: [{ id: 'd', text: 't', doneBy: ['m1'] }] }],
  });
  L.removeTask(s, 'a');
  assert.deepEqual(s.tasks[0].dependsOn, []);
  L.removeMember(s, 'm1');
  assert.equal(s.tasks[0].assigneeId, null);
  assert.deepEqual(s.meetings[0].todos[0].doneBy, []);
});

test('Formale Vorgaben', () => {
  const r = { kind: 'number', unit: 'Seiten', min: 15, max: 20 };
  assert.equal(L.requirementState({ ...r, current: null }).state, 'open');
  assert.equal(L.requirementState({ ...r, current: 9 }).state, 'low');
  assert.equal(L.requirementState({ ...r, current: 9 }).text, 'noch 6 Seiten bis zum Minimum');
  assert.equal(L.requirementState({ ...r, current: 22 }).state, 'high');
  assert.equal(L.requirementState({ ...r, current: 17 }).state, 'ok');
  assert.equal(L.requirementState({ kind: 'check', done: true }).state, 'ok');
  assert.deepEqual(L.requirementsSummary([{ kind: 'check', done: true }, { kind: 'check', done: false }]), { ok: 1, total: 2 });
  assert.equal(L.describeRange(r), '15–20 Seiten');
  assert.equal(L.describeRange({ kind: 'number', unit: 'Quellen', min: 10, max: null }), 'mindestens 10 Quellen');
});

test('Datum', () => {
  assert.equal(L.addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(L.daysBetween('2026-11-07', '2027-01-15'), 69);
  assert.equal(L.formatDate('2026-11-12'), '12.11.2026');
  assert.equal(L.weekday('2026-11-12'), 'Donnerstag');
  // 23:30 UTC am 11.11. ist in Wien schon der 12.11.
  assert.equal(L.todayISO(new Date('2026-11-11T23:30:00Z')), '2026-11-12');
  assert.equal(L.todayISO(new Date('2026-11-11T12:00:00Z')), '2026-11-11');
});

test('Nächstes Treffen', () => {
  const ms = [
    { id: 1, date: '2026-12-01', time: '10:00' },
    { id: 2, date: '2026-11-12', time: '18:00' },
    { id: 3, date: '2026-11-01', time: '09:00' },
  ];
  assert.equal(L.nextMeeting(ms, '2026-11-07').id, 2);
  assert.equal(L.nextMeeting(ms, '2026-12-02'), null);
});

test('Erinnerungen: nur am Vortag, nur mit gültiger E-Mail', () => {
  const s = L.demoState();
  s.members[0].email = 'anna@example.org';
  s.members[1].email = 'kaputt';
  s.members[2].email = 'clara@example.org';

  assert.equal(L.remindersFor(s, '2026-11-10').length, 0); // 2 Tage vorher
  assert.equal(L.remindersFor(s, '2026-11-12').length, 0); // am Tag selbst

  const mails = L.remindersFor(s, '2026-11-11');
  assert.deepEqual(mails.map((m) => m.to), ['anna@example.org', 'clara@example.org']);
  assert.equal(mails[0].subject, 'Erinnerung: Gruppentreffen morgen, 12.11.2026 um 18:00 Uhr');

  // Anna hat ihre To-do schon erledigt, Clara noch nicht
  assert.ok(!mails[0].text.includes('3 relevante Quellen'));
  assert.ok(mails[1].text.includes('3 relevante Quellen'));
  assert.ok(mails[1].text.includes('Kapitel 1 schreiben'));
  assert.ok(mails[1].text.includes('wartet auf: Gliederung erstellen'));
  assert.ok(mails[1].text.includes('Donnerstag, 12.11.2026 um 18:00 Uhr'));
  assert.ok(mails[1].text.includes('15.01.2027'));
});

test('normalizeState füllt fehlende Felder', () => {
  const s = L.normalizeState({});
  assert.deepEqual(s.members, []);
  assert.equal(s.project.title, 'Mein Gruppenprojekt');
  assert.equal(L.normalizeState(null).tasks.length, 0);
});
