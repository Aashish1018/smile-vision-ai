## 2024-03-15 - [ARIA Labels on Icon-Only Buttons]
**Learning:** Found a common accessibility issue pattern in this app where icon-only buttons (like circular camera capture/close buttons and step navigation indicators) lacked `aria-label`s, making them unreadable to screen readers.
**Action:** Always add `aria-label`s to custom icon buttons, especially interactive indicators like circular photo-capture or close buttons that do not have text.
