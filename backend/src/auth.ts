import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, Role, visibleUserIds } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'kafka-dev-secret-troque-em-producao';

export interface AuthUser {
  id: number;
  name: string;
  login: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function signToken(u: AuthUser) {
  return jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: '8h' });
}

/** Exige Bearer token válido. */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; role: Role };
    const row = db.prepare('SELECT id, name, login, role, active FROM users WHERE id = ?').get(payload.id) as any;
    if (!row || !row.active) return res.status(401).json({ error: 'Usuário inválido ou inativo' });
    req.user = { id: row.id, name: row.name, login: row.login, role: row.role as Role };
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

/** Só ADMIN passa. */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas ADMIN' });
  return next();
}

/**
 * Verifica se o logado pode acessar dados de `targetUserId`.
 * ADMIN: qualquer um. GESTOR: self + gerenciados. USUARIO: só self.
 */
export function canAccessUser(me: AuthUser, targetUserId: number): boolean {
  if (me.role === 'ADMIN') return true;
  if (me.id === targetUserId) return true;
  if (me.role === 'GESTOR') {
    const r = db.prepare('SELECT id FROM users WHERE id = ? AND manager_id = ?').get(targetUserId, me.id) as any;
    return !!r;
  }
  return false;
}

export function scopeWhere(me: AuthUser, col = 'user_id'): { clause: string; params: any[] } {
  const ids = visibleUserIds(me);
  if (ids === null) return { clause: '1=1', params: [] };
  return { clause: `${col} IN (${ids.map(() => '?').join(',')})`, params: ids };
}
