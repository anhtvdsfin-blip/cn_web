# Complete Flow Example - Match to Notification

This document shows the complete end-to-end flow with actual code and data examples.

---

## Scenario

**User A (ID: 111)** likes **User B (ID: 222)**
But User B already liked User A yesterday.

---

## Step 1: Frontend - User A Swipes Right

```javascript
// User A's browser
const handleSwipe = async (targetUserId, action) => {
  try {
    const response = await axios.post(
      `/api/findlove/swipe/${userId}`,
      { targetId: targetUserId, action }
    );

    if (response.data.match) {
      // User A matched with User B!
      toast.success('You got a match! 🎉');
      // Notification will come via socket event
    }
  } catch (error) {
    console.error('Swipe error:', error);
  }
};

// Call when User A likes User B
handleSwipe('222', 'like');
```

---

## Step 2: Backend - Controller Receives Request

**File:** `/Server/controllers/findLoveController.js`

```javascript
export const submitSwipe = async (req, res) => {
  try {
    const { userId } = req.params;  // userId = "111"
    const { targetId, action } = req.body;  // targetId = "222", action = "like"

    const io = req.app.get('io');  // Get socket.io instance

    // Call service to register swipe
    const result = await findLoveService.registerSwipe(userId, targetId, action);

    // If match created, emit notifications
    if (result.match && result.notifications) {
      emitMatchNotifications(io, userId, targetId, result.notifications);
    }

    return res.status(httpStatus.OK).json({
      success: true,
      match: result.match,
      matchId: result.matchId,
      notifications: result.notifications
    });
  } catch (error) {
    // Error handling...
  }
};
```

---

## Step 3: Backend - Service Logic

**File:** `/Server/services/findLoveService.js`

### Phase 1: Check for Reciprocal Like

```javascript
async registerSwipe(userId, targetUserId, rawAction) {
  // userId = "111", targetUserId = "222", rawAction = "like"

  // Validate action
  const action = SUPPORTED_ACTIONS.get('like');  // action = "like"

  // Fetch both users
  const swiperDoc = await User.findById('111');  // User A
  const targetDoc = await User.findById('222');  // User B

  // Create/update swipe record for User A
  const swipeRecord = await Swipe.findOneAndUpdate(
    { swiperId: '111', swipedId: '222' },
    { actionType: 'like', isMatch: false },
    { new: true, upsert: true }
  );

  // Check if User B already liked User A
  const reciprocal = await Swipe.findOne({
    swiperId: '222',
    swipedId: '111',
    actionType: 'like'
  });

  if (!reciprocal) {
    // User B hasn't liked User A yet
    return { match: false, swipe: swipeRecord };
  }

  // ✅ BOTH USERS LIKED EACH OTHER! MATCH CREATED!
```

### Phase 2: Create Match

```javascript
  // Mark both swipes as matched
  await Promise.all([
    Swipe.updateOne({ _id: swipeRecord._id }, { $set: { isMatch: true } }),
    Swipe.updateOne({ _id: reciprocal._id }, { $set: { isMatch: true } })
  ]);

  // Create/update match document
  const matchId = await createOrUpdateMatch('111', '222', compatibility);

  // Database record created:
  // {
  //   _id: "matchId_xyz",
  //   user1Id: "111",
  //   user2Id: "222",
  //   status: "active",
  //   matchedAt: 2025-12-13T10:30:00Z,
  //   expiresAt: 2025-12-13T10:33:00Z,
  //   lastMessage: null,
  //   unreadCount: Map {},
  //   typing: Map {}
  // }
```

### Phase 3: Create Match Notifications

```javascript
  // ============ CREATE NOTIFICATIONS ============
  const notifications = await notificationService.createMatchNotifications(
    '111',        // User A
    '222',        // User B
    'matchId_xyz' // Match ID
  );

  // What notificationService.createMatchNotifications does:

  // 1. Fetch both users
  const user1 = await User.findById('111');  // User A: { name: "Alice", ... }
  const user2 = await User.findById('222');  // User B: { name: "Bob", ... }

  // 2. Create notification for User A
  const notif1 = await Notification.create({
    recipientId: '111',                    // User A receives
    senderId: '222',                       // From User B
    type: 'match',
    matchId: 'matchId_xyz',
    content: 'Bạn và Bob đã match nhau 💖',  // Content shows Bob's name
    isRead: false
  });
  // Database saves:
  // {
  //   _id: "notif1_abc",
  //   recipientId: "111",
  //   senderId: "222",
  //   type: "match",
  //   matchId: "matchId_xyz",
  //   content: "Bạn và Bob đã match nhau 💖",
  //   isRead: false,
  //   createdAt: 2025-12-13T10:30:00Z
  // }

  // 3. Create notification for User B
  const notif2 = await Notification.create({
    recipientId: '222',                    // User B receives
    senderId: '111',                       // From User A
    type: 'match',
    matchId: 'matchId_xyz',
    content: 'Bạn và Alice đã match nhau 💖',  // Content shows Alice's name
    isRead: false
  });
  // Database saves:
  // {
  //   _id: "notif2_def",
  //   recipientId: "222",
  //   senderId: "111",
  //   type: "match",
  //   matchId: "matchId_xyz",
  //   content: "Bạn và Alice đã match nhau 💖",
  //   isRead: false,
  //   createdAt: 2025-12-13T10:30:00Z
  // }

  // 4. Return both notifications
  return [notif1, notif2];
}
```

