// Verschickt die Erinnerungs-E-Mails: Wer morgen ein Gruppentreffen hat, bekommt heute eine Mail.
// Läuft täglich automatisch über GitHub Actions (.github/workflows/erinnerungen.yml).
//
// Zum Ausprobieren auf dem eigenen Rechner (verschickt nichts):
//   DRY_RUN=1 STATE_FILE=meine-daten.json TODAY=2026-11-11 node scripts/send-reminders.js

import { readFile } from 'node:fs/promises';
import { normalizeState, remindersFor, todayISO } from '../src/logic.js';

const env = process.env;

async function loadState() {
  if (env.STATE_FILE) return JSON.parse(await readFile(env.STATE_FILE, 'utf8'));

  for (const name of ['SUPABASE_URL', 'SUPABASE_KEY', 'TEAM_CODE']) {
    if (!env[name]) throw new Error(`Das Secret ${name} fehlt (GitHub: Settings → Secrets and variables → Actions).`);
  }
  const headers = { apikey: env.SUPABASE_KEY, 'x-team-code': env.TEAM_CODE };
  if (env.SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${env.SUPABASE_KEY}`;

  const base = env.SUPABASE_URL.replace(/\/+$/, '');
  const res = await fetch(`${base}/rest/v1/project_state?id=eq.1&select=data`, { headers });
  if (!res.ok) throw new Error(`Daten konnten nicht geladen werden (HTTP ${res.status}).`);
  const rows = await res.json();
  if (!rows.length) throw new Error('Keine Daten erhalten: Team-Code falsch oder schema.sql nicht ausgeführt.');
  return rows[0].data;
}

async function main() {
  const today = env.TODAY || todayISO();
  const state = normalizeState(await loadState());
  const mails = remindersFor(state, today);

  if (!mails.length) {
    console.log(`Heute (${today}) ist keine Erinnerung nötig: morgen ist kein Treffen oder niemand hat eine E-Mail-Adresse.`);
    return;
  }

  const dry = env.DRY_RUN === '1';
  let transport = null;
  if (!dry) {
    for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) {
      if (!env[name]) throw new Error(`Das Secret ${name} fehlt.`);
    }
    const { default: nodemailer } = await import('nodemailer');
    const port = Number(env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }

  let failed = 0;
  for (const mail of mails) {
    if (dry) {
      console.log(`--- (Testlauf) an ${mail.name} <${mail.to}>\nBetreff: ${mail.subject}\n\n${mail.text}\n`);
      continue;
    }
    try {
      await transport.sendMail({
        from: env.MAIL_FROM || env.SMTP_USER,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      });
      // Im Log stehen nur Vornamen, keine E-Mail-Adressen (das Log kann öffentlich sein).
      console.log(`Erinnerung an ${mail.name} gesendet.`);
    } catch (err) {
      failed++;
      console.error(`Erinnerung an ${mail.name} fehlgeschlagen: ${err.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Fehler:', err.message);
  process.exitCode = 1;
});
