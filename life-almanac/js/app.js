import { t } from './i18n.js';
import {
  loadSettings, saveSettings, loadHabits, saveHabits,
  loadDay, saveDay, fetchDayCached, computeStreak
} from './store.js';

const weatherKeys = ['radiant','sun','cloud','rain','storm'];
const weatherColors = {storm:'#3F5A73', rain:'#6B8CA6', cloud:'#8C8A7D', sun:'#C79A3E', radiant:'#B8863C'};
const weatherIcons = {
  storm: '<path d="M13 2 4 14h6l-2 8 9-12h-6z" fill="currentColor"/>',
  rain: '<path d="M7 16a5 5 0 0 1 .5-9.9A6 6 0 0 1 19 8a4 4 0 0 1-1 7.9" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="18" x2="8" y2="21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="18" x2="12" y2="21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="16" y1="18" x2="16" y2="21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  cloud: '<path d="M7 16a5 5 0 0 1 .5-9.9A6 6 0 0 1 19 8a4 4 0 0 1-1 8H7z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  sun: '<circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/></g>',
  radiant: '<circle cx="12" cy="12" r="4" fill="currentColor"/><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="12" y1="0" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="24"/><line x1="0" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="24" y2="12"/><line x1="3.5" y1="3.5" x2="5.5" y2="5.5"/><line x1="18.5" y1="18.5" x2="20.5" y2="20.5"/><line x1="3.5" y1="20.5" x2="5.5" y2="18.5"/><line x1="18.5" y1="5.5" x2="20.5" y2="3.5"/></g>'
};
const moonIcon = '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" fill="currentColor"/>';
const sunIcon = '<circle cx="12" cy="12" r="5"/>';

let currentDate = new Date();
let overviewMonth = new Date();
let habits = [];
let dayData = {};
let settings = { theme: 'light' };

// Helper Functions
function todayStart() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function isFutureDate(d) { const a = new Date(d); a.setHours(0,0,0,0); return a.getTime() > todayStart().getTime(); }
function fmtDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function displayDate(d) { return d.toLocaleDateString(t('locale'), { month: 'short', day: 'numeric', year: 'numeric' }); }
function weekday(d) { return d.toLocaleDateString(t('locale'), { weekday: 'long' }); }
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function cssSafe(s) { return s.replace(/[^a-zA-Z0-9]/g, '_'); }
function hexToAlpha(hex, alpha) {
    if(!hex) return 'rgba(95,122,92,'+alpha+')';
    const c = hex.replace('#','');
    const r = parseInt(c.substring(0,2),16);
    const g = parseInt(c.substring(2,4),16);
    const b = parseInt(c.substring(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function applyTheme() {
    document.body.classList.toggle('dark', settings.theme === 'dark');
    document.getElementById('themeIcon').innerHTML = settings.theme === 'dark' ? moonIcon : sunIcon;
}

let saveTimer;
function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveDay(fmtDate(currentDate), dayData); flashSaved(); }, 400);
}

function flashSaved() {
    const el = document.getElementById('savedTag');
    if (!el) return;
    el.textContent = t('savedTag');
    el.classList.remove('show');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); el.textContent = ''; }, 1500);
}

// UI Rendering Functions
function renderHeader() {
    document.getElementById('dateLabel').textContent = displayDate(currentDate);
    document.getElementById('weekdayLabel').textContent = weekday(currentDate);
    document.getElementById('nextBtn').disabled = isFutureDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1));
    const isFuture = isFutureDate(currentDate);
    document.getElementById('lockBanner').classList.toggle('show', isFuture);
    document.getElementById('lockBanner').textContent = t('lockMsg');
    return isFuture;
}

function renderSky(locked) {
    const row = document.getElementById('skyRow');
    row.className = 'sky' + (locked ? ' locked' : '');
    row.innerHTML = '';
    weatherKeys.forEach(k => {
        const div = document.createElement('div');
        div.className = 'opt' + (dayData.weather === k ? ' active' : '');
        div.style.color = weatherColors[k];
        div.innerHTML = `<svg viewBox="0 0 24 24">${weatherIcons[k]}</svg><span>${t('weather')[k]}</span>`;
        if (!locked) {
            div.onclick = () => { dayData.weather = k; renderSky(locked); scheduleSave(); renderTrail(); };
        }
        row.appendChild(div);
    });
}

