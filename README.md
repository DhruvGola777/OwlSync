# OwlSync 🦉

A collaborative development platform where developers can code, communicate, and build together in real time.

## 🌟 Project Vision

Think of OwlSync as combining the best collaborative aspects of Discord, VS Code Live Share, Google Meet, and Replit into a single platform. Instead of trying to replace all of them, the goal is to combine their collaborative strengths into one unified workspace.

## 🎯 Why This Project Exists

Most portfolio projects are either simple CRUD apps or coding interview platforms. OwlSync is built to feel like an actual product developers could use. It's designed to solve real engineering problems involving synchronization, background workers, scalable real-time systems, and complex database structures.

## 🚀 Features (Phase 1 MVP)

- Authentication (Register/Login)
- Interactive Dashboard
- Project Management
- Interactive UI with Tailwind CSS

## 🏗 Architecture

OwlSync uses a **Modular Monolith** architecture:
- **Frontend**: React + Vite + Tailwind CSS
- **API Server**: Express (REST API)
- **Socket Server**: Socket.IO (Real-time events)
- **Workers**: RabbitMQ consumers for background tasks
- **Database**: PostgreSQL (via Prisma)
- **Cache & Pub/Sub**: Redis

## 💻 Tech Stack

- **JavaScript (Node.js)**
- React & Vite
- Express
- Socket.IO
- Prisma ORM
- PostgreSQL & Redis
- Docker & Docker Compose
- Turborepo & npm workspaces

## 📂 System Design: Project vs. Workspace

- **Workspace**: The collaborative environment (members, chat, voice, whiteboard, permissions).
- **Project**: The codebase (files, Git, Docker container, deployments).
- **Room**: A live collaboration session inside a workspace, where people edit, talk, and share screens.

## 🗺 Development Roadmap

1. **Phase 1 (MVP)**: Foundation, Auth, UI setup.
2. **Phase 2**: Real-time Socket Server integration & Workspaces.
3. **Phase 3**: File Explorer and Editor synchronization.
4. **Phase 4**: Background Workers (RabbitMQ) & Execution Environments.
5. **Phase 5**: Video/Voice and AI Pair Programmer.

## 🛠 Local Setup

```bash
# 1. Start databases
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Setup database
npm run generate -w @owlsync/database
npm run migrate:dev -w @owlsync/database

# 4. Start all apps
npm run dev
```
