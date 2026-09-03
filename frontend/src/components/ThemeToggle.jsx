import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";

export function ThemeToggle({ className = "theme-toggle", iconOnly = false }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={className}
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={iconOnly ? 17 : 15} /> : <Moon size={iconOnly ? 17 : 15} />}
      {!iconOnly && <span>{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
}