function renderSchedule(locked) {
    const list = document.getElementById('schedList');
    list.innerHTML = '';
    const sorted = [...dayData.schedule].sort((a, b) => a.time.localeCompare(b.time));

    if (sorted.length === 0) {
        list.innerHTML = `<div class="empty">${t('emptySchedule')}</div>`;
    } else {
        sorted.forEach(item => {
            const div = document.createElement('div');
            div.className = 'schedItem';
            div.innerHTML = `<div class="time">${item.time}</div><div class="task"><span>${escapeHtml(item.task)}</span>${locked ? '' : `<span class="del">${t('removeLabel')}</span>`}</div>`;
            if (!locked) {
                div.querySelector('.del').onclick = () => {
                    div.classList.add('removing');
                    setTimeout(() => {
                        dayData.schedule = dayData.schedule.filter(s => s.id !== item.id);
                        renderSchedule(locked); scheduleSave();
                    }, 250);
                };
            }
            list.appendChild(div);
        });
    }

    document.getElementById('timeInput').disabled = locked;
    document.getElementById('taskInput').disabled = locked;
    document.getElementById('addSched').disabled = locked;
}

function renderHabits(locked) {
    const list = document.getElementById('habitList');
    list.innerHTML = '';
    for (const h of habits) {
        const done = !!dayData.habitsDone[h];
        const row = document.createElement('div');
        row.className = 'habitRow';
        row.innerHTML = `<div class="check ${done ? 'done' : ''}${locked ? ' disabled' : ''}"></div><div class="name">${escapeHtml(h)}</div><div class="trail" id="trail-${cssSafe(h)}"></div>${locked ? '' : `<div class="rm">${t('removeLabel')}</div>`}`;
        if (!locked) {
            row.querySelector('.check').onclick = () => {
                dayData.habitsDone[h] = !dayData.habitsDone[h];
                renderHabits(locked); scheduleSave(); renderTrail();
            };
            row.querySelector('.rm').onclick = () => {
                habits = habits.filter(x => x !== h);
                saveHabits(habits);
                renderHabits(locked);
            };
        }
        list.appendChild(row);
    }

    document.getElementById('habitInput').disabled = locked;
    document.getElementById('addHabit').disabled = locked;
    renderHabitTrails();
}

function renderHabitTrails() {
    const days = Array.from({length: 7}, (_, i) => {
        const d = new Date(currentDate); d.setDate(d.getDate() - (6 - i)); return fmtDate(d);
    });
    const data = days.map(k => fetchDayCached(k));
    habits.forEach(h => {
        const el = document.getElementById('trail-' + cssSafe(h));
        if (!el) return;
        el.innerHTML = '';
        data.forEach(d => {
            const dot = document.createElement('div');
            dot.className = 'dot' + (d && d.habitsDone && d.habitsDone[h] ? ' on' : '');
            el.appendChild(dot);
        });
    });
}

function weatherScore(w) {
    const idx = weatherKeys.indexOf(w);
    return idx < 0 ? null : (weatherKeys.length - idx) / weatherKeys.length;
}

function renderTrail() {
    saveDay(fmtDate(currentDate), dayData);
    const keys = Array.from({length: 7}, (_, i) => {
        const d = new Date(currentDate); d.setDate(d.getDate() - (6 - i)); return fmtDate(d);
    });

    const bars = document.getElementById('trailBars');
    const labels = document.getElementById('trailLabels');
    bars.innerHTML = ''; labels.innerHTML = '';

    for (const k of keys) {
        const d = fetchDayCached(k);
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = '40px';
        let score = 0;
        if (d) {
            const habitVals = habits.length ? habits.filter(h => d.habitsDone && d.habitsDone[h]).length / habits.length : 0;
            const moodVal = weatherScore(d.weather);
            score = moodVal !== null ? (habitVals * 0.6 + moodVal * 0.4) : habitVals;
        }
        const fill = document.createElement('div');
        fill.className = 'fill';
        fill.style.height = Math.round(score * 100) + '%';
        fill.style.background = d && d.weather ? weatherColors[d.weather] : 'var(--sage)';
        bar.appendChild(fill);
        bars.appendChild(bar);
        const lbl = document.createElement('span');
        lbl.textContent = k.slice(5).replace('-', '/');
        labels.appendChild(lbl);
    }
}

function renderDiary(locked) {
    const area = document.getElementById('notesArea');
    area.value = dayData.diary || '';
    autoResize(area);
    area.disabled = locked || dayData.nothingToday;
    const btn = document.getElementById('nothingBtn');
    btn.disabled = locked;
    btn.classList.toggle('active', !!dayData.nothingToday);
    btn.textContent = dayData.nothingToday ? t('nothingBtnActive') : t('nothingBtn');
    document.getElementById('saveJournalBtn').disabled = locked || dayData.nothingToday;
}

