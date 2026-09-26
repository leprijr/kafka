import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

import { db, migrate, seedAdmin, publicUser, getTaskFull, Role } from './db';
import { authenticate, requireAdmin, canAccessUser, scopeWhere, signToken, AuthRequest } from './auth';

migrate();
seedAdmin();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const today = () => new Date().toISOString().slice(0, 10);

/* ============ AUTH ============ */

app.post('/api/auth/login', (req, res) => {
  const { login, password } = req.body || {};
  if (!login || !password) return res.status(400).json({ error: 'Informe login e senha' });
  const u = db.prepare('SELECT * FROM users WHERE login = ?').get(String(login).trim()) as any;
  if (!u || !u.active) return res.status(401).json({ error: 'Credenciais inválidas' });
  if (!bcrypt.compareSync(String(password), u.password_hash)) return res.status(401).json({ error: 'Credenciais inválidas' });
  const token = signToken({ id: u.id, name: u.name, login: u.login, role: u.role });
  return res.json({ token, user: publicUser(u) });
});

app.get('/api/auth/me', authenticate, (req: AuthRequest, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  return res.json({ user: publicUser(u) });
});

app.put('/api/auth/profile', authenticate, (req: AuthRequest, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(name).trim(), req.user!.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  return res.json({ user: publicUser(u) });
});

app.put('/api/auth/password', authenticate, (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 4) return res.status(400).json({ error: 'Nova senha deve ter ao menos 4 caracteres' });
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!bcrypt.compareSync(String(currentPassword || ''), u.password_hash)) return res.status(400).json({ error: 'Senha atual incorreta' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(newPassword), 10), req.user!.id);
  return res.json({ ok: true });
});

/* ============ USERS (ADMIN cria/exclui/atribui; GESTOR lista gerenciados) ============ */

app.get('/api/users', authenticate, (req: AuthRequest, res) => {
  const me = req.user!;
  if (me.role === 'ADMIN') {
    const rows = db.prepare('SELECT * FROM users ORDER BY name').all() as any[];
    return res.json({ users: rows.map(publicUser) });
  }
  if (me.role === 'GESTOR') {
    const rows = db.prepare('SELECT * FROM users WHERE id = ? OR manager_id = ? ORDER BY name').all(me.id, me.id) as any[];
    return res.json({ users: rows.map(publicUser) });
  }
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(me.id) as any;
  return res.json({ users: [publicUser(u)] });
});

// Só ADMIN cria usuários e define role/manager
app.post('/api/users', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const { name, login, password, role, manager_id } = req.body || {};
  if (!name || !login || !password) return res.status(400).json({ error: 'name, login e password são obrigatórios' });
  const r: Role = ['ADMIN', 'GESTOR', 'USUARIO'].includes(role) ? role : 'USUARIO';
  try {
    const info = db.prepare(
      `INSERT INTO users(name, login, password_hash, role, manager_id, active) VALUES (?, ?, ?, ?, ?, 1)`
    ).run(String(name).trim(), String(login).trim(), bcrypt.hashSync(String(password), 10), r, manager_id || null);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as any;
    return res.status(201).json({ user: publicUser(u) });
  } catch (e: any) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Login já existe' });
    throw e;
  }
});

app.put('/api/users/:id', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const { name, role, manager_id, active, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!u) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (role && !['ADMIN', 'GESTOR', 'USUARIO'].includes(role)) return res.status(400).json({ error: 'Role inválida' });
  db.prepare('UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role), manager_id = ?, active = COALESCE(?, active) WHERE id = ?')
    .run(name ?? null, role ?? null, manager_id === undefined ? u.manager_id : manager_id || null, active === undefined ? u.active : active ? 1 : 0, id);
  if (password) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(password), 10), id);
  const upd = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  return res.json({ user: publicUser(upd) });
});

app.delete('/api/users/:id', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) return res.status(400).json({ error: 'Você não pode excluir a si mesmo' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return res.json({ ok: true });
});

/* ============ ÁREAS (cada usuário configura as suas) ============ */

app.get('/api/areas', authenticate, (req: AuthRequest, res) => {
  const rows = db.prepare('SELECT * FROM areas WHERE user_id = ? ORDER BY nome').all(req.user!.id);
  return res.json({ areas: rows });
});

