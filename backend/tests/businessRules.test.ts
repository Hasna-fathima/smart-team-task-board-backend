import request from 'supertest';
import { app, server } from '../src/server';
import { connectDB, disconnectDB } from '../src/config/db';
import User from '../src/models/User';
import Workspace from '../src/models/Workspace';
import Sprint from '../src/models/Sprint';
import Task from '../src/models/Task';

describe('Backend Business Rules & API Enforcement (TypeScript)', () => {
  let adminToken: string, managerToken: string, empToken: string;
  let adminUser: any, managerUser: any, empUser: any;
  let workspace: any, activeSprint: any, task: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    await User.deleteMany({});
    await Workspace.deleteMany({});
    await Sprint.deleteMany({});
    await Task.deleteMany({});

    const adminRes = await request(app).post('/api/auth/register').send({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
    });
    adminToken = adminRes.body.token;
    adminUser = adminRes.body.user;

    const managerRes = await request(app).post('/api/auth/register').send({
      name: 'Test Manager',
      email: 'manager@test.com',
      password: 'password123',
      role: 'manager',
    });
    managerToken = managerRes.body.token;
    managerUser = managerRes.body.user;

    const empRes = await request(app).post('/api/auth/register').send({
      name: 'Test Employee',
      email: 'employee@test.com',
      password: 'password123',
      role: 'employee',
    });
    empToken = empRes.body.token;
    empUser = empRes.body.user;

    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Workspace', description: 'Testing workspace' });
    workspace = wsRes.body.workspace;

    const sprintRes = await request(app)
      .post('/api/sprints')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        workspace: workspace._id,
        name: 'Active Sprint 1',
        startDate: new Date(),
        endDate: new Date(Date.now() + 864000000),
        status: 'active',
      });
    activeSprint = sprintRes.body.sprint;
  });

  afterAll(async () => {
    await disconnectDB();
    if (server && server.close) {
      server.close();
    }
  });

  describe('Rule 1: Task Workflow Enforcement (Todo -> In Progress -> Review -> Done)', () => {
    it('should create a task in Todo status', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Workflow Test Task',
          workspace: workspace._id,
          sprint: activeSprint._id,
          status: 'todo',
          dueDate: new Date(Date.now() + 86400000),
          assignedTo: empUser._id,
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.task.status).toEqual('todo');
      task = res.body.task;
    });

    it('should REJECT skipping stages: Todo -> Done (HTTP 400)', async () => {
      const res = await request(app)
        .put(`/api/tasks/${task._id}`)
        .set('Authorization', `Bearer ${empToken}`)
        .send({ status: 'done' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('Invalid task status transition');
    });

    it('should ACCEPT valid transition: Todo -> In Progress', async () => {
      const res = await request(app)
        .put(`/api/tasks/${task._id}`)
        .set('Authorization', `Bearer ${empToken}`)
        .send({ status: 'in_progress' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.task.status).toEqual('in_progress');
    });

    it('should REJECT jumping from In Progress directly to Done', async () => {
      const res = await request(app)
        .put(`/api/tasks/${task._id}`)
        .set('Authorization', `Bearer ${empToken}`)
        .send({ status: 'done' });

      expect(res.statusCode).toEqual(400);
    });

    it('should ACCEPT transition: In Progress -> Review -> Done', async () => {
      const res1 = await request(app)
        .put(`/api/tasks/${task._id}`)
        .set('Authorization', `Bearer ${empToken}`)
        .send({ status: 'review' });
      expect(res1.statusCode).toEqual(200);

      const res2 = await request(app)
        .put(`/api/tasks/${task._id}`)
        .set('Authorization', `Bearer ${empToken}`)
        .send({ status: 'done' });
      expect(res2.statusCode).toEqual(200);
      expect(res2.body.task.status).toEqual('done');
    });
  });

  describe('Rule 2: Employee Max 8 Active Tasks Limit', () => {
    it('should REJECT creating 9th active task for the same employee', async () => {
      for (let i = 0; i < 8; i++) {
        await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            title: `Task Limit Test ${i}`,
            workspace: workspace._id,
            status: 'todo',
            dueDate: new Date(Date.now() + 86400000),
            assignedTo: empUser._id,
          });
      }

      const ninthRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: `Ninth Task (Should Fail)`,
          workspace: workspace._id,
          status: 'todo',
          dueDate: new Date(Date.now() + 86400000),
          assignedTo: empUser._id,
        });

      expect(ninthRes.statusCode).toEqual(400);
      expect(ninthRes.body.message).toContain('workload limit exceeded');
    });
  });

  describe('Rule 3: Workspaces with active sprints cannot be deleted', () => {
    it('should REJECT deletion of workspace with active sprint', async () => {
      const res = await request(app)
        .delete(`/api/workspaces/${workspace._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('active sprint');
    });
  });

  describe("Rule 4: Deleted users' tasks become Unassigned", () => {
    it('should unassign tasks when user is deleted', async () => {
      const deleteRes = await request(app)
        .delete(`/api/users/${empUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.statusCode).toEqual(200);
      expect(deleteRes.body.unassignedTasksCount).toBeGreaterThan(0);

      const unassignedTasks = await Task.find({ assignedTo: empUser._id });
      expect(unassignedTasks.length).toEqual(0);
    });
  });
});
