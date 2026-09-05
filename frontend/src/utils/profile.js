export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function buildProfileForm(user) {
  return {
    name: user?.name || "",
    phone: user?.phone || "",
    avatar: user?.avatar || "",
    whatsappId: user?.whatsappId || "",
    notificationsEnabled: user?.notificationsEnabled ?? true,
    notificationFrequency: user?.notificationFrequency || "daily",
    notificationTime: user?.notificationTime || "19:00",
    notificationDayOfWeek: user?.notificationDayOfWeek ?? 0,
  };
}
