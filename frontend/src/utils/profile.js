export const DAYS_OF_WEEK = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

// Mirrors the backend DEADLINE_REMINDER_DAYS default. Display only — the backend
// value is what actually decides when a reminder fires.
export const DEADLINE_REMINDER_DAYS = 3;

export function buildProfileForm(user) {
  return {
    name: user?.name || "",
    phone: user?.phone || "",
    avatar: user?.avatar || "",
    whatsappId: user?.whatsappId || "",
    notificationsEnabled: user?.notificationsEnabled ?? true,
    deadlineRemindersEnabled: user?.deadlineRemindersEnabled ?? true,
    notificationFrequency: user?.notificationFrequency || "daily",
    notificationTime: user?.notificationTime || "19:00",
    notificationDayOfWeek: user?.notificationDayOfWeek ?? 0,
  };
}
