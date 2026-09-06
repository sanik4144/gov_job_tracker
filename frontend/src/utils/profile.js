// Indexed by JavaScript's day number (0 = Sunday), because that is what the backend
// stores in notificationDayOfWeek and compares against Date.getUTCDay(). Do not
// reorder this array — change WEEK_DISPLAY_ORDER instead.
export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// The order the week is shown in, Saturday first as the Bangladeshi week runs.
// Values are indexes into DAYS_OF_WEEK, so display order and stored value stay
// independent.
export const WEEK_DISPLAY_ORDER = [6, 0, 1, 2, 3, 4, 5];

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