---

## Step 4: Socket Emission

**File:** `/Server/controllers/findLoveController.js` (continued)

```javascript
// After registerSwipe completes:
if (result.match && result.notifications) {
  // result.notifications = [notif1, notif2] from above

  emitMatchNotifications(io, '111', '222', result.notifications);
  //                                ↓ userId  ↓ targetId ↓ notifications
}
```

**File:** `/Server/socket/notificationSocket.js`

```javascript
export const emitMatchNotifications = (io, user1Id, user2Id, notifications) => {
  // io = socket.io instance
  // user1Id = '111' (User A)
  // user2Id = '222' (User B)
  // notifications = [notif1, notif2]

  if (Array.isArray(notifications) && notifications.length === 2) {
    // Emit to User A
    emitNotification(io, '111', notifications[0]);
    // Emits: io.to('notifications_111').emit('new_notification', {
    //   notification: {
    //     _id: "notif1_abc",
    //     recipientId: "111",
    //     senderId: "222",
    //     type: "match",
    //     matchId: "matchId_xyz",
    //     content: "Bạn và Bob đã match nhau 💖",
    //     isRead: false
    //   }
    // })

    // Emit to User B
    emitNotification(io, '222', notifications[1]);
    // Emits: io.to('notifications_222').emit('new_notification', {
    //   notification: {
    //     _id: "notif2_def",
    //     recipientId: "222",
    //     senderId: "111",
    //     type: "match",
    //     matchId: "matchId_xyz",
    //     content: "Bạn và Alice đã match nhau 💖",
    //     isRead: false
    //   }
    // })
  }
};
```

---

## Step 5: Frontend - Real-time Socket Event

**User A's Browser:**

```javascript
// In NotificationContext setup:
socket.on('new_notification', ({ notification }) => {
  // notification received from socket event:
  // {
  //   _id: "notif1_abc",
  //   recipientId: "111",
  //   senderId: "222",
  //   type: "match",
  //   matchId: "matchId_xyz",
  //   content: "Bạn và Bob đã match nhau 💖",
  //   isRead: false,
  //   createdAt: "2025-12-13T10:30:00Z"
  // }

  // Update state
  setNotifications(prev => [notification, ...prev]);
  setUnreadCount(prev => prev + 1);

  // Show toast
  toast.success(notification.content);
  // Shows: "Bạn và Bob đã match nhau 💖"

  // Play sound (optional)
  playNotificationSound();

  // Update badge
  updateNotificationBadge(unreadCount + 1);
});
```

**User B's Browser:**

```javascript
socket.on('new_notification', ({ notification }) => {
  // notification received:
  // {
  //   _id: "notif2_def",
  //   recipientId: "222",
  //   senderId: "111",
  //   type: "match",
  //   matchId: "matchId_xyz",
  //   content: "Bạn và Alice đã match nhau 💖",
  //   isRead: false,
  //   createdAt: "2025-12-13T10:30:00Z"
  // }

  setNotifications(prev => [notification, ...prev]);
  setUnreadCount(prev => prev + 1);
  toast.success("Bạn và Alice đã match nhau 💖");
});
```

---

## Step 6: Frontend - UI Display

**NotificationPanel Component:**

```javascript
export const NotificationPanel = () => {
  const { notifications, unreadCount } = useContext(NotificationContext);

  return (
    <div className="notification-panel">
      <h3>Thông báo ({unreadCount})</h3>

      {notifications.map(notif => (
        <div key={notif._id} className={notif.isRead ? '' : 'unread'}>
          <div className="content">
            {notif.content}
            {/* Shows: "Bạn và Bob đã match nhau 💖" */}
          </div>
          <div className="time">
            {formatDate(notif.createdAt)}
            {/* Shows: "10:30 AM" or "2 minutes ago" */}
          </div>
          {!notif.isRead && (
            <button onClick={() => markAsRead(notif._id)}>
              Đánh dấu đã đọc
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
```

