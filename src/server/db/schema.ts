import type { AdapterAccountType } from 'next-auth/adapters';
import { relations, sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// NextAuth.js user and authentication tables
export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  image: text('image'),
  streakDays: integer('streak_days').notNull().default(0),
  lastCompletedPomodoroDate: timestamp('last_completed_pomodoro_date', {
    mode: 'date',
  }),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  account => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const terms = pgTable('terms', {
  id: text('id').primaryKey(), // '20253'
  label: text('label'), // 'Automne 2025'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  term: text('term')
    .notNull()
    .references(() => terms.id, { onDelete: 'restrict' }),
  color: text('color', {
    enum: ['blue', 'green', 'red', 'yellow', 'purple', 'orange', 'gray'],
  }).notNull(),
  daypart: text('daypart', { enum: ['EVEN', 'AM', 'PM'] })
    .notNull()
    .default('AM'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => [
  uniqueIndex('uq_courses_user_code_term').on(table.userId, table.code, table.term),
]);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .references(() => courses.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    notes: text('notes'),
    type: text('type', {
      enum: ['theorie', 'pratique', 'exam', 'homework', 'lab'],
    })
      .notNull()
      .default('theorie'),
    status: text('status', { enum: ['IN_PROGRESS', 'TODO', 'COMPLETED'] })
      .default('TODO')
      .notNull(),
    estimatedEffort: real('estimated_effort').notNull().default(1),
    actualEffort: real('actual_effort').notNull().default(0),
    dueDate: timestamp('due_date').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => [
    index('idx_tasks_user_due_date').on(table.userId, table.dueDate),
    index('idx_tasks_user_id').on(table.userId),
    index('idx_tasks_course_id').on(table.courseId),
    index('idx_tasks_user_course').on(table.userId, table.courseId),
    index('idx_tasks_status').on(table.status),
  ],
);

export const subtasks = pgTable(
  'subtasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => [
    index('idx_subtasks_task_id').on(table.taskId),
  ],
);

export const pomodoroDaily = pgTable(
  'pomodoro_daily',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'date' }).notNull(),
    totalMinutes: integer('total_minutes').notNull().default(0),
    taskIds: uuid('task_ids')
      .array()
      .notNull()
      .default(sql`ARRAY[]::uuid[]`),
  },
  t => [uniqueIndex('pomodoro_daily_user_day_uq').on(t.userId, t.day)],
);

export const customLinks = pgTable(
  'custom_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    type: text('type').notNull().default('custom'),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').references(() => courses.id, {
      onDelete: 'cascade',
    }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => [
    index('idx_custom_links_user_course').on(table.userId, table.courseId),
    index('idx_custom_links_user_id').on(table.userId),
    index('idx_custom_links_course_id').on(table.courseId),
  ],
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  courses: many(courses),
  tasks: many(tasks),
  customLinks: many(customLinks),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  user: one(users, { fields: [courses.userId], references: [users.id] }),
  tasks: many(tasks),
  customLinks: many(customLinks),
}));

export const customLinksRelations = relations(customLinks, ({ one }) => ({
  user: one(users, { fields: [customLinks.userId], references: [users.id] }),
  course: one(courses, {
    fields: [customLinks.courseId],
    references: [courses.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  course: one(courses, {
    fields: [tasks.courseId],
    references: [courses.id],
  }),
  subtasks: many(subtasks),
}));

export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, { fields: [subtasks.taskId], references: [tasks.id] }),
}));

// SQL function to delete courses and related data older than 8 months for all users
export const deleteOldCourses = sql`
  DELETE FROM courses 
  WHERE updated_at < NOW() - INTERVAL '8 months'
  RETURNING id;
`;
