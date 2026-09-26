import { useEffect, useState } from 'react';
import { api, User } from '../api';

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: '', login: '', password: '', role: 'USUARIO', manager_id: '' });
  const [settings, setSettings] = useState<any>({});
  const [err, setErr] = useState('');

  const load = async () => {
    const { users } = await api('/api/users');
    setUsers(users);
    const { settings } = await api('/api/settings');
    setSettings(settings);
  };
  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, manager_id: form.manager_id ? Number(form.manager_id) : null })
      });
      setForm({ name: '', login: '', password: '', role: 'USUARIO', manager_id: '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const gestores = users.filter(u => u.role === 'GESTOR');

  return (
    <div>
      <h2>Painel Administrativo</h2>
      <div className="card">
        <h3>Criar usuário (só ADMIN)</h3>
        <form onSubmit={create}>
          <div className="row">
            <div style={{ flex: 1 }}><label>Nome</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
            <div style={{ flex: 1 }}><label>Login</label><input value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} required /></div>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <div style={{ flex: 1 }}><label>Senha</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></div>
            <div style={{ flex: 1 }}><label>Nível</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="USUARIO">Usuário</option>
                <option value="GESTOR">Gestor</option>
                <option value="ADMIN">Administrador</option>
              </select></div>
            <div style={{ flex: 1 }}><label>Gestor responsável</label>
              <select value={form.manager_id} onChange={e => setForm({ ...form, manager_id: e.target.value })}>
                <option value="">(nenhum)</option>
                {gestores.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select></div>
          </div>
          {err && <p style={{ color: '#dc2626' }}>{err}</p>}
          <button style={{ marginTop: 10 }}>Criar</button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead><tr><th>Nome</th><th>Login</th><th>Nível</th><th>Gestor</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.login}</td>
                <td>
                  <select value={u.role} onChange={async e => { await api(`/api/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ role: e.target.value }) }); load(); }}>
                    <option value="USUARIO">Usuário</option>
                    <option value="GESTOR">Gestor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td>
                  <select value={u.manager_id || ''} onChange={async e => { await api(`/api/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ manager_id: e.target.value ? Number(e.target.value) : null }) }); load(); }}>
                    <option value="">—</option>
                    {gestores.filter(g => g.id !== u.id).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </td>
                <td><button className="danger" onClick={async () => { if (confirm(`Excluir ${u.name}?`)) { await api(`/api/users/${u.id}`, { method: 'DELETE' }); load(); } }}>Excluir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Configurações gerais do site</h3>
        <label>Nome do site</label>
        <input value={settings.site_name || ''} onChange={e => setSettings({ ...settings, site_name: e.target.value })} />
        <label>Subtítulo</label>
        <input value={settings.site_subtitle || ''} onChange={e => setSettings({ ...settings, site_subtitle: e.target.value })} />
        <button style={{ marginTop: 10 }} onClick={async () => { await api('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }); alert('Salvo!'); }}>Salvar</button>
      </div>
    </div>
  );
}
