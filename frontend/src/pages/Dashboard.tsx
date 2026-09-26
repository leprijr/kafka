import { useEffect, useState } from 'react';
import { api, User } from '../api';
import { useAuth } from '../auth';

export default function Dashboard() {
  const { user } = useAuth();
  const [sum, setSum] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [filterUser, setFilterUser] = useState('');
  const [resumo, setResumo] = useState<string | null>(null);

  const loadUsers = async () => {
    const { users } = await api('/api/users');
    setUsers(users);
  };

  const load = async () => {
    const q = filterUser ? `?userId=${filterUser}` : '';
    const data = await api(`/api/dashboard/summary${q}`);
    setSum(data);
  };

  useEffect(() => {
    loadUsers();
    load();
  }, []);
  useEffect(() => {
    load();
  }, [filterUser]);

  const openResumo = async () => {
    const q = filterUser ? `?userId=${filterUser}` : '';
    const data = await api(`/api/tasks/resumo${q}`);
    setResumo(data.texto);
  };

  const canFilter = user?.role !== 'USUARIO';

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Dashboard {user?.role === 'GESTOR' ? '— minha equipe' : user?.role === 'ADMIN' ? '— geral' : ''}</h2>
        <button onClick={openResumo}>Resumo das tarefas</button>
      </div>

      {canFilter && (
        <div className="card">
          <label>Filtrar por usuário {user?.role === 'GESTOR' ? '(você + gerenciados)' : '(todos)'}</label>
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ maxWidth: 320 }}>
            <option value="">{user?.role === 'ADMIN' ? 'Todos' : 'Eu + equipe'}</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.login})</option>)}
          </select>
        </div>
      )}

      {sum && (
        <>
          <div className="grid">
            <div className="stat"><b>{sum.total}</b><span>Total</span></div>
            <div className="stat"><b>{sum.pendentes}</b><span>Pendentes</span></div>
            <div className="stat"><b>{sum.emAndamento}</b><span>Em andamento</span></div>
            <div className="stat"><b>{sum.concluidas}</b><span>Concluídas</span></div>
            <div className="stat"><b>{sum.atrasadas}</b><span>Atrasadas</span></div>
            <div className="stat"><b>{sum.vencem7d}</b><span>Vencem em 7 dias</span></div>
          </div>
          <div className="card">
            <h3>Por área</h3>
            {sum.porArea.length === 0 && <p style={{ color: '#64748b' }}>Sem tarefas.</p>}
            {sum.porArea.map((r: any) => <div key={r.nome} className="row" style={{ justifyContent: 'space-between' }}><span>{r.nome}</span><span className="badge">{r.total}</span></div>)}
          </div>
        </>
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
