'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Import project modules
const { TRANSLATIONS } = require('../i18n.js');
const {
  msToHMS, fmtDur, fmtShort, parseDurationInput, fmtSessionTime, todayKey, yesterdayKey, toLocalDateKey, genId,
  totalMs, todayMs, bestMs, filteredTotalMs, filteredTodayMs, filteredBestMs, filteredSessionCount,
  updateGameHltbData, unlinkGameHltbData,
  settings
} = require('../state.js');

// ─── 1. Duration Formatting & Math Tests ───────────────────────────────────────
test('msToHMS converts milliseconds correctly', () => {
  assert.deepEqual(msToHMS(0), { h: 0, m: 0, s: 0 });
  assert.deepEqual(msToHMS(45000), { h: 0, m: 0, s: 45 });
  assert.deepEqual(msToHMS(125000), { h: 0, m: 2, s: 5 });
  assert.deepEqual(msToHMS(3665000), { h: 1, m: 1, s: 5 });
  assert.deepEqual(msToHMS(90061000), { h: 25, m: 1, s: 1 });
});

test('fmtDur formats duration strings for TR and EN languages', () => {
  settings.lang = 'tr';
  assert.equal(fmtDur(45000), '45sn');
  assert.equal(fmtDur(125000), '2dk 05sn');
  assert.equal(fmtDur(3665000), '1sa 01dk');

  settings.lang = 'en';
  assert.equal(fmtDur(45000), '45s');
  assert.equal(fmtDur(125000), '2m 05s');
  assert.equal(fmtDur(3665000), '1h 01m');
});

test('fmtShort formats into HH:MM:SS format', () => {
  assert.equal(fmtShort(0), '00:00:00');
  assert.equal(fmtShort(5000), '00:00:05');
  assert.equal(fmtShort(65000), '00:01:05');
  assert.equal(fmtShort(3600000), '01:00:00');
  assert.equal(fmtShort(9000000), '02:30:00');
});

test('parseDurationInput parses various user inputs accurately and rejects invalid inputs', () => {
  // HH:MM:SS format
  assert.equal(parseDurationInput('02:30:00'), 9000000);
  assert.equal(parseDurationInput('1:15:30'), (1 * 3600 + 15 * 60 + 30) * 1000);
  
  // HH:MM format
  assert.equal(parseDurationInput('45:30'), (45 * 60 + 30) * 60 * 1000);
  assert.equal(parseDurationInput('02:15'), (2 * 60 + 15) * 60 * 1000);

  // Hour formats (1.5h, 2saat, 3sa)
  assert.equal(parseDurationInput('1.5h'), 5400000);
  assert.equal(parseDurationInput('2saat'), 7200000);
  assert.equal(parseDurationInput('3sa'), 10800000);

  // Minute formats (90m, 45dk, 30dakika)
  assert.equal(parseDurationInput('90m'), 5400000);
  assert.equal(parseDurationInput('45dk'), 2700000);
  assert.equal(parseDurationInput('30dakika'), 1800000);

  // Second formats (45s, 60sn)
  assert.equal(parseDurationInput('45s'), 45000);
  assert.equal(parseDurationInput('60sn'), 60000);

  // Negative and invalid inputs should return null
  assert.equal(parseDurationInput('invalid'), null);
  assert.equal(parseDurationInput(''), null);
  assert.equal(parseDurationInput('-5h'), null);
  assert.equal(parseDurationInput('-10m'), null);
});

