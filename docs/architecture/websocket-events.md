# WebSocket Event Catalog & Real-Time Specifications

---

## 1. Overview
The OwlSync WebSocket server runs on port `4001` powered by **Socket.IO** and Redis Pub/Sub adapter. Sockets are authenticated via JWT cookies or auth handshake tokens.

---

## 2. Event Directory

### 2.1 Editor Synchronization Events
| Event | Direction | Payload | Description |
|:---|:---|:---|:---|
| `editor:sync_update` | Client ↔ Server | `{ roomId, update: Uint8Array }` | Transmits raw binary Yjs CRDT document changes. |
| `editor:cursor` | Client ↔ Server | `{ roomId, cursor: { line, column, name, color } }` | Broadcasts real-time Monaco editor cursor positions. |

### 2.2 Room Lifecycle & Permissions Events
| Event | Direction | Payload | Description |
|:---|:---|:---|:---|
| `room:join` | Client → Server | `{ roomId }` | Sockets join room channel and notify active participants. |
| `room:leave` | Client → Server | `{ roomId }` | Gracefully removes user from room and audio session. |
| `room:active_users` | Server → Client | `{ activeUsers: string[] }` | Array of currently connected user IDs in the room. |
| `room:change_role` | Client → Server | `{ roomId, targetUserId, role }` | Room owner changes a member role (`MEMBER` vs `GUEST`). |
| `room:role_changed` | Server → Client | `{ targetUserId, role }` | Alerts user and room participants of permission changes. |
| `room:kick` | Client → Server | `{ roomId, targetUserId }` | Room owner kicks a user from the room. |
| `room:kicked` | Server → Client | `{ roomId }` | Disconnects the targeted client and redirects to dashboard. |

### 2.3 WebRTC Voice Signaling Events
| Event | Direction | Payload | Description |
|:---|:---|:---|:---|
| `voice:join` | Client → Server | `{ roomId }` | Signals intent to establish WebRTC peer mesh. |
| `voice:user_joined` | Server → Client | `{ userId, socketId }` | Informs existing voice peers to create SDP offers. |
| `voice:signal` | Client ↔ Server | `{ target, sender, signalData }` | Relays SDP offer, SDP answer, or ICE candidate. |
| `voice:leave` | Client → Server | `{ roomId }` | Closes peer connections and cleans up media tracks. |

### 2.4 Notifications & Activity Events
| Event | Direction | Payload | Description |
|:---|:---|:---|:---|
| `notification:new` | Server → Client | `{ notification: NotificationDTO }` | Delivers real-time in-app alerts to `user:${userId}` room. |
| `project:activity:new` | Client ↔ Server | `{ projectId, activity: ActivityDTO }` | Live updates project timeline and change history. |
| `project:files_changed` | Server → Client | `{ projectId }` | Triggers file explorer refresh on file creation/rename/delete. |
