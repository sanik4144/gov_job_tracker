import {
  Bell,
  CalendarDays,
  Image,
  Mail,
  Phone,
  Save,
  Settings,
  User,
} from "lucide-react";
import { useState } from "react";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { TelegramConnect } from "../components/TelegramConnect.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { DAYS_OF_WEEK } from "../utils/profile.js";

export function ProfilePage() {
  const { user, setUser, profileForm, setProfileForm, syncProfileForm, apiFetch } = useAuth();
  const [profileSaving, setProfileSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function saveProfile(event) {
    event.preventDefault();
    setProfileSaving(true);
    setStatus("");

    try {
      const data = await apiFetch("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(profileForm),
      });
      setUser(data.user);
      syncProfileForm(data.user);
      setStatus("Profile updated successfully");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <section className="profile-view">
      <div className="toolbar">
        <div>
          <h2>Profile</h2>
          <p>Keep your contact and notification details current</p>
        </div>
      </div>

      <StatusMessage message={status} />

      <form className="profile-form" onSubmit={saveProfile}>
        <section className="profile-section">
          <header>
            <User size={18} />
            <h3>Account Info</h3>
          </header>

          <div className="profile-grid">
            <label>
              <span>Name</span>
              <div>
                <User size={18} />
                <input
                  value={profileForm.name}
                  onChange={(event) =>
                    setProfileForm({ ...profileForm, name: event.target.value })
                  }
                  required
                />
              </div>
            </label>

            <label>
              <span>Email</span>
              <div>
                <Mail size={18} />
                <input value={user?.email || ""} disabled />
              </div>
            </label>

            <label>
              <span>Phone</span>
              <div>
                <Phone size={18} />
                <input
                  value={profileForm.phone}
                  onChange={(event) =>
                    setProfileForm({ ...profileForm, phone: event.target.value })
                  }
                  placeholder="Phone number"
                />
              </div>
            </label>

            <label>
              <span>Avatar URL</span>
              <div>
                <Image size={18} />
                <input
                  value={profileForm.avatar}
                  onChange={(event) =>
                    setProfileForm({ ...profileForm, avatar: event.target.value })
                  }
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
            </label>

            <div className="profile-field profile-field--wide">
              <span>Telegram</span>
              <TelegramConnect />
            </div>

            <label>
              <span>WhatsApp ID</span>
              <div>
                <Phone size={18} />
                <input
                  value={profileForm.whatsappId}
                  onChange={(event) =>
                    setProfileForm({ ...profileForm, whatsappId: event.target.value })
                  }
                  placeholder="Optional"
                />
              </div>
            </label>
          </div>
        </section>

        <section className="profile-section">
          <header>
            <Settings size={18} />
            <h3>Notification Schedule</h3>
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={profileForm.notificationsEnabled}
                onChange={(event) =>
                  setProfileForm({
                    ...profileForm,
                    notificationsEnabled: event.target.checked,
                  })
                }
              />
              <span />
            </label>
          </header>

          <div className="schedule-summary">
            {profileForm.notificationsEnabled
              ? profileForm.notificationFrequency === "weekly"
                ? `Weekly on ${DAYS_OF_WEEK[profileForm.notificationDayOfWeek]} at ${
                    profileForm.notificationTime
                  }`
                : `Daily at ${profileForm.notificationTime}`
              : "Notifications are turned off"}
          </div>

          <div className="profile-grid">
            <label>
              <span>Frequency</span>
              <div>
                <Settings size={18} />
                <select
                  value={profileForm.notificationFrequency}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      notificationFrequency: event.target.value,
                    })
                  }
                  disabled={!profileForm.notificationsEnabled}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </label>

            <label>
              <span>Time</span>
              <div>
                <Bell size={18} />
                <input
                  type="time"
                  value={profileForm.notificationTime}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      notificationTime: event.target.value,
                    })
                  }
                  disabled={!profileForm.notificationsEnabled}
                />
              </div>
            </label>

            {profileForm.notificationFrequency === "weekly" && (
              <label>
                <span>Day of Week</span>
                <div>
                  <CalendarDays size={18} />
                  <select
                    value={profileForm.notificationDayOfWeek}
                    onChange={(event) =>
                      setProfileForm({
                        ...profileForm,
                        notificationDayOfWeek: Number(event.target.value),
                      })
                    }
                    disabled={!profileForm.notificationsEnabled}
                  >
                    {DAYS_OF_WEEK.map((day, index) => (
                      <option value={index} key={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            )}
          </div>
        </section>

        <button type="submit" disabled={profileSaving}>
          <Save size={18} />
          {profileSaving ? "Saving" : "Save Profile"}
        </button>
      </form>
    </section>
  );
}