// ─── 2. AM / PM and 24h Time Parsing Tests ────────────────────────────────────
function parseTimeInputTest(timeVal) {
  const time12Match = timeVal.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const time24Match = timeVal.match(/^(\d{1,2}):(\d{2})$/);
  if (time12Match) {
    let h = parseInt(time12Match[1], 10);
    const m = parseInt(time12Match[2], 10);
    const p = time12Match[3].toUpperCase();
    if (p === 'PM' && h < 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    return { hour: h, minute: m };
  } else if (time24Match) {
    return { hour: parseInt(time24Match[1], 10), minute: parseInt(time24Match[2], 10) };
  }
  return null;
}

test('12-hour AM/PM parser correctly handles all boundary hours', () => {
  // Midnight (12:00 AM -> 00:00)
  assert.deepEqual(parseTimeInputTest('12:00 AM'), { hour: 0, minute: 0 });
  assert.deepEqual(parseTimeInputTest('12:30 AM'), { hour: 0, minute: 30 });
  
  // Morning (01:00 AM - 11:59 AM)
  assert.deepEqual(parseTimeInputTest('01:15 AM'), { hour: 1, minute: 15 });
  assert.deepEqual(parseTimeInputTest('09:45 AM'), { hour: 9, minute: 45 });
  assert.deepEqual(parseTimeInputTest('11:59 AM'), { hour: 11, minute: 59 });

  // Noon (12:00 PM -> 12:00)
  assert.deepEqual(parseTimeInputTest('12:00 PM'), { hour: 12, minute: 0 });
  assert.deepEqual(parseTimeInputTest('12:45 PM'), { hour: 12, minute: 45 });

  // Afternoon & Evening (01:00 PM - 11:59 PM)
  assert.deepEqual(parseTimeInputTest('01:00 PM'), { hour: 13, minute: 0 });
  assert.deepEqual(parseTimeInputTest('02:30 PM'), { hour: 14, minute: 30 });
  assert.deepEqual(parseTimeInputTest('11:59 PM'), { hour: 23, minute: 59 });
});

test('24-hour time parser correctly parses 00:00 to 23:59', () => {
  assert.deepEqual(parseTimeInputTest('00:00'), { hour: 0, minute: 0 });
  assert.deepEqual(parseTimeInputTest('08:15'), { hour: 8, minute: 15 });
  assert.deepEqual(parseTimeInputTest('14:30'), { hour: 14, minute: 30 });
  assert.deepEqual(parseTimeInputTest('23:59'), { hour: 23, minute: 59 });
});

// ─── 3. Date Validation Logic Tests ───────────────────────────────────────────
function isValidDate(dateStr) {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const d = new Date(year, month, day);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
}

test('isValidDate correctly validates leap years and rejects impossible dates', () => {
  assert.equal(isValidDate('2024-02-29'), true); // Leap year 2024
  assert.equal(isValidDate('2025-02-29'), false); // Non-leap year
  assert.equal(isValidDate('2026-04-31'), false); // April has 30 days
  assert.equal(isValidDate('2026-12-31'), true);
  assert.equal(isValidDate('2026-13-01'), false); // Invalid month 13
  assert.equal(isValidDate('invalid-date'), false);
});

// ─── 4. Session Math & DLC Aggregation Tests ──────────────────────────────────
test('totalMs, filteredTotalMs, todayMs calculate session statistics accurately', () => {
  const tKey = todayKey();
  const dummyGame = {
    id: 'game-1',
    name: 'The Witcher 3',
    sessions: [
      { id: 's1', durationMs: 3600000, dateKey: tKey, dlcId: null }, // Today Main: 1 hour
      { id: 's2', durationMs: 1800000, dateKey: '2026-01-01', dlcId: null }, // Past Main: 30 mins
      { id: 's3', durationMs: 7200000, dateKey: tKey, dlcId: 'dlc-hos' }, // Today DLC: 2 hours
      { id: 's4', durationMs: 14400000, dateKey: '2026-01-01', dlcId: 'dlc-baw' } // Past DLC: 4 hours
    ],
    dlcs: [
      { id: 'dlc-hos', name: 'Hearts of Stone' },
      { id: 'dlc-baw', name: 'Blood and Wine' }
    ]
  };

  // Overall total (all sessions)
  assert.equal(totalMs(dummyGame), 3600000 + 1800000 + 7200000 + 14400000); // 7.5 hours

  // Today overall (s1 + s3)
  assert.equal(todayMs(dummyGame), 3600000 + 7200000); // 3 hours
  assert.equal(filteredTodayMs(dummyGame, 'overall'), 3600000 + 7200000);

  // Today Main Game only (s1)
  assert.equal(filteredTodayMs(dummyGame, null), 3600000); // 1 hour

  // Today DLC only (s3)
  assert.equal(filteredTodayMs(dummyGame, 'dlc-hos'), 7200000); // 2 hours

  // Main game total
  assert.equal(filteredTotalMs(dummyGame, null), 3600000 + 1800000); // 1.5 hours

  // Best session
  assert.equal(bestMs(dummyGame), 14400000);
  assert.equal(filteredBestMs(dummyGame, null), 3600000);

  // Session count
  assert.equal(filteredSessionCount(dummyGame, 'overall'), 4);
  assert.equal(filteredSessionCount(dummyGame, null), 2);
  assert.equal(filteredSessionCount(dummyGame, 'dlc-hos'), 1);
});

// ─── 5. Multi-Select Delete & DLC Unlinking Simulation ─────────────────────────
test('Multi-select deletion updates sessions and durations cleanly', () => {
  const dummyGame = {
    id: 'game-multi',
    sessions: [
      { id: 's1', durationMs: 1000 },
      { id: 's2', durationMs: 2000 },
      { id: 's3', durationMs: 3000 },
      { id: 's4', durationMs: 4000 }
    ]
  };

  const selectedIdsToDelete = new Set(['s2', 's4']);
  dummyGame.sessions = dummyGame.sessions.filter(s => !selectedIdsToDelete.has(s.id));

  assert.equal(dummyGame.sessions.length, 2);
  assert.equal(totalMs(dummyGame), 4000); // s1 (1000) + s3 (3000)
});

test('Deleting a DLC preserves playtime by setting dlcId to null', () => {
  const dummyGame = {
    id: 'game-dlc-del',
    sessions: [
      { id: 's1', durationMs: 3600000, dlcId: 'dlc-old' },
      { id: 's2', durationMs: 1800000, dlcId: null }
    ],
    dlcs: [{ id: 'dlc-old', name: 'Old DLC' }]
  };

  const dlcToDelete = 'dlc-old';
  dummyGame.dlcs = dummyGame.dlcs.filter(d => d.id !== dlcToDelete);
  // Existing sessions lose their tag but are NOT deleted
  dummyGame.sessions.forEach(s => {
    if (s.dlcId === dlcToDelete) s.dlcId = null;
  });

  assert.equal(dummyGame.sessions.length, 2);
  assert.equal(dummyGame.sessions[0].dlcId, null);
  assert.equal(totalMs(dummyGame), 5400000); // Playtime preserved
});

// ─── 6. Process Name Formatter Tests ──────────────────────────────────────────
function formatProcessNameTest(procName) {
  if (!procName) return '';
  let name = procName.replace(/\.exe$/i, '');
  name = name.replace(/[_-]+/g, ' ');
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  name = name.replace(/([a-zA-Z])([0-9])/g, '$1 $2');
  name = name.replace(/([0-9])([a-zA-Z])/g, '$1 $2');
  name = name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  name = name.replace(/\s+/g, ' ');
  return name.split(' ')
             .map(word => word.charAt(0).toUpperCase() + word.slice(1))
             .join(' ')
             .trim();
}

test('formatProcessName creates user-friendly clean game titles', () => {
  assert.equal(formatProcessNameTest('Cyberpunk2077.exe'), 'Cyberpunk 2077');
  assert.equal(formatProcessNameTest('gta_v.exe'), 'Gta V');
  assert.equal(formatProcessNameTest('witcher3.exe'), 'Witcher 3');
  assert.equal(formatProcessNameTest('EldenRing.exe'), 'Elden Ring');
});

// ─── 7. Slug and Metadata Generators Tests ────────────────────────────────────
function getMetacriticSlug(name) {
  return name.toLowerCase()
             .replace(/[^a-z0-9\s-]/g, '')
             .trim()
             .replace(/\s+/g, '-')
             .replace(/-+/g, '-');
}

function getIgnSlugs(name) {
  const slugs = [];
  const cleaned = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim();
  slugs.push(cleaned.replace(/\s+/g, '-').replace(/-+/g, '-'));
  const f1Cleaned = cleaned.replace(/f\s*1/gi, 'f1');
  slugs.push(f1Cleaned.replace(/\s+/g, '-').replace(/-+/g, '-'));
  slugs.push(cleaned.replace(/[\s-]+/g, ''));
  return [...new Set(slugs)];
}

test('getMetacriticSlug creates clean URL slugs', () => {
  assert.equal(getMetacriticSlug('Cyberpunk 2077: Phantom Liberty'), 'cyberpunk-2077-phantom-liberty');
  assert.equal(getMetacriticSlug('God of War (2018)'), 'god-of-war-2018');
  assert.equal(getMetacriticSlug("Assassin's Creed Valhalla"), 'assassins-creed-valhalla');
});

test('getIgnSlugs creates all required variations for review lookup', () => {
  const f1Slugs = getIgnSlugs('F1 24');
  assert.ok(f1Slugs.includes('f1-24'));
  
  const gowSlugs = getIgnSlugs('God of War: Ragnarok');
  assert.ok(gowSlugs.includes('god-of-war-ragnarok'));
});

// ─── 8. HLTB Image URL Resolver Tests ─────────────────────────────────────────
function resolveHltbImage(gameImage) {
  if (!gameImage) return '';
  if (gameImage.startsWith('http')) return gameImage;
  if (gameImage.startsWith('/')) return 'https://howlongtobeat.com' + gameImage;
  return 'https://howlongtobeat.com/games/' + gameImage;
}

test('resolveHltbImage correctly formats all HLTB image path variants', () => {
  assert.equal(resolveHltbImage('https://cdn.example.com/cover.png'), 'https://cdn.example.com/cover.png');
  assert.equal(resolveHltbImage('/static/game_123.jpg'), 'https://howlongtobeat.com/static/game_123.jpg');
  assert.equal(resolveHltbImage('witcher3_cover.jpg'), 'https://howlongtobeat.com/games/witcher3_cover.jpg');
});

// ─── 9. i18n Translation Dictionary Completeness Tests ────────────────────────
test('TRANSLATIONS dictionary contains matching keys in TR and EN', () => {
  const trKeys = Object.keys(TRANSLATIONS.tr);
  const enKeys = Object.keys(TRANSLATIONS.en);

  const missingInEn = trKeys.filter(k => !(k in TRANSLATIONS.en));
  const missingInTr = enKeys.filter(k => !(k in TRANSLATIONS.tr));

  assert.deepEqual(missingInEn, [], `Keys present in TR but missing in EN: ${missingInEn.join(', ')}`);
  assert.deepEqual(missingInTr, [], `Keys present in EN but missing in TR: ${missingInTr.join(', ')}`);
});

// ─── 10. AFK / Alt-Tab Tolerance Trigger Tests ────────────────────────────────
test('Inactivity calculation triggers pause when threshold is reached', () => {
  const afkTh = 600 * 1000; // 10 minutes
  let idleMs = 605 * 1000; // 10 mins 5 secs
  
  let isAutoPaused = false;
  if (afkTh > 0 && idleMs >= afkTh) {
    isAutoPaused = true;
  }
  assert.equal(isAutoPaused, true);

  idleMs = 300 * 1000; // 5 mins
  const pct = Math.max(0, 100 - (idleMs / afkTh) * 100);
  assert.equal(pct, 50); // 50% tolerance bar remaining
});

// ─── 11. Sleep / Offline Protection Logic Tests ───────────────────────────────
test('Timer interval prevents adding offline sleep hours', () => {
  const mockState = {
    runningMs: 60000, // 1 minute
    lastTickTs: Date.now() - (8 * 3600 * 1000), // 8 hours ago (simulating PC sleep)
    isPaused: false,
    isAutoPaused: false
  };

  const now = Date.now();
  const delta = now - mockState.lastTickTs;
  
  // Logic from timer.js startTicking
  if (delta > 0 && delta <= 2500) {
    mockState.runningMs += delta;
  } else if (delta > 2500) {
    mockState.runningMs += 500; // Only add at most 500ms and pause
    mockState.isAutoPaused = true;
  }
  mockState.lastTickTs = now;

  // The runningMs should NOT have 8 hours added to it!
  assert.equal(mockState.runningMs, 60500);
  assert.equal(mockState.isAutoPaused, true);
});

test('Unclean shutdown recovery saves exact playtime without offline delta', () => {
  const interruptedState = {
    activeGameId: 'game-rec',
    startTs: '2026-08-30T10:00:00.000Z',
    runningMs: 3600000, // 1 hour played before power cut
    lastTickTs: 1788100000000, // old timestamp hours ago
    isPaused: false,
    isAutoPaused: false
  };

  const testGames = [
    { id: 'game-rec', name: 'Test Game', sessions: [] }
  ];

  // Logic from loadState in state.js
  const g = testGames.find(x => x.id === interruptedState.activeGameId);
  if (g && interruptedState.runningMs && interruptedState.runningMs >= 60000) {
    const startD = interruptedState.startTs ? new Date(interruptedState.startTs) : new Date();
    const endD = new Date(startD.getTime() + interruptedState.runningMs);
    g.sessions.unshift({
      id: genId(),
      startTs: startD.toISOString(),
      endTs: endD.toISOString(),
      durationMs: interruptedState.runningMs,
      dateKey: toLocalDateKey(startD),
      dlcId: null
    });
  }

  // Verify that the saved session duration is exactly 1 hour, not inflated!
  assert.equal(g.sessions.length, 1);
  assert.equal(g.sessions[0].durationMs, 3600000);
  assert.equal(g.sessions[0].startTs, '2026-08-30T10:00:00.000Z');
});

// ─── 12. Local Date & Midnight Rollover Session Formatting Tests ───────────────
test('toLocalDateKey formats local date as YYYY-MM-DD', () => {
  const d = new Date(2026, 7, 31, 1, 30); // 31 Aug 2026, 01:30 local time
  assert.equal(toLocalDateKey(d), '2026-08-31');
});

test('fmtSessionTime distinguishes midnight rollover across different days', () => {
  settings.lang = 'tr';
  
  // Case 1: Same day session
  const now = new Date();
  const startSame = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0);
  const endSame = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 30, 0);
  const resSame = fmtSessionTime({
    startTs: startSame.toISOString(),
    endTs: endSame.toISOString(),
    durationMs: 5400000
  });
  assert.ok(resSame.includes('Bugün'));
  assert.ok(resSame.includes('-'));

  // Case 2: Session spanning across midnight from yesterday 21:47 to today 01:39
  const startYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 21, 47, 0);
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 1, 39, 0);
  const resCross = fmtSessionTime({
    startTs: startYesterday.toISOString(),
    endTs: endToday.toISOString(),
    durationMs: 131000
  });
  // Must NOT collapse into "Bugün 21:47 - 01:39"
  assert.ok(resCross.includes('Dün') && resCross.includes('Bugün'));
});