---

## Step 7: User Marks as Read

**Frontend:**

```javascript
const handleMarkAsRead = (notificationId) => {
  socket.emit('mark_notification_read', { notificationId }, (result) => {
    if (result.success) {
      // Update local state
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  });
};
```

**Backend Socket:**

```javascript
// socket/notificationSocket.js
socket.on('mark_notification_read', async ({ notificationId }, callback) => {
  try {
    const notification = await notificationService.markAsRead(notificationId);
    // Database update:
    // db.notifications.updateOne(
    //   { _id: ObjectId("notif1_abc") },
    //   { $set: { isRead: true, readAt: 2025-12-13T10:31:00Z } }
    // )

    callback({ success: true, notification });
  } catch (error) {
    callback({ success: false, error: error.message });
  }
});
```

---

## Step 8: Access via REST API

**Get All Notifications:**

```bash
curl "http://localhost:5000/api/111?limit=20&skip=0"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "notif1_abc",
      "recipientId": "111",
      "senderId": {
        "_id": "222",
        "name": "Bob",
        "avatar": "..."
      },
      "type": "match",
      "matchId": {
        "_id": "matchId_xyz",
        "user1Id": "111",
        "user2Id": "222"
      },
      "content": "Bạn và Bob đã match nhau 💖",
      "isRead": true,
      "readAt": "2025-12-13T10:31:00Z",
      "createdAt": "2025-12-13T10:30:00Z"
    }
  ],
  "total": 1,
  "hasMore": false
}
```

**Get Unread Count:**

```bash
curl "http://localhost:5000/api/111/unread-count"
```

**Response:**

```json
{
  "success": true,
  "unreadCount": 0
}
```

---

## Database State After Complete Flow

### Swipe Collection
```javascript
db.swipes.find()
{
  _id: swipe1_id,
  swiperId: "111",      // User A
  swipedId: "222",      // User B
  actionType: "like",
  isMatch: true,        // ✅ Updated!
  createdAt: "2025-12-12T...",
  updatedAt: "2025-12-13T10:30:00Z"
}
{
  _id: swipe2_id,
  swiperId: "222",      // User B
  swipedId: "111",      // User A
  actionType: "like",
  isMatch: true,        // ✅ Updated!
  createdAt: "2025-12-12T...",
  updatedAt: "2025-12-13T10:30:00Z"
}
```

### Match Collection
```javascript
db.matches.find()
{
  _id: "matchId_xyz",
  user1Id: "111",
  user2Id: "222",
  status: "active",
  matchedAt: "2025-12-13T10:30:00Z",
  expiresAt: "2025-12-13T10:33:00Z",
  lastMessage: null,
  unreadCount: {},
  typing: {},
  createdAt: "2025-12-13T10:30:00Z",
  updatedAt: "2025-12-13T10:30:00Z"
}
```

### Notification Collection
```javascript
db.notifications.find()
{
  _id: "notif1_abc",
  recipientId: "111",
  senderId: "222",
  type: "match",
  matchId: "matchId_xyz",
  content: "Bạn và Bob đã match nhau 💖",
  isRead: true,
  readAt: "2025-12-13T10:31:00Z",
  createdAt: "2025-12-13T10:30:00Z",
  updatedAt: "2025-12-13T10:31:00Z"
}
{
  _id: "notif2_def",
  recipientId: "222",
  senderId: "111",
  type: "match",
  matchId: "matchId_xyz",
  content: "Bạn và Alice đã match nhau 💖",
  isRead: false,
  readAt: null,
  createdAt: "2025-12-13T10:30:00Z",
  updatedAt: "2025-12-13T10:30:00Z"
}
```

---

## Timeline

```
10:00:00 - User B likes User A
10:30:00 - User A likes User B
          → submitSwipe() called
          → registerSwipe() checks for reciprocal
          → Finds User B's like!
          → Match created
          → Notifications created (2)
          → Socket events emitted (2)
          → Toast appears on both browsers
          → Notification badge updates

10:31:00 - User A marks notification as read
          → markAsRead() called
          → Database updated
          → Local state updated
          → Badge count decrements
```

---

## Summary

This complete example shows:
1. ✅ Frontend triggers swipe
2. ✅ Backend checks for reciprocal like
3. ✅ Match is created when both users liked each other
4. ✅ Notifications created for both users in database
5. ✅ Socket events emitted in real-time
6. ✅ Frontend receives notification via socket
7. ✅ UI updates with notification
8. ✅ User marks as read via socket
9. ✅ Database updates status
10. ✅ UI reflects changes

All with proper error handling, logging, and performance optimization!
