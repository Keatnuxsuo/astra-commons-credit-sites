import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const rewards = sqliteTable('reward_pairs', { id: integer('id').primaryKey(), apiCode: text('api_code').notNull().unique(), codexUrl: text('codex_url').notNull().unique(), issuedAt: text('issued_at') });
export const guests = sqliteTable('guests', { id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(), matchName: text('match_name').notNull(), pairId: integer('pair_id').notNull().unique().references(()=>rewards.id) });
export const settings = sqliteTable('settings', { key: text('key').primaryKey(), value: text('value').notNull() });
export const sessions = sqliteTable('sessions', { tokenHash: text('token_hash').primaryKey(), guestId: text('guest_id').notNull().references(()=>guests.id), expiresAt: integer('expires_at').notNull() });
export const attempts = sqliteTable('attempts', { key: text('key').primaryKey(), count: integer('count').notNull(), expiresAt: integer('expires_at').notNull() });