function renderAll() {
    const locked = renderHeader();
    renderSky(locked);
    renderSchedule(locked);
    renderHabits(locked);
    renderDiary(locked);
    renderTrail();
}

// Event Listeners
document.getElementById('prevBtn').onclick = () => {
    currentDate.setDate(currentDate.getDate() - 1);
    dayData = loadDay(fmtDate(currentDate));
    renderAll();
};

document.getElementById('nextBtn').onclick = () => {
    const candidate = new Date(currentDate);
    candidate.setDate(candidate.getDate() + 1);
    if (isFutureDate(candidate)) return;
    currentDate = candidate;
    dayData = loadDay(fmtDate(currentDate));
    renderAll();
};

document.getElementById('addSched').onclick = () => {
    if (isFutureDate(currentDate)) return;
    const timeVal = document.getElementById('timeInput').value;
    const task = document.getElementById('taskInput').value.trim();
    if (!timeVal || !task) return;
    dayData.schedule.push({ id: crypto.randomUUID(), time: timeVal, task: task });
    document.getElementById('taskInput').value = '';
    renderSchedule(false); scheduleSave();
};

document.getElementById('taskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addSched').click();
});

document.getElementById('addHabit').onclick = () => {
    const inp = document.getElementById('habitInput');
    const name = inp.value.trim();
    if (!name || habits.includes(name)) return;
    habits.push(name);
    saveHabits(habits);
    inp.value = '';
    renderHabits(isFutureDate(currentDate));
};

document.getElementById('habitInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addHabit').click();
});

document.getElementById('notesArea').addEventListener('input', e => {
    dayData.diary = e.target.value;
    autoResize(e.target);
    scheduleSave();
});

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.max(100, el.scrollHeight) + 'px';
}

document.getElementById('nothingBtn').onclick = () => {
    if (isFutureDate(currentDate)) return;
    if (!dayData.nothingToday) {
        dayData.savedDiary = dayData.diary || '';
        dayData.diary = '\u2014';
        dayData.nothingToday = true;
    } else {
        dayData.diary = dayData.savedDiary || '';
        dayData.nothingToday = false;
    }
    renderDiary(false);
    scheduleSave();
};

document.getElementById('saveJournalBtn').onclick = () => {
    if (isFutureDate(currentDate)) return;
    dayData.diary = document.getElementById('notesArea').value;
    saveDay(fmtDate(currentDate), dayData);
    flashSaved();
    // Button feedback
    const btn = document.getElementById('saveJournalBtn');
    const original = btn.textContent;
    btn.textContent = 'Saved ✓';
    btn.classList.add('saved');
    setTimeout(() => { btn.textContent = original; btn.classList.remove('saved'); }, 1400);
};

document.getElementById('themeBtn').onclick = () => {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveSettings(settings);
};

document.getElementById('navToday').onclick = () => switchPage('today');
document.getElementById('navOverview').onclick = () => switchPage('overview');

function switchPage(page) {
    document.getElementById('navToday').classList.toggle('active', page === 'today');
    document.getElementById('navOverview').classList.toggle('active', page === 'overview');
    document.getElementById('dateNavBox').classList.toggle('hidden', page !== 'today');

    const incoming = document.getElementById(page === 'today' ? 'todayPage' : 'overviewPage');
    const outgoing = document.getElementById(page === 'today' ? 'overviewPage' : 'todayPage');

    outgoing.classList.add('hidden');
    incoming.classList.remove('hidden');
    incoming.classList.remove('page-enter');
    void incoming.offsetWidth; // reflow to restart animation
    incoming.classList.add('page-enter');

    if (page === 'overview') {
        overviewMonth = new Date(currentDate);
        renderOverview();
    }
}

function monthLabelStr(d) {
    return d.toLocaleDateString(t('locale'), { month: 'long', year: 'numeric' });
}

document.getElementById('prevMonth').onclick = () => {
    overviewMonth.setMonth(overviewMonth.getMonth() - 1);
    renderOverview();
};

document.getElementById('nextMonth').onclick = () => {
    const now = new Date();
    if (overviewMonth.getFullYear() === now.getFullYear() && overviewMonth.getMonth() === now.getMonth()) return;
    overviewMonth.setMonth(overviewMonth.getMonth() + 1);
    renderOverview();
};

