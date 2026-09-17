// In-memory cache to reduce redundant localStorage reads
const trailCache = {};

const getStorage = (key, defaultValue) => {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

const setStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage error:', e);
  }
};

export const defaultDay = () => ({
  schedule: [], habitsDone: {}, weather: null, diary: '', savedDiary: '', nothingToday: false,
  calories: [], finance: []
});

export const loadSettings = () => {
  const settings = getStorage('settings', { theme: 'light', lang: 'en', calGoal: 2000, currency: '฿' });
  if (!settings.lang) settings.lang = 'en';
  if (!settings.calGoal) settings.calGoal = 2000;
  if (!settings.currency) settings.currency = '฿';
  return settings;
};

export const saveSettings = (settings) => {
  setStorage('settings', settings);
};

export const loadHabits = () => {
  return getStorage('habits-list', ['Move body', 'Read', 'Sleep 7+ hrs']);
};

export const saveHabits = (habits) => {
  setStorage('habits-list', habits);
};

export const loadDay = (dateKey) => {
  const data = getStorage('day:' + dateKey, defaultDay());
  return Object.assign(defaultDay(), data);
};

export const saveDay = (dateKey, dayData) => {
  setStorage('day:' + dateKey, dayData);
  trailCache[dateKey] = dayData;
};

export const fetchDayCached = (key) => {
  if (trailCache.hasOwnProperty(key)) return trailCache[key];
  const data = getStorage('day:' + key, null);
  trailCache[key] = data;
  return data;
};

export const computeStreak = (habitName, fromDateStr) => {
  let streak = 0;
  let d = new Date(fromDateStr + 'T00:00:00');

  while (true) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const data = fetchDayCached(k);

    if (data && data.habitsDone && data.habitsDone[habitName]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
    if (streak > 3650) break;
  }
  return streak;
};