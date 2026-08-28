import User from '../models/User';
import Workspace from '../models/Workspace';
import Sprint from '../models/Sprint';
import Task from '../models/Task';
import ActivityLog from '../models/ActivityLog';

export const autoSeed = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return;
    }

    console.log('[Auto-Seeder]: No users detected in database. Starting auto-seed...');

    const admin = await User.create({
      name: 'System Admin',
      email: 'admin@taskboard.com',
      password: 'admin123',
      role: 'admin',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
    });

    const manager = await User.create({
      name: 'Sarah Jenkins (Manager)',
      email: 'manager@taskboard.com',
      password: 'manager123',
      role: 'manager',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
    });

    const emp1 = await User.create({
      name: 'Alex Rivera (Dev)',
      email: 'employee1@taskboard.com',
      password: 'emp123',
      role: 'employee',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
    });

    const emp2 = await User.create({
      name: 'Emily Chen (Frontend)',
      email: 'employee2@taskboard.com',
      password: 'emp123',
      role: 'employee',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80',
    });

    console.log('[Auto-Seeder]: Created 4 users (Admin, Manager, Employee 1, Employee 2)');

    const workspace = await Workspace.create({
      name: 'Engineering & Product Hub',
      description: 'Core product development workspace for the Smart Task Board team.',
      owner: admin._id,
      members: [admin._id, manager._id, emp1._id, emp2._id],
    });

    console.log('[Auto-Seeder]: Created workspace: Engineering & Product Hub');

    const today = new Date();
    const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

    const sprint = await Sprint.create({
      workspace: workspace._id,
      name: 'Sprint 26 - Real-time Core & Authorization',
      goal: 'Complete workflow enforcement, Socket.io integration, and dashboard analytics.',
      startDate: today,
      endDate: twoWeeksLater,
      status: 'active',
      createdBy: manager._id,
    });

    console.log('[Auto-Seeder]: Created active sprint');

    const tasksData = [
      {
        title: 'Design Database Schema for Workspaces & Sprints',
        description: 'Ensure Mongoose schemas adhere to relations and index optimization.',
        workspace: workspace._id,
        sprint: sprint._id,
        status: 'done',
        priority: 'high',
        dueDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        assignedTo: emp1._id,
        createdBy: manager._id,
        labels: ['Backend', 'Database'],
      },
      {
        title: 'Implement JWT Auth & RBAC Middleware',
        description: 'Enforce strict backend authorization for Admin, Manager, and Employee roles.',
        workspace: workspace._id,
        sprint: sprint._id,
        status: 'review',
        priority: 'urgent',
        dueDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
        assignedTo: emp1._id,
        createdBy: manager._id,
        labels: ['Security', 'Backend'],
      },
      {
        title: 'Build Kanban Board with Motion Animations',
        description: 'Render Kanban columns with step-by-step workflow restrictions.',
        workspace: workspace._id,
        sprint: sprint._id,
        status: 'in_progress',
        priority: 'high',
        dueDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        assignedTo: emp2._id,
        createdBy: manager._id,
        labels: ['Frontend', 'UI/UX'],
      },
      {
        title: 'Integrate Socket.io Real-Time Synchronization',
        description: 'Emit events for task updates, status changes, and activity logs.',
        workspace: workspace._id,
        sprint: sprint._id,
        status: 'todo',
        priority: 'medium',
        dueDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
        assignedTo: emp2._id,
        createdBy: manager._id,
        labels: ['WebSockets', 'Realtime'],
      },
      {
        title: 'Audit Log & Activity Stream Backend Integration',
        description: 'Log every task state transition and user action automatically.',
        workspace: workspace._id,
        sprint: sprint._id,
        status: 'todo',
        priority: 'low',
        dueDate: new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000),
        assignedTo: emp1._id,
        createdBy: manager._id,
        labels: ['Audit', 'Logging'],
      },
      {
        title: 'Resolve Overdue Task Calculation & Alert Widget',
        description: 'Calculate overdue tasks server-side and render in dashboard charts.',
        workspace: workspace._id,
        sprint: sprint._id,
        status: 'todo',
        priority: 'urgent',
        dueDate: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
        assignedTo: emp1._id,
        createdBy: manager._id,
        labels: ['Dashboard', 'Bugfix'],
      },
    ];

    const insertedTasks = await Task.insertMany(tasksData);
    console.log(`[Auto-Seeder]: Created ${insertedTasks.length} tasks`);

    await ActivityLog.create([
      {
        user: manager._id,
        action: 'sprint_created',
        entityType: 'sprint',
        entityId: sprint._id,
        entityTitle: sprint.name,
        workspace: workspace._id,
        details: { status: 'active' },
      },
      {
        user: emp1._id,
        action: 'task_status_changed',
        entityType: 'task',
        entityId: insertedTasks[0]._id,
        entityTitle: insertedTasks[0].title,
        workspace: workspace._id,
        details: { from: 'review', to: 'done' },
      },
      {
        user: manager._id,
        action: 'task_created',
        entityType: 'task',
        entityId: insertedTasks[1]._id,
        entityTitle: insertedTasks[1].title,
        workspace: workspace._id,
        details: { priority: 'urgent', assignedTo: emp1.name },
      },
    ]);

    console.log('[Auto-Seeder]: Database seeded successfully!');
    console.log('====================================================');
  } catch (error) {
    console.error('[Auto-Seeder Error]: Failed to auto-seed database:', error);
  }
};
