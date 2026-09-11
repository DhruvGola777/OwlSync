# System Architecture & Component Design
## OwlSync Distributed Architecture Specification

---

## 1. High-Level Subsystem Breakdown

OwlSync is organized into distinct decoupled subsystems spanning the client UI, gateway layer, WebSocket real-time engine, REST API, asynchronous message broker, and persistence storage:

```mermaid
graph TB
    subgraph Client ["Client Subsystems (Web Client)"]
        UI["Monaco IDE & File Tree"]
        Recorder["SessionRecorder Service (WebM Export)"]
        VoiceClient["VoiceManager & WebRTC Mesh"]
        TimelineUI["Timeline & Code Authorship Inspector"]
        TerminalUI["Virtual POSIX Terminal"]
    end

    subgraph SocketCluster ["Real-Time Socket Subsystems (Port 4001)"]
        EditorHandler["editor.handlers.js (Yjs Sync)"]
        VoiceHandler["voice.handlers.js (WebRTC Signaling)"]
        ActivityHandler["activity.handlers.js (Authorship & Presence)"]
        RoomHandler["room.handlers.js (Roles & Permissions)"]
        ChatHandler["chat.handlers.js (Real-Time Messaging)"]
    end

    subgraph APICluster ["REST API Subsystems (Port 4000)"]
        AuthMod["Auth & 2FA Module"]
        ProjectsMod["Projects & Files Module"]
        TeamsMod["Teams & Workspaces Module"]
        SearchMod["Global Search Engine"]
        NotificationsMod["Notifications Module"]
        AIMod["AI Pair Programmer (SSE Streaming)"]
        AnalyticsMod["Analytics & Metrics Module"]
    end

    subgraph InfrastructureLayer ["Data & Message Broker Layer"]
        Postgres[(PostgreSQL 15)]
        Redis[(Redis 7 Cluster)]
        RabbitMQ{{RabbitMQ 3 Exchange}}
    end

    UI -->|Yjs binary updates| EditorHandler
    VoiceClient -->|Signaling: offer / answer / ICE| VoiceHandler
    TimelineUI -->|Activity & Authorship Broadcast| ActivityHandler
    UI -->|Role change / kick| RoomHandler
    UI -->|Chat messages| ChatHandler

    UI -->|REST Endpoints| APICluster
    TerminalUI -->|Run commands| APICluster

    APICluster --> Postgres
    APICluster --> Redis
    APICluster --> RabbitMQ

    SocketCluster --> Redis
    SocketCluster --> Postgres
```

---

## 2. Voice, Media & Authorship Flow Diagram

The diagram below details the client-to-socket event pipeline for WebRTC audio mesh signaling, session screen recording, and live code authorship inspection:

```mermaid
flowchart TD
    subgraph WebClient ["OwlSync Web Client"]
        SR["SessionRecorder Service<br/>(Export WebM / Preview)"]
        HVC["Header Voice & Rec Controls"]
        VM["VoiceManager & WebRTC Mesh"]
        TL["Timeline & Code Authorship"]
    end

    subgraph SocketServer ["OwlSync Socket.IO Server"]
        AH["activity.handlers.js<br/>(Activity & Authorship Broadcast)"]
        VH["voice.handlers.js<br/>(Signaling: offer / answer / ICE)"]
        RH["room.handlers.js<br/>(Permission Drop-Guards)"]
    end

    HVC -->|Trigger Rec Start/Stop| SR
    HVC -->|Toggle Mic / Mute| VM
    VM <-->|SDP Offer / Answer & ICE Candidates| VH
    TL <-->|Sync Activity History & Authorship Badges| AH
    TL -->|Enforce Viewer / Editor Status| RH

    style WebClient fill:#1e1e24,stroke:#4f46e5,stroke-width:2px,color:#fff
    style SocketServer fill:#18181b,stroke:#06b6d4,stroke-width:2px,color:#fff
    style SR fill:#27272a,stroke:#ef4444,stroke-width:1px,color:#fff
    style VM fill:#27272a,stroke:#3b82f6,stroke-width:1px,color:#fff
    style TL fill:#27272a,stroke:#10b981,stroke-width:1px,color:#fff
    style HVC fill:#27272a,stroke:#f59e0b,stroke-width:1px,color:#fff
    style AH fill:#3f3f46,stroke:#10b981,stroke-width:1px,color:#fff
    style VH fill:#3f3f46,stroke:#3b82f6,stroke-width:1px,color:#fff
    style RH fill:#3f3f46,stroke:#8b5cf6,stroke-width:1px,color:#fff
```

---

## 3. Project vs. Workspace vs. Room Hierarchy

In OwlSync, domain models are cleanly stratified based on lifecycle and purpose:

```mermaid
classDiagram
    class OrganizationTeam {
        +String id
        +String name
        +String slug
        +TeamRole role
        +List~TeamMember~ members
        +List~Project~ projects
    }

    class Project {
        +String id
        +String name
        +String description
        +List~ProjectFile~ files
        +Whiteboard whiteboard
        +Note note
        +List~Activity~ activities
    }

    class Room {
        +String id
        +String name
        +String password
        +RoomRole role
        +String projectId
        +List~RoomMember~ members
        +List~Message~ messages
    }

    OrganizationTeam "1" *-- "many" Project : owns
    Project "1" *-- "many" Room : scopes live sessions
```

- **Organization / Team**: Long-lived collaborative tenant owning shared repositories, teams, and members.
- **Project**: Persistent codebase containing file tree, whiteboard canvas, notes, and activity history.
- **Room**: Ephemeral or persistent live session where users co-edit code, speak via WebRTC, and execute scripts in real time.
