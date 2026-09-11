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
flowchart TB
    subgraph WebClient ["OwlSync Web Client"]
        SR["SessionRecorder Service (Export WebM / Preview)"]
        HVC["Header Voice & Rec Controls"]
        VM["VoiceManager & WebRTC Mesh"]
        TL["Timeline & Code Authorship"]
    end

    subgraph SocketServer ["OwlSync Socket.IO Server"]
        AH["activity.handlers.js (Activity & Authorship Broadcast)"]
        VH["voice.handlers.js (Signaling: offer / answer / ICE)"]
        RH["room.handlers.js (Permission Drop-Guards)"]
    end

    HVC -->|Trigger Rec Start/Stop| SR
    HVC -->|Toggle Mic / Mute| VM
    VM <-->|SDP Offer / Answer & ICE Candidates| VH
    TL <-->|Sync Activity History & Authorship Badges| AH
    TL -->|Enforce Viewer / Editor Status| RH
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
