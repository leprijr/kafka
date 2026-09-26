import { useEffect, useState } from 'react';
import { api, User } from '../api';
import { useAuth } from '../auth';

interface Task {
  id: number;
  user_id: number;
  titulo: string;
  descricao: string;
  status: string;
  prioridade: string;
  data_inicio: string | null;
  data_prazo: string | null;
  area_id: number | null;
  area_nome?: string;
  owner_name?: string;
  origens: { id: number; nome: string }[];
  tramitacoes_count: number;
}

const emptyForm = { titulo: '', descricao: '', status: 'PENDENTE', prioridade: 'MEDIA', data_inicio: '', data_prazo: '', area_id: '', origem_ids: [] as number[], user_id: '' };

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [origens, setOrigens] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState({ q: '', status: '', areaId: '', origemId: '', userId: '' });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Task | null>(null);
  const [detail, setDetail] = useState<Task | null>(null);
  const [trams, setTrams] = useState<any[]>([]);
  const [tramText, setTramText] = useState('');
  const [resumo, setResumo] = useState<string | null>(null);

  const loadBase = async () => {
    const [a, o, u] = await Promise.all([api('/api/areas'), api('/api/origens'), api('/api/users')]);
    setAreas(a.areas);
    setOrigens(o.origens);
    setUsers(u.users);
  };

  const load = async () => {
    const p = new URLSearchParams();
    if (filters.q) p.set('q', filters.q);
    if (filters.status) p.set('status', filters.status);
    if (filters.areaId) p.set('areaId', filters.areaId);
    if (filters.origemId) p.set('origemId', filters.origemId);
    if (filters.userId) p.set('userId', filters.userId);
    const { tasks } = await api(`/api/tasks?${p.toString()}`);
    setTasks(tasks);
  };

  useEffect(() => {
    loadBase();
  }, []);
  useEffect(() => {
    load();
  }, [filters]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };
  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({
      titulo: t.titulo,
      descricao: t.descricao,
      status: t.status,
      prioridade: t.prioridade,
      data_inicio: t.data_inicio || '',
      data_prazo: t.data_prazo || '',
      area_id: t.area_id ? String(t.area_id) : '',
      origem_ids: t.origens.map(o => o.id),
      user_id: String(t.user_id)
    });
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      titulo: form.titulo,
      descricao: form.descricao,
      status: form.status,
      prioridade: form.prioridade,
      data_inicio: form.data_inicio || null,
      data_prazo: form.data_prazo || null,
      area_id: form.area_id ? Number(form.area_id) : null,
      origem_ids: form.origem_ids,
      ...(editing ? {} : form.user_id ? { user_id: Number(form.user_id) } : {})
    };
    if (editing) await api(`/api/tasks/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
    setShowForm(false);
    load();
  };

  const remove = async (t: Task) => {
    if (!confirm(`Excluir "${t.titulo}"?`)) return;
    await api(`/api/tasks/${t.id}`, { method: 'DELETE' });
    if (detail?.id === t.id) setDetail(null);
    load();
  };

  const openDetail = async (t: Task) => {
    setDetail(t);
    const { tramitacoes } = await api(`/api/tasks/${t.id}/tramitacoes`);
    setTrams(tramitacoes);
    setTramText('');
  };

  const addTram = async () => {
    if (!detail || !tramText.trim()) return;
    await api(`/api/tasks/${detail.id}/tramitacoes`, { method: 'POST', body: JSON.stringify({ texto: tramText }) });
    const { tramitacoes } = await api(`/api/tasks/${detail.id}/tramitacoes`);
    setTrams(tramitacoes);
    setTramText('');
    load();
  };

  const openResumo = async () => {
    const p = new URLSearchParams();
    if (filters.status) p.set('status', filters.status);
    if (filters.areaId) p.set('areaId', filters.areaId);
    if (filters.userId) p.set('userId', filters.userId);
    const data = await api(`/api/tasks/resumo?${p.toString()}`);
    setResumo(data.texto);
  };

  const origensDaArea = origens.filter(o => !form.area_id || String(o.area_id) === String(form.area_id));

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Tarefas</h2>
        <div className="row">
          <button className="ghost" onClick={openResumo}>Resumo das tarefas</button>
          <button onClick={openNew}>+ Nova tarefa</button>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <input placeholder="Buscar…" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} style={{ maxWidth: 200 }} />
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} style={{ maxWidth: 170 }}>
            <option value="">Todos os status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="EM_ANDAMENTO">Em andamento</option>
            <option value="CONCLUIDA">Concluída</option>
          </select>
          <select value={filters.areaId} onChange={e => setFilters({ ...filters, areaId: e.target.value, origemId: '' })} style={{ maxWidth: 170 }}>
            <option value="">Todas as áreas</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          <select value={filters.origemId} onChange={e => setFilters({ ...filters, origemId: e.target.value })} style={{ maxWidth: 170 }}>
            <option value="">Todas as origens</option>
            {origens.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          {user?.role !== 'USUARIO' && (
            <select value={filters.userId} onChange={e => setFilters({ ...filters, userId: e.target.value })} style={{ maxWidth: 170 }}>
              <option value="">Todos usuários</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead><tr><th>Título</th><th>Área / Origens</th><th>Status</th><th>Prazo</th><th>Resp.</th><th></th></tr></thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id}>
                <td><a href="#" onClick={e => { e.preventDefault(); openDetail(t); }}>{t.titulo}</a><br /><small style={{ color: '#64748b' }}>#{t.id} · {t.prioridade} · 💬 {t.tramitacoes_count}</small></td>
                <td>
                  {t.area_nome && <span className="badge dim">{t.area_nome}</span>}{' '}
                  {t.origens.map(o => <span key={o.id} className="badge" style={{ marginRight: 4 }}>{o.nome}</span>)}
                </td>
                <td><span className={`badge ${t.status === 'CONCLUIDA' ? 'ok' : t.status === 'EM_ANDAMENTO' ? 'warn' : ''}`}>{t.status}</span></td>
                <td>{t.data_prazo || '—'}</td>
                <td>{t.owner_name}</td>
                <td className="row">
                  <button className="ghost" onClick={() => openEdit(t)}>Editar</button>
                  <button className="danger" onClick={() => remove(t)}>X</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 && <p style={{ padding: 16, color: '#64748b' }}>Nenhuma tarefa encontrada.</p>}
      </div>

      {showForm && (
        <div className="modal-bg" onClick={() => setShowForm(false)}>
          <form className="modal" onSubmit={save} onClick={e => e.stopPropagation()}>
            <h3>{editing ? 'Editar tarefa' : 'Nova tarefa'}</h3>
            <label>Título</label>
            <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} required />
            <label>Descrição</label>
            <textarea rows={3} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
            <div className="row">
              <div style={{ flex: 1 }}><label>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="PENDENTE">Pendente</option>
                  <option value="EM_ANDAMENTO">Em andamento</option>
                  <option value="CONCLUIDA">Concluída</option>
                </select></div>
              <div style={{ flex: 1 }}><label>Prioridade</label>
                <select value={form.prioridade} onChange={e => setForm({ ...form, prioridade: e.target.value })}>
                  <option value="BAIXA">Baixa</option>
                  <option value="MEDIA">Média</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select></div>
            </div>
            <div className="row">
              <div style={{ flex: 1 }}><label>Início</label><input type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label>Prazo</label><input type="date" value={form.data_prazo} onChange={e => setForm({ ...form, data_prazo: e.target.value })} /></div>
            </div>
            {!editing && user?.role !== 'USUARIO' && (
              <><label>Responsável</label>
                <select value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })}>
                  <option value="">Eu mesmo</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select></>
            )}
            <label>Área</label>
            <select value={form.area_id} onChange={e => setForm({ ...form, area_id: e.target.value, origem_ids: [] })}>
              <option value="">(sem área)</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            <label>Origens (pode marcar várias)</label>
            <div className="card" style={{ maxHeight: 140, overflow: 'auto' }}>
              {origensDaArea.length === 0 && <small style={{ color: '#64748b' }}>Cadastre origens em “Áreas e Origens”.</small>}
              {origensDaArea.map(o => (
                <label key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#0f172a' }}>
                  <input type="checkbox" style={{ width: 'auto' }}
                    checked={form.origem_ids.includes(o.id)}
                    onChange={e => setForm({ ...form, origem_ids: e.target.checked ? [...form.origem_ids, o.id] : form.origem_ids.filter(id => id !== o.id) })} />
                  {o.nome} <small>({o.area_nome})</small>
                </label>
              ))}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="submit">Salvar</button>
              <button type="button" className="ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <div className="modal-bg" onClick={() => setDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>#{detail.id} — {detail.titulo}</h3>
            <p>{detail.descricao || <i>Sem descrição</i>}</p>
            <p><span className="badge">{detail.status}</span> <span className="badge dim">{detail.prioridade}</span> Prazo: {detail.data_prazo || '—'}</p>
            <h4>Tramitações</h4>
            <div className="timeline">
              {trams.map(tr => <div key={tr.id} className="item"><b>{tr.author_name}</b> <small>· {tr.created_at}</small><br />{tr.texto}</div>)}
              {trams.length === 0 && <small>Sem tramitações ainda.</small>}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <input placeholder="Nova tramitação…" value={tramText} onChange={e => setTramText(e.target.value)} />
              <button onClick={addTram}>Adicionar</button>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="ghost" onClick={() => { openEdit(detail); setDetail(null); }}>Editar tarefa</button>
              <button className="ghost" onClick={() => setDetail(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {resumo !== null && (
        <div className="modal-bg" onClick={() => setResumo(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Resumo das tarefas</h3>
            <pre className="resumo">{resumo}</pre>
            <div className="row" style={{ marginTop: 12 }}>
              <button onClick={() => navigator.clipboard.writeText(resumo)}>Copiar</button>
              <button className="ghost" onClick={() => setResumo(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
