# End-to-End Sequence Diagrams & Interaction Flows
## OwlSync Technical Architecture & Execution Flows

---

## 1. Zero-Conflict Collaborative Code Editing (CRDT Flow)

This diagram details how Monaco Editor keypress events are converted to binary CRDT updates using **Yjs**, propagated through WebSockets, broadcast via Redis Pub/Sub, and applied across remote peer editors without locks or data loss:

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (Developer 1)
    participant MonacoA as Alice's Monaco Editor
    participant YjsA as Alice's Yjs Doc
    participant WsClientA as Alice WS Client
    participant SocketGateway as Socket.IO Gateway (Port 4001)
    participant RedisPubSub as Redis Pub/Sub Matrix
    participant WsClientB as Bob WS Client
    participant YjsB as Bob's Yjs Doc
    participant MonacoB as Bob's Monaco Editor
    actor Bob as Bob (Developer 2)

    Alice->>MonacoA: Inserts function snippet
    MonacoA->>YjsA: Transform edit to Yjs Transaction
    YjsA->>WsClientA: Generate binary CRDT delta Uint8Array
    WsClientA->>SocketGateway: emit('editor:sync_update', { roomId, update })
    
    SocketGateway->>RedisPubSub: PUBLISH room:channel update
    RedisPubSub-->>SocketGateway: Distribute to subscribed node instances
    SocketGateway->>WsClientB: emit('editor:sync_update', update)

    WsClientB->>YjsB: Y.applyUpdate(doc, update)
    YjsB->>MonacoB: Emit localized text mutation
    MonacoB-->>Bob: Renders Alice's edit with author color marker
```

---

## 2. WebRTC Peer-to-Peer Voice Mesh Signaling Flow

Voice rooms in OwlSync establish a direct peer-to-peer audio mesh. The Socket.IO server acts exclusively as the SDP and ICE candidate signaling broker:

```mermaid
sequenceDiagram
    autonumber
    actor UserA as Alice (Host)
    participant SocketA as Alice's Socket Client
    participant Gateway as OwlSync Socket Server
    participant SocketB as Bob's Socket Client
    actor UserB as Bob (Participant)

    UserA->>SocketA: Connects to Voice Room (Mics unmuted)
    SocketA->>Gateway: emit('voice:join', { roomId: 'room-101' })
    Gateway->>SocketB: emit('voice:user_joined', { userId: Alice, socketId: 'sock_A' })

    UserB->>SocketB: Initiates RTCPeerConnection
    SocketB->>SocketB: createOffer({ offerToReceiveAudio: true })
    SocketB->>SocketB: setLocalDescription(SDP_Offer)
    SocketB->>Gateway: emit('voice:signal', { target: 'sock_A', signalData: SDP_Offer })

    Gateway->>SocketA: emit('voice:signal', { sender: 'sock_B', signalData: SDP_Offer })
    SocketA->>SocketA: setRemoteDescription(SDP_Offer)
    SocketA->>SocketA: createAnswer()
    SocketA->>SocketA: setLocalDescription(SDP_Answer)
    SocketA->>Gateway: emit('voice:signal', { target: 'sock_B', signalData: SDP_Answer })

    Gateway->>SocketB: emit('voice:signal', { sender: 'sock_A', signalData: SDP_Answer })
    SocketB->>SocketB: setRemoteDescription(SDP_Answer)

    Note over UserA,UserB: Direct P2P WebRTC Audio Stream Active (Ultra Low Latency)
```

---

## 3. Asynchronous Task Processing Flow (RabbitMQ Pipeline)

Heavy operations (such as project `.zip` bundle generation or session recording thumbnail processing) are queued asynchronously to keep API response times under 5ms:

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant Client as Web Client UI
    participant API as REST API Server
    participant RabbitMQ as RabbitMQ Broker
    participant Worker as Background Worker (Node.js)
    participant Disk as Storage Disk
    participant PG as PostgreSQL

    Dev->>Client: Clicks "Export Project as ZIP"
    Client->>API: GET /api/projects/:id/export
    API->>RabbitMQ: publishToQueue('compression_queue', { projectId, exportId })
    API-->>Client: 202 Accepted { status: 'QUEUED', trackingId }

    Note over API,Client: API thread immediately freed for incoming requests

    RabbitMQ->>Worker: Delivers compression job message
    Worker->>PG: Fetches all project files & directory tree
    Worker->>Disk: Compresses files into /storage/exports/{exportId}.zip
    Worker->>RabbitMQ: Channel ACK (Job Completed)
    Worker->>PG: Updates export record status to 'READY'

    Client->>API: Polls or receives notification
    API-->>Client: 200 OK (Initiates file stream download)
```

---

## 4. Context-Aware AI Pair Programmer (SSE Streaming Flow)

The AI assistant utilizes Server-Sent Events (SSE) to stream intelligent code generation directly into Monaco Editor without blocking HTTP sockets:

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant UI as Monaco AI Panel
    participant APIServer as REST API (:4000)
    participant Gemini as Google Gemini AI Engine

    Dev->>UI: Highlights code & prompts: "Refactor to async/await and add tests"
    UI->>APIServer: POST /api/ai/agent/stream { code, contextFiles, prompt }
    APIServer-->>UI: 200 OK (Content-Type: text/event-stream)

    APIServer->>Gemini: Stream prompt with localized context
    loop Token Generation
        Gemini-->>APIServer: Chunk response token
        APIServer-->>UI: data: { event: 'token', content: '...' }
        UI-->>Dev: Real-time inline typing preview in diff viewer
    end

    APIServer-->>UI: data: [DONE]
    Dev->>UI: Clicks "Accept Diff" -> Updates Yjs file buffer
```

---

## 5. Distributed Lock (Redlock Pattern with Atomic Lua Release)

To prevent race conditions during concurrent room joins or workspace updates across horizontal instances:

```mermaid
sequenceDiagram
    autonumber
    participant NodeA as API Node A
    participant Redis as Redis Server
    participant NodeB as API Node B

    NodeA->>Redis: SET lock:room:join:101:user1 tokenA NX PX 5000
    Redis-->>NodeA: OK (Lock Acquired)

    NodeB->>Redis: SET lock:room:join:101:user1 tokenB NX PX 5000
    Redis-->>NodeB: nil (Lock Held - Node B Spin-Waits up to 3000ms)

    NodeA->>NodeA: Performs database transaction (create room membership)
    NodeA->>Redis: EVAL Lua Script (Verify tokenA == storedToken before DEL)
    Redis-->>NodeA: 1 (Lock Safely Released)

    NodeB->>Redis: SET lock:room:join:101:user1 tokenB NX PX 5000
    Redis-->>NodeB: OK (Acquired on retry)
    NodeB->>NodeB: Finds existing member -> Returns idempotent success
    NodeB->>Redis: EVAL Lua Script (Release tokenB)
```
