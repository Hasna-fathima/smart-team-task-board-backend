# Smart Team Task Board - 100% TypeScript MERN Solution

A full-stack, real-time Team Task Management & Sprint Tracking System built with **Next.js 14+ / React (TypeScript)**, **Node.js / Express.js (TypeScript)**, **MongoDB (Mongoose)**, **JWT Authentication**, and **Socket.io**.

---

## Technical Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                  Next.js 14 / React (App Router Client)                │
 │  • Real-time Kanban Swimlanes          • Real-time Audit Stream         │
 │  • Dynamic Analytics Dashboard         • Admin User Management Panel    │
 └───────────────────┬─────────────────────────────────┬───────────────────┘
                     │ REST API (HTTP)                 │ WebSockets (Socket.io)
                     ▼                                 ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                  Node.js / Express.js Backend Server                    │
 │  • JWT Middleware Security             • RBAC Permission Guards         │
 │  • Strict Sequential Workflow Engine   • Employee Max 8 Active Task Guard│
 │  • Workspace Deletion Guard            • Immutable Audit Activity Logs  │
 └───────────────────┬─────────────────────────────────────────────────────┘
                     │ Mongoose ODM
                     ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                        MongoDB Database Layer                           │
 │  • Users  • Workspaces  • Sprints  • Tasks  • ActivityLogs               │
 └─────────────────────────────────────────────────────────────────────────┘
```

---

## Server-Enforced Business Rules

1. **Strict Task Flow Progression**:
   - Stages: `Todo` → `In Progress` → `Review` → `Done`.
   - Skipping stages (e.g. `Todo` → `Done` or `In Progress` → `Done`) is **strictly rejected on the server** with an `HTTP 400 Bad Request`.
   - Tasks **must pass through Review** before moving to `Done`.
2. **Employee Active Task Limit (Max 8)**:
   - Active task statuses are `Todo`, `In Progress`, and `Review`.
   - Reassigning or creating a task for an employee who already has 8 active tasks triggers an `HTTP 400` server exception: *"Employee workload limit exceeded: Assigned user already has 8 active tasks (max 8 permitted)."*
3. **Workspace Protection Guard**:
   - Workspaces with **active sprints cannot be deleted**. Backend rejects deletion with `HTTP 400`.
4. **User Deletion Cleanup**:
   - When an Admin deletes a user, all tasks assigned to that user automatically become `Unassigned` (`assignedTo: null`) and an audit activity log entry is generated.
5. **Immutable Activity Audit Logs**:
   - Every creation, modification, status transition, assignment change, or deletion creates an `ActivityLog` document and broadcasts it live over Socket.io.

---

## User Roles & RBAC Matrix

| Role | Permissions |
| :--- | :--- |
| **Admin** | Manage all users (create/role update/delete), create & archive workspaces, delete workspaces (guarded), view all projects. |
| **Manager** | Create & manage sprints (`planned`, `active`, `completed`), create & assign tasks, manage task workflow, view dashboard. |
| **Employee** | View assigned tasks, update task status sequentially (`Todo` → `In Progress` → `Review` → `Done`), post comments, view activity history. |

---

## Quick Start & Installation

### Prerequisites
- Node.js (v18+)
- npm (v9+)
- MongoDB Atlas or local MongoDB instance

### 1. Backend Setup
```bash
cd backend
npm install
npm run seed     # Pre-populates database with test users, workspaces, sprints & tasks
npm run dev      # Starts Express server on http://localhost:5000
```

### 2. Frontend Setup
```bash
cd MERN-Assignment-frontend
npm install
npm run dev      # Starts Next.js client on http://localhost:3000
```

---

## Test Accounts (Pre-Seeded)

| Persona | Email | Password | Role |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@taskboard.com` | `admin123` | `admin` |
| **Manager** | `manager@taskboard.com` | `manager123` | `manager` |
| **Employee 1** | `employee1@taskboard.com` | `emp123` | `employee` |
| **Employee 2** | `employee2@taskboard.com` | `emp123` | `employee` |

*Note: Use the **Switch Persona** dropdown in the top navbar to instantly test role-based permissions!*

---

## Running Automated Backend Tests

To run the automated Jest integration test suite (verifying workflow enforcement, 8 active task limit, active sprint deletion guard, and user unassignment):

```bash
cd backend
npm test
```

---

## REST API Reference

### Auth (`/api/auth`)
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Authenticate user & receive JWT token
- `GET /api/auth/me` - Get current authenticated user profile

### Workspaces (`/api/workspaces`)
- `GET /api/workspaces` - List workspaces
- `POST /api/workspaces` - Create workspace (Admin/Manager)
- `PUT /api/workspaces/:id` - Edit/Archive workspace
- `DELETE /api/workspaces/:id` - Delete workspace (Admin only, checks active sprints)

### Sprints (`/api/sprints`)
- `GET /api/sprints` - List sprints
- `POST /api/sprints` - Create sprint (Admin/Manager)
- `PUT /api/sprints/:id` - Update sprint status (`planned`, `active`, `completed`)
- `DELETE /api/sprints/:id` - Delete sprint

### Tasks (`/api/tasks`)
- `GET /api/tasks` - List tasks (filterable by workspace, sprint, status, priority, assignee)
- `POST /api/tasks` - Create task (Admin/Manager, checks 8 active tasks limit)
- `PUT /api/tasks/:id` - Update task / transition status (Enforces sequential flow)
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/:id/comments` - Post comment on task

### Dashboard (`/api/dashboard`)
- `GET /api/dashboard` - Get aggregated metrics (Total, Completed, Overdue, Priority breakdown, Status breakdown, Employee workload capacity)

### Activity Logs (`/api/activity`)
- `GET /api/activity` - Query audit activity history

---

## Socket.io Real-Time Events

- `task:created` - Broadcast when a new task is created
- `task:updated` - Broadcast when a task status/detail changes
- `task:deleted` - Broadcast when a task is deleted
- `activity:created` - Broadcast when a new activity log entry is recorded
- `workspace:updated` - Broadcast when workspace settings or members change

---

## Docker Support (Bonus)

To run the entire application using Docker Compose:

```bash
docker-compose up --build
```