app.post('/api/areas', authenticate, (req: AuthRequest, res) => {
  const { nome, cor } = req.body || {};
  if (!nome?.trim()) return res.status(400).json({ error: 'Nome da área obrigatório' });
  try {
    const info = db.prepare('INSERT INTO areas(user_id, nome, cor) VALUES (?, ?, ?)').run(req.user!.id, nome.trim(), cor || '#6366f1');
    return res.status(201).json({ area: db.prepare('SELECT * FROM areas WHERE id = ?').get(info.lastInsertRowid) });
  } catch (e: any) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Você já tem uma área com esse nome' });
    throw e;
  }
});

app.put('/api/areas/:id', authenticate, (req: AuthRequest, res) => {
  const a = db.prepare('SELECT * FROM areas WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id) as any;
  if (!a) return res.status(404).json({ error: 'Área não encontrada' });
  const { nome, cor } = req.body || {};
  db.prepare('UPDATE areas SET nome = COALESCE(?, nome), cor = COALESCE(?, cor) WHERE id = ?').run(nome ?? null, cor ?? null, a.id);
  return res.json({ area: db.prepare('SELECT * FROM areas WHERE id = ?').get(a.id) });
});

app.delete('/api/areas/:id', authenticate, (req: AuthRequest, res) => {
  db.prepare('DELETE FROM origens WHERE area_id IN (SELECT id FROM areas WHERE id = ? AND user_id = ?)').run(req.params.id, req.user!.id);
  db.prepare('DELETE FROM areas WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  return res.json({ ok: true });
});

/* ============ ORIGENS (atreladas a uma área, do próprio usuário) ============ */

app.get('/api/origens', authenticate, (req: AuthRequest, res) => {
  const { areaId } = req.query as any;
  const rows = areaId
    ? db.prepare('SELECT o.*, a.nome AS area_nome FROM origens o JOIN areas a ON a.id = o.area_id WHERE o.user_id = ? AND o.area_id = ? ORDER BY o.nome').all(req.user!.id, areaId)
    : db.prepare('SELECT o.*, a.nome AS area_nome FROM origens o JOIN areas a ON a.id = o.area_id WHERE o.user_id = ? ORDER BY a.nome, o.nome').all(req.user!.id);
  return res.json({ origens: rows });
});

app.post('/api/origens', authenticate, (req: AuthRequest, res) => {
  const { nome, area_id } = req.body || {};
  if (!nome?.trim() || !area_id) return res.status(400).json({ error: 'nome e area_id obrigatórios' });
  const area = db.prepare('SELECT * FROM areas WHERE id = ? AND user_id = ?').get(area_id, req.user!.id) as any;
  if (!area) return res.status(400).json({ error: 'Área inválida' });
  try {
    const info = db.prepare('INSERT INTO origens(user_id, area_id, nome) VALUES (?, ?, ?)').run(req.user!.id, area_id, nome.trim());
    return res.status(201).json({ origem: db.prepare('SELECT * FROM origens WHERE id = ?').get(info.lastInsertRowid) });
  } catch (e: any) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Origem já existe nesta área' });
    throw e;
  }
});

app.put('/api/origens/:id', authenticate, (req: AuthRequest, res) => {
  const o = db.prepare('SELECT * FROM origens WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id) as any;
  if (!o) return res.status(404).json({ error: 'Origem não encontrada' });
  db.prepare('UPDATE origens SET nome = COALESCE(?, nome) WHERE id = ?').run(req.body?.nome ?? null, o.id);
  return res.json({ origem: db.prepare('SELECT * FROM origens WHERE id = ?').get(o.id) });
});

app.delete('/api/origens/:id', authenticate, (req: AuthRequest, res) => {
  db.prepare('DELETE FROM task_origens WHERE origem_id IN (SELECT id FROM origens WHERE id = ? AND user_id = ?)').run(req.params.id, req.user!.id);
  db.prepare('DELETE FROM origens WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  return res.json({ ok: true });
});

/* ============ TAREFAS (CRUD com escopo RBAC) ============ */

function taskFilters(req: AuthRequest) {
  const me = req.user!;
  const { status, areaId, origemId, q, from, to, userId } = req.query as any;
  const where: string[] = [];
  const params: any[] = [];

  // Escopo: userId explícito (ADMIN/GESTOR) ou escopo padrão da role
  if (userId) {
    const target = Number(userId);
    if (!canAccessUser(me, target)) return { error: 'Sem permissão para este usuário' as const };
    where.push('t.user_id = ?'); params.push(target);
  } else {
    const s = scopeWhere(me, 't.user_id');
    where.push(s.clause); params.push(...s.params);
  }
  if (status) { where.push('t.status = ?'); params.push(status); }
  if (areaId) { where.push('t.area_id = ?'); params.push(Number(areaId)); }
  if (from) { where.push('t.data_prazo >= ?'); params.push(from); }
  if (to) { where.push('t.data_prazo <= ?'); params.push(to); }
  if (q) { where.push('(t.titulo LIKE ? OR t.descricao LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (origemId) { where.push('EXISTS (SELECT 1 FROM task_origens to2 WHERE to2.task_id = t.id AND to2.origem_id = ?)'); params.push(Number(origemId)); }
  return { where: where.join(' AND '), params };
}

app.get('/api/tasks', authenticate, (req: AuthRequest, res) => {
  const f = taskFilters(req);
  if ('error' in f) return res.status(403).json({ error: f.error });
  const rows = db.prepare(`
    SELECT t.*, a.nome AS area_nome, a.cor AS area_cor, u.name AS owner_name, u.login AS owner_login,
      (SELECT COUNT(*) FROM tramitacoes tr WHERE tr.task_id = t.id) AS tramitacoes_count
    FROM tasks t LEFT JOIN areas a ON a.id = t.area_id JOIN users u ON u.id = t.user_id
    WHERE ${f.where} ORDER BY COALESCE(t.data_prazo, '9999-12-31') ASC, t.id DESC LIMIT 500
  `).all(...f.params) as any[];
  const withOrigens = rows.map(t => ({
    ...t,
    origens: db.prepare(`SELECT o.id, o.nome FROM task_origens to2 JOIN origens o ON o.id = to2.origem_id WHERE to2.task_id = ?`).all(t.id)
  }));
  return res.json({ tasks: withOrigens });
});

app.post('/api/tasks', authenticate, (req: AuthRequest, res) => {
  const me = req.user!;
  const { titulo, descricao, status, prioridade, data_inicio, data_prazo, area_id, origem_ids, user_id } = req.body || {};
  if (!titulo?.trim()) return res.status(400).json({ error: 'Título obrigatório' });

  // Dono: por padrão o próprio; ADMIN/GESTOR podem criar para gerenciado (respeitando escopo)
  let ownerId = me.id;
  if (user_id && Number(user_id) !== me.id) {
    if (!canAccessUser(me, Number(user_id))) return res.status(403).json({ error: 'Sem permissão para criar tarefa deste usuário' });
    ownerId = Number(user_id);
  }
  // Área/origens pertencem ao DONO da tarefa (cada usuário configura as suas)
  if (area_id) {
    const a = db.prepare('SELECT id FROM areas WHERE id = ? AND user_id = ?').get(area_id, ownerId) as any;
    if (!a) return res.status(400).json({ error: 'Área inválida para este usuário' });
  }
  const info = db.prepare(`
    INSERT INTO tasks(user_id, titulo, descricao, status, prioridade, data_inicio, data_prazo, area_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ownerId, titulo.trim(), descricao || '', status || 'PENDENTE', prioridade || 'MEDIA', data_inicio || null, data_prazo || null, area_id || null);
  const taskId = Number(info.lastInsertRowid);

  // Várias origens na mesma tarefa (todas da mesma área/dono — validadas)
  const ids: number[] = Array.isArray(origem_ids) ? origem_ids.map(Number) : [];
  for (const oid of ids) {
    const o = db.prepare('SELECT * FROM origens WHERE id = ? AND user_id = ?').get(oid, ownerId) as any;
    if (!o) return res.status(400).json({ error: `Origem ${oid} inválida` });
    if (area_id && o.area_id !== Number(area_id)) return res.status(400).json({ error: `Origem "${o.nome}" não pertence à área selecionada` });
    db.prepare('INSERT OR IGNORE INTO task_origens(task_id, origem_id) VALUES (?, ?)').run(taskId, oid);
  }
  db.prepare(`INSERT INTO tramitacoes(task_id, user_id, texto) VALUES (?, ?, ?)`).run(taskId, me.id, 'Tarefa criada.');
  return res.status(201).json({ task: getTaskFull(taskId) });
});

app.put('/api/tasks/:id', authenticate, (req: AuthRequest, res) => {
  const me = req.user!;
  const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
  if (!t) return res.status(404).json({ error: 'Tarefa não encontrada' });
  if (!canAccessUser(me, t.user_id)) return res.status(403).json({ error: 'Sem permissão' });
  const { titulo, descricao, status, prioridade, data_inicio, data_prazo, data_conclusao, area_id, origem_ids } = req.body || {};
  let conclusao = data_conclusao !== undefined ? data_conclusao || null : t.data_conclusao;
  const newStatus = status || t.status;
  if (newStatus === 'CONCLUIDA' && !conclusao) conclusao = today();
  if (newStatus !== 'CONCLUIDA' && t.status === 'CONCLUIDA' && status && status !== 'CONCLUIDA') conclusao = null;
  db.prepare(`
    UPDATE tasks SET titulo = COALESCE(?, titulo), descricao = COALESCE(?, descricao), status = COALESCE(?, status),
      prioridade = COALESCE(?, prioridade), data_inicio = ?, data_prazo = ?, data_conclusao = ?, area_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(titulo ?? null, descricao ?? null, status ?? null, prioridade ?? null,
    data_inicio !== undefined ? data_inicio || null : t.data_inicio,
    data_prazo !== undefined ? data_prazo || null : t.data_prazo,
    conclusao, area_id !== undefined ? area_id || null : t.area_id, t.id);
  if (Array.isArray(origem_ids)) {
    db.prepare('DELETE FROM task_origens WHERE task_id = ?').run(t.id);
    const cur = db.prepare('SELECT * FROM tasks WHERE id = ?').get(t.id) as any;
    for (const oid of origem_ids.map(Number)) {
      const o = db.prepare('SELECT * FROM origens WHERE id = ? AND user_id = ?').get(oid, cur.user_id) as any;
      if (!o) return res.status(400).json({ error: `Origem ${oid} inválida` });
      if (cur.area_id && o.area_id !== cur.area_id) return res.status(400).json({ error: `Origem "${o.nome}" não pertence à área da tarefa` });
      db.prepare('INSERT OR IGNORE INTO task_origens(task_id, origem_id) VALUES (?, ?)').run(t.id, oid);
    }
  }
  return res.json({ task: getTaskFull(t.id) });
});

app.delete('/api/tasks/:id', authenticate, (req: AuthRequest, res) => {
  const me = req.user!;
  const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
  if (!t) return res.status(404).json({ error: 'Tarefa não encontrada' });
  if (!canAccessUser(me, t.user_id)) return res.status(403).json({ error: 'Sem permissão' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(t.id);
  return res.json({ ok: true });
});

/* ============ TRAMITAÇÕES ============ */

app.get('/api/tasks/:id/tramitacoes', authenticate, (req: AuthRequest, res) => {
  const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
  if (!t) return res.status(404).json({ error: 'Tarefa não encontrada' });
  if (!canAccessUser(req.user!, t.user_id)) return res.status(403).json({ error: 'Sem permissão' });
  const rows = db.prepare(`
    SELECT tr.*, u.name AS author_name FROM tramitacoes tr JOIN users u ON u.id = tr.user_id
    WHERE tr.task_id = ? ORDER BY tr.id ASC
  `).all(t.id);
  return res.json({ tramitacoes: rows });
});

app.post('/api/tasks/:id/tramitacoes', authenticate, (req: AuthRequest, res) => {
  const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
  if (!t) return res.status(404).json({ error: 'Tarefa não encontrada' });
  if (!canAccessUser(req.user!, t.user_id)) return res.status(403).json({ error: 'Sem permissão' });
  const { texto } = req.body || {};
  if (!texto?.trim()) return res.status(400).json({ error: 'Texto obrigatório' });
  const info = db.prepare('INSERT INTO tramitacoes(task_id, user_id, texto) VALUES (?, ?, ?)').run(t.id, req.user!.id, texto.trim());
  db.prepare(`UPDATE tasks SET updated_at = datetime('now') WHERE id = ?`).run(t.id);
  return res.status(201).json({ tramitacao: db.prepare('SELECT * FROM tramitacoes WHERE id = ?').get(info.lastInsertRowid) });
});

/* ============ DASHBOARD + RESUMO + CALENDÁRIO ============ */

app.get('/api/dashboard/summary', authenticate, (req: AuthRequest, res) => {
  const me = req.user!;
  const { userId } = req.query as any;
  let userClause = '';
  let params: any[] = [];
  if (userId) {
    if (!canAccessUser(me, Number(userId))) return res.status(403).json({ error: 'Sem permissão' });
    userClause = 'AND t.user_id = ?'; params = [Number(userId)];
  } else {
    const s = scopeWhere(me, 't.user_id');
    userClause = `AND ${s.clause}`; params = s.params;
  }
  const q = (extra: string, p: any[] = []) =>
    (db.prepare(`SELECT COUNT(*) AS c FROM tasks t WHERE 1=1 ${userClause} ${extra}`).get(...params, ...p) as any).c as number;
  const total = q('');
  const pendentes = q(`AND t.status = 'PENDENTE'`);
  const emAndamento = q(`AND t.status = 'EM_ANDAMENTO'`);
  const concluidas = q(`AND t.status = 'CONCLUIDA'`);
  const atrasadas = q(`AND t.status != 'CONCLUIDA' AND t.data_prazo IS NOT NULL AND t.data_prazo < ?`, [today()]);
  const prox = new Date(); prox.setDate(prox.getDate() + 7);
  const vencem7d = q(`AND t.status != 'CONCLUIDA' AND t.data_prazo IS NOT NULL AND t.data_prazo BETWEEN ? AND ?`, [today(), prox.toISOString().slice(0, 10)]);
  const porArea = db.prepare(`
    SELECT COALESCE(a.nome, '(sem área)') AS nome, COUNT(*) AS total FROM tasks t
    LEFT JOIN areas a ON a.id = t.area_id WHERE 1=1 ${userClause} GROUP BY COALESCE(a.nome, '(sem área)') ORDER BY total DESC
  `).all(...params);
  const porStatus = [{ status: 'PENDENTE', total: pendentes }, { status: 'EM_ANDAMENTO', total: emAndamento }, { status: 'CONCLUIDA', total: concluidas }];
  return res.json({ total, pendentes, emAndamento, concluidas, atrasadas, vencem7d, porArea, porStatus });
});

app.get('/api/tasks/resumo', authenticate, (req: AuthRequest, res) => {
  const f = taskFilters(req);
  if ('error' in f) return res.status(403).json({ error: f.error });
  const rows = db.prepare(`
    SELECT t.*, COALESCE(a.nome, '(sem área)') AS area_nome, u.name AS owner_name FROM tasks t
    LEFT JOIN areas a ON a.id = t.area_id JOIN users u ON u.id = t.user_id
    WHERE ${f.where} ORDER BY t.status, COALESCE(t.data_prazo,'9999-12-31')
  `).all(...f.params) as any[];
  const lines: string[] = [];
  lines.push(`RESUMO DE TAREFAS — ${new Date().toLocaleDateString('pt-BR')} (${rows.length} tarefas)`);
  for (const s of ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA']) {
    const g = rows.filter(r => r.status === s);
    lines.push(`\n== ${s.replace('_', ' ')} (${g.length}) ==`);
    for (const t of g) {
      const orgs = (db.prepare(`SELECT o.nome FROM task_origens to2 JOIN origens o ON o.id = to2.origem_id WHERE to2.task_id = ?`).all(t.id) as any[]).map(o => o.nome).join(', ');
      lines.push(`• [${t.id}] ${t.titulo} | Área: ${t.area_nome}${orgs ? ` | Origens: ${orgs}` : ''} | Prazo: ${t.data_prazo || '—'} | Resp: ${t.owner_name} | Prioridade: ${t.prioridade}`);
    }
  }
  return res.json({ texto: lines.join('\n') });
});

app.get('/api/tasks/calendar', authenticate, (req: AuthRequest, res) => {
  const f = taskFilters(req);
  if ('error' in f) return res.status(403).json({ error: f.error });
  const { start, end } = req.query as any;
  let extra = 'AND t.data_prazo IS NOT NULL';
  const p = [...f.params];
  if (start) { extra += ' AND t.data_prazo >= ?'; p.push(start); }
  if (end) { extra += ' AND t.data_prazo <= ?'; p.push(end); }
  const rows = db.prepare(`
    SELECT t.id, t.titulo AS title, t.data_prazo AS date, t.status, t.prioridade, COALESCE(a.cor, '#6366f1') AS color, u.name AS owner_name
    FROM tasks t LEFT JOIN areas a ON a.id = t.area_id JOIN users u ON u.id = t.user_id
    WHERE ${f.where} ${extra} ORDER BY t.data_prazo LIMIT 500
  `).all(...p);
  return res.json({ events: rows });
});

/* ============ SETTINGS (configurações gerais — só ADMIN edita) ============ */

app.get('/api/settings', authenticate, (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as any[];
  return res.json({ settings: Object.fromEntries(rows.map(r => [r.key, r.value])) });
});

app.put('/api/settings', authenticate, requireAdmin, (req, res) => {
  const body = req.body || {};
  const stmt = db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(body)) stmt.run(k, String(v ?? ''));
  const rows = db.prepare('SELECT key, value FROM settings').all() as any[];
  return res.json({ settings: Object.fromEntries(rows.map(r => [r.key, r.value])) });
});

/* ============ FRONTEND ESTÁTICO (produção: backend serve o build do Vite) ============ */

const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`[kafka] API + frontend em http://localhost:${PORT}`));
