import type { AdapterAccountType } from 'next-auth/adapters';
import { relations, sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  jsonb,
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
  emailVerified: timestamp('emailVerified'),
  image: text('image'),
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

export const mcpConnections = pgTable(
  'mcp_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    oauthIssuer: text('oauth_issuer').notNull(),
    oauthSubject: text('oauth_subject').notNull(),
    oauthClientId: text('oauth_client_id').notNull(),
    oauthGrantId: text('oauth_grant_id').notNull(),
    clientName: text('client_name').notNull().default('MCP client'),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at'),
    revokedAt: timestamp('revoked_at'),
  },
  table => [
    uniqueIndex('uq_mcp_connections_issuer_grant').on(
      table.oauthIssuer,
      table.oauthGrantId,
    ),
    index('idx_mcp_connections_user_id').on(table.userId),
  ],
);

export const mcpAuditEvents = pgTable(
  'mcp_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id').references(() => mcpConnections.id, {
      onDelete: 'set null',
    }),
    toolName: text('tool_name').notNull(),
    draftId: uuid('draft_id'),
    outcome: text('outcome').notNull(),
    correlationId: text('correlation_id').notNull(),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => [
    index('idx_mcp_audit_events_user_created').on(table.userId, table.createdAt),
    index('idx_mcp_audit_events_draft').on(table.draftId),
    index('idx_mcp_audit_events_connection').on(table.connectionId),
  ],
);

export const mcpRateLimits = pgTable(
  'mcp_rate_limits',
  {
    key: text('key').notNull(),
    windowStartedAt: timestamp('window_started_at').notNull(),
    count: integer('count').notNull().default(0),
    expiresAt: timestamp('expires_at').notNull(),
  },
  table => [
    primaryKey({ columns: [table.key, table.windowStartedAt] }),
    index('idx_mcp_rate_limits_expires_at').on(table.expiresAt),
  ],
);

export const aiActionDrafts = pgTable(
  'ai_action_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', {
      enum: [
        'pending',
        'executing',
        'rejected',
        'executed',
        'stale',
        'expired',
        'failed',
      ],
    })
      .notNull()
      .default('pending'),
    summary: text('summary').notNull(),
    reason: text('reason').notNull(),
    payload: jsonb('payload').notNull(),
    taskVersions: jsonb('task_versions').notNull(),
    reviewPayload: jsonb('review_payload').notNull(),
    failureCode: text('failure_code'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    source: text('source', { enum: ['chat', 'mcp'] }).notNull().default('chat'),
    sourceConnectionId: uuid('source_connection_id').references(
      () => mcpConnections.id,
      { onDelete: 'set null' },
    ),
    requestNamespace: text('request_namespace').notNull().default('chat'),
    requestHash: text('request_hash'),
    approvalCapabilityHash: text('approval_capability_hash'),
    approvalCapabilityExpiresAt: timestamp('approval_capability_expires_at'),
    approvalCapabilityConsumedAt: timestamp(
      'approval_capability_consumed_at',
    ),
    approvalChannel: text('approval_channel', {
      enum: ['web', 'mcp_app'],
    }),
    approvedAt: timestamp('approved_at'),
    terminalAt: timestamp('terminal_at'),
    executionReceipt: jsonb('execution_receipt'),
  },
  table => [
    // Namespaced idempotency (plan section 10): the sole uniqueness arbiter
    // after migration 0031 dropped the legacy (user_id, request_id) index.
    uniqueIndex('uq_ai_action_drafts_user_ns_request').on(
      table.userId,
      table.requestNamespace,
      table.requestId,
    ),
    index('idx_ai_action_drafts_user_id').on(table.userId),
    index('idx_ai_action_drafts_status').on(table.status),
    index('idx_ai_action_drafts_expires_at').on(table.expiresAt),
  ],
);

export const aiModelStats = pgTable(
  'ai_model_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    status: text('status', { enum: ['success', 'error'] }).notNull(),
    errorCode: text('error_code').notNull().default(''),
    count: integer('count').notNull().default(0),
    lastLatencyMs: integer('last_latency_ms'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => [
    uniqueIndex('uq_ai_model_stats_bucket').on(
      table.provider,
      table.model,
      table.status,
      table.errorCode,
    ),
    index('idx_ai_model_stats_provider_model').on(table.provider, table.model),
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
    totalMinutes: real('total_minutes').notNull().default(0),
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
  aiActionDrafts: many(aiActionDrafts),
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

export const aiActionDraftsRelations = relations(
  aiActionDrafts,
  ({ one }) => ({
    user: one(users, {
      fields: [aiActionDrafts.userId],
      references: [users.id],
    }),
  }),
);

// SQL function to delete courses and related data older than 8 months for all users
export const deleteOldCourses = sql`
  DELETE FROM courses 
  WHERE updated_at < NOW() - INTERVAL '8 months'
  RETURNING id;
`;
