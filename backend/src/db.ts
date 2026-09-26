import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'kafka.db');

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USUARIO' CHECK (role IN ('ADMIN','GESTOR','USUARIO')),
    manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    cor TEXT NOT NULL DEFAULT '#6366f1',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, nome)
  );
  CREATE TABLE IF NOT EXISTS origens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(area_id, nome)
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','EM_ANDAMENTO','CONCLUIDA')),
    prioridade TEXT NOT NULL DEFAULT 'MEDIA' CHECK (prioridade IN ('BAIXA','MEDIA','ALTA','URGENTE')),
    data_inicio TEXT,
    data_prazo TEXT,
    data_conclusao TEXT,
    area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task_origens (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    origem_id INTEGER NOT NULL REFERENCES origens(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, origem_id)
  );
  CREATE TABLE IF NOT EXISTS tramitacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS password_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    login TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','APROVADO','REJEITADO')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    handled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    handled_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_prazo ON tasks(data_prazo);
  CREATE INDEX IF NOT EXISTS idx_tram_task ON tramitacoes(task_id);
  `);

  // Settings padrão
  const defaults: Record<string, string> = {
    site_name: 'Kafka — Sistema de Gestão de Processos',
    site_subtitle: 'To-Do List + Calendário + Tramitações',
    site_logo: '',
    site_header_mode: 'logo-name-subtitle'
  };
  const ins = db.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) ins.run(k, v);
}

export function seedAdmin() {
  const row = db.prepare('SELECT id FROM users WHERE login = ?').get('admin') as any;
  if (!row) {
    const hash = bcrypt.hashSync('123456', 10);
    db.prepare(
      `INSERT INTO users(name, login, password_hash, role, active) VALUES (?, ?, ?, 'ADMIN', 1)`
    ).run('Administrador', 'admin', hash);
    console.log('[seed] admin / 123456 criado');
  }
}

export type Role = 'ADMIN' | 'GESTOR' | 'USUARIO';

export interface UserRow {
  id: number;
  name: string;
  login: string;
  password_hash: string;
  role: Role;
  manager_id: number | null;
  active: number;
  created_at: string;
}

export function publicUser(u: UserRow) {
  return { id: u.id, name: u.name, login: u.login, role: u.role, manager_id: u.manager_id, active: !!u.active, created_at: u.created_at };
}

/** IDs visíveis para o usuário logado (escopo RBAC). null = todos (ADMIN). */
export function visibleUserIds(me: { id: number; role: Role }): number[] | null {
  if (me.role === 'ADMIN') return null;
  if (me.role === 'GESTOR') {
    const rows = db.prepare('SELECT id FROM users WHERE id = ? OR manager_id = ?').all(me.id, me.id) as { id: number }[];
    return rows.map(r => r.id);
  }
  return [me.id];
}

/** Carrega tarefa com área + origens + contagem de tramitações. */
export function getTaskFull(taskId: number) {
  const task = db.prepare(`
    SELECT t.*, a.nome AS area_nome, a.cor AS area_cor, u.name AS owner_name, u.login AS owner_login
    FROM tasks t
    LEFT JOIN areas a ON a.id = t.area_id
    JOIN users u ON u.id = t.user_id
    WHERE t.id = ?
  `).get(taskId) as any;
  if (!task) return null;
  const origens = db.prepare(`
    SELECT o.id, o.nome, o.area_id FROM task_origens to2
    JOIN origens o ON o.id = to2.origem_id WHERE to2.task_id = ?
  `).all(taskId);
  return { ...task, origens };
}
