## 2024-03-15 - [ARIA Labels on Icon-Only Buttons]
**Learning:** Found a common accessibility issue pattern in this app where icon-only buttons (like circular camera capture/close buttons and step navigation indicators) lacked `aria-label`s, making them unreadable to screen readers.
**Action:** Always add `aria-label`s to custom icon buttons, especially interactive indicators like circular photo-capture or close buttons that do not have text.

## 2025-03-17 - [Dark Mode Utility Class Hardcoding]
**Learning:** Hardcoded dark mode classes (like `text-white` or `bg-[#111820]`) drastically break color contrast when a light theme is enabled, making text unreadable and UI elements invisible.
**Action:** When working in a dual-theme environment, strictly use semantic Tailwind variables (like `text-foreground`, `bg-card`, `text-muted-foreground`) instead of absolute color utility classes to ensure accessible contrast ratios in both light and dark modes.