function renderOverview() {
    document.getElementById('monthLabel').textContent = monthLabelStr(overviewMonth);
    const now = new Date();
    document.getElementById('nextMonth').disabled = (overviewMonth.getFullYear() === now.getFullYear() && overviewMonth.getMonth() === now.getMonth());

    const year = overviewMonth.getFullYear();
    const month = overviewMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const todayKey = fmtDate(now);

    const keys = Array.from({length: daysInMonth}, (_, i) => fmtDate(new Date(year, month, i + 1)));
    const dataArr = keys.map(k => fetchDayCached(k));

    const grid = document.getElementById('calGrid');
    grid.innerHTML = '';

    for (let i = 0; i < firstWeekday; i++) {
        const blank = document.createElement('div');
        blank.className = 'calCell blank';
        grid.appendChild(blank);
    }

    keys.forEach((k, idx) => {
        const dayNum = idx + 1;
        const cellDate = new Date(year, month, dayNum);
        const future = isFutureDate(cellDate);
        const d = dataArr[idx];
        const cell = document.createElement('div');
        cell.className = 'calCell' + (k === todayKey ? ' today' : '') + (future ? ' future' : '');
        // Staggered fade-in
        cell.style.animation = `fadeIn .3s ease ${(idx * 0.015).toFixed(2)}s backwards`;
        let score = 0;
        if (d) {
            const habitVals = habits.length ? habits.filter(h => d.habitsDone && d.habitsDone[h]).length / habits.length : 0;
            const moodVal = weatherScore(d.weather);
            score = moodVal !== null ? (habitVals * 0.6 + moodVal * 0.4) : habitVals;
        }
        if (d && !future) {
            const color = d.weather ? weatherColors[d.weather] : '#5F7A5C';
            cell.style.background = hexToAlpha(color, Math.max(0.12, score));
        }
        cell.textContent = String(dayNum);
        if (!future) {
            cell.onclick = () => {
                currentDate = new Date(year, month, dayNum);
                dayData = loadDay(k);
                renderAll();
                switchPage('today');
            };
        }
        grid.appendChild(cell);
    });

    const habitStatsEl = document.getElementById('habitStats');
    habitStatsEl.innerHTML = '';
    if (habits.length === 0) {
        habitStatsEl.innerHTML = `<div class="empty">${t('noHabits')}</div>`;
    }
    habits.forEach((h, i) => {
        const trackedDays = dataArr.filter(d => d !== null);
        const doneCount = trackedDays.filter(d => d.habitsDone && d.habitsDone[h]).length;
        const pct = trackedDays.length ? Math.round((doneCount / trackedDays.length) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'barStat';
        row.innerHTML = `<div class="lbl"><span>${escapeHtml(h)}</span><span class="pct">${pct}%</span></div><div class="barTrack"><div class="fill" style="width:0%"></div></div>`;
        habitStatsEl.appendChild(row);
        // Animate bar width after paint
        const fill = row.querySelector('.fill');
        requestAnimationFrame(() => {
            setTimeout(() => { fill.style.width = pct + '%'; }, i * 60);
        });
    });

    const streakEl = document.getElementById('streakStats');
    streakEl.innerHTML = '';
    if (habits.length === 0) {
        streakEl.innerHTML = `<div class="empty">${t('addHabitToSeeStreaks')}</div>`;
    }
    for (const h of habits) {
        const streak = computeStreak(h, fmtDate(new Date()));
        const row = document.createElement('div');
        row.className = 'streakLine';
        row.innerHTML = `<span>${escapeHtml(h)}</span><span class="num">${streak}</span>`;
        streakEl.appendChild(row);
    }

    const moodEl = document.getElementById('moodStats');
    moodEl.innerHTML = '';
    const counts = {};
    weatherKeys.forEach(k => counts[k] = 0);
    dataArr.forEach(d => { if (d && d.weather && counts.hasOwnProperty(d.weather)) counts[d.weather]++; });
    const maxCount = Math.max(1, ...Object.values(counts));
    weatherKeys.forEach(k => {
        const h = Math.round((counts[k] / maxCount) * 100);
        const mb = document.createElement('div');
        mb.className = 'mb';
        mb.innerHTML = `<div class="col" style="height:${h}%;background:${weatherColors[k]}"></div><span>${t('weather')[k]}</span>`;
        moodEl.appendChild(mb);
    });
}

// Initialization
(function init() {
    settings = loadSettings();
    habits = loadHabits();
    dayData = loadDay(fmtDate(currentDate));
    applyTheme();
    renderAll();
})();