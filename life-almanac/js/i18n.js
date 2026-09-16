const strings = {
  appTitle: "Chapters",
  navToday: "Today", navOverview: "Overview",
  scheduleTitle: "Today's plan", taskPlaceholder: "Add something to your day", addBtn: "+",
  cultivationTitle: "Daily Routine", habitPlaceholder: "A habit worth building",
  diaryTitle: "Journal", diaryPlaceholder: "How did today go?",
  nothingBtn: "Quiet day, nothing to note", nothingBtnActive: "Marked as quiet \u2014 tap to undo",
  growthTitle: "Your last 14 days",
  emptySchedule: "Nothing on the schedule yet.",
  removeLabel: "\u00d7",
  lockMsg: "This day hasn't arrived yet \u2014 check back when it does.",
  savedTag: "saved", saveBtn: "Save",
  habitCompletionTitle: "Habit progress", streakTitle: "Current streaks", moodTitle: "This month's mood",
  noHabits: "No habits yet \u2014 start with one.", addHabitToSeeStreaks: "Add a habit to see your streaks.",
  weekdays: ["S","M","T","W","T","F","S"],
  weather: { storm: "Rough", rain: "Sad", cloud: "Neutral", sun: "Good", radiant: "Great" },
  locale: "en-US"
};

export function t(key) {
  return strings[key];
}