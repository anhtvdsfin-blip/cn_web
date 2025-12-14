# Notification UI Implementation

## Overview
Complete notification UI with dropdown panel, real-time updates, and mark-as-read functionality using Tailwind CSS.

## Components

### NotificationPanel (`src/components/NotificationPanel.jsx`)
- **Dropdown Panel**: Toggles on bell icon click
- **Notification Items**: 
  - Match notifications: Displays "💖 Bạn và {name} đã match nhau"
  - Other types: Shows generic 📬 icon
  - Unread indicator: Blue dot on right side
  - Light blue background for unread notifications
  
- **Features**:
  - Responsive positioning (right-aligned, fixed to viewport)
  - Overlay click to close
  - Pagination-ready (max 4 items visible, scrollable)
  - Mark as read on click
  - Navigate to conversation for match notifications
  
- **Styling**: 
  - Pure Tailwind CSS (no external CSS)
  - Matches existing design (rose/teal color scheme)
  - Shadow effects, transitions, hover states

### Navbar Integration
- **Bell Icon Button**: Top-right corner with badge
- **Badge**: Shows unread count (displays "9+" if > 9)
- **State Management**: 
  - `showNotifications`: Controls panel visibility
  - `unreadCount`: Passed from App.jsx via SocketContext

## Features

### 1. Bell Icon with Badge
```jsx
<button onClick={() => setShowNotifications(!showNotifications)}>
  <Bell />
  {unreadCount > 0 && <span>{unreadCount > 9 ? '9+' : unreadCount}</span>}
</button>
```

### 2. Dropdown Toggle
- Click bell → opens NotificationPanel
- Click overlay → closes panel
- Click X button → closes panel

### 3. Mark as Read
```javascript
const handleMarkAsRead = async (notificationId) => {
  // POST /api/notifications/:id/read
  // Updates local state
  // Decrements unreadCount
}
```

### 4. Match Notification Actions
```javascript
handleNotificationClick(notification) {
  // Mark as read
  // If match type: navigate to /messenger?matchId=...
}
```

## Data Flow

```
App.jsx (notifications state)
  ↓
SocketContext.Provider
  ↓
Navbar receives unreadCount prop
  ↓
NotificationPanel accesses notifications from SocketContext
  ↓
Click notification → Mark as read API call
  ↓
App.jsx updates notifications state via setNotifications
```

## Styling Details

### Colors
- Background: `bg-white` / `bg-blue-50` (unread)
- Text: `text-slate-900` / `text-slate-500`
- Badge: `bg-red-500` (unread count)
- Unread dot: `bg-teal-500`
- Hover: `hover:bg-blue-100` (unread) / `hover:bg-slate-50` (read)
- Border: `border-slate-200` / `border-slate-100`

### Layout
- Fixed position: `fixed right-4 top-16 z-50`
- Panel width: `w-96` (responsive: `max-w-[calc(100vw-32px)]`)
- Max height: `max-h-96` (scrollable)
- Overlay: `fixed inset-0 z-40`

## Responsive Design
- Panel repositions for mobile (max-width prevents overflow)
- Touch-friendly button sizing (h-10 w-10)
- Full-width overlay for mobile interactions

## Time Formatting
Displays relative time:
- "Vừa xong" (< 1 minute)
- "5m", "2h", "3d" (minutes, hours, days)
- Date in DD/MM/YYYY format (> 7 days)

## Integration Checklist
✅ NotificationPanel component created
✅ Navbar imports NotificationPanel
✅ Navbar state: showNotifications
✅ Bell button onClick toggles panel
✅ unreadCount badge displays
✅ Notification items styled
✅ Mark as read API integration
✅ Navigate to conversation on match click
✅ Error handling for API calls
✅ Overlay click closes panel
✅ All Tailwind styling (no external CSS)
✅ Matches existing design language

## Next Steps (Optional)
- Add delete notification functionality
- Add "Mark all as read" button
- Add "View all notifications" page
- Add notification preferences/settings
- Add sound notification alert
