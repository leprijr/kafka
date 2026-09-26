import { useEffect, useState } from 'react';
import { api, User } from '../api';
import PasswordInput from '../components/PasswordInput';

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: '', login: '', password: '', role: 'USUARIO', manager_id: '' });
  const [settings, setSettings] = useState<any>({});
  const [err, setErr] = useState('');
  const [requests, setRequests] = useState<any[]>([]);
  const [newPw, setNewPw] = useState<Record<number, string>>({});

  const load = async () => {
    const { users } = await api('/api/users');
    setUsers(users);
    const { settings } = await api('/api/settings');
    setSettings(settings);
    const { requests } = await api('/api/password-requests');
    setRequests(requests);
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

  const onLogoFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      alert('Escolha um arquivo de imagem.');
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      alert('Imagem muito grande. Use até 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSettings((s: any) => ({ ...s, site_logo: String(reader.result || '') }));
    reader.readAsDataURL(f);
  };

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
            <div style={{ flex: 1 }}><label>Senha</label><PasswordInput value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></div>
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
        <h3>Solicitações de nova senha</h3>
        {requests.filter(r => r.status === 'PENDENTE').length === 0 && <p style={{ color: '#64748b' }}>Nenhuma solicitação pendente.</p>}
        {requests.filter(r => r.status === 'PENDENTE').map(r => (
          <div key={r.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', padding: '8px 0' }}>
            <span>#{r.id} — <b>{r.user_name || r.login}</b> ({r.login}) · {r.created_at}</span>
            <span className="row">
              <span style={{ minWidth: 180, display: 'inline-block' }}>
                <PasswordInput placeholder="Nova senha" value={newPw[r.id] || ''} onChange={e => setNewPw({ ...newPw, [r.id]: e.target.value })} />
              </span>
              <button onClick={async () => {
                if ((newPw[r.id] || '').length < 4) { alert('Nova senha deve ter ao menos 4 caracteres'); return; }
                await api(`/api/password-requests/${r.id}/approve`, { method: 'POST', body: JSON.stringify({ newPassword: newPw[r.id] }) });
                load();
              }}>Autorizar</button>
              <button className="danger" onClick={async () => { if (confirm('Rejeitar solicitação?')) { await api(`/api/password-requests/${r.id}/reject`, { method: 'POST' }); load(); } }}>Rejeitar</button>
            </span>
          </div>
        ))}
        {requests.filter(r => r.status !== 'PENDENTE').length > 0 && (
          <details style={{ marginTop: 10 }}>
            <summary>Histórico ({requests.filter(r => r.status !== 'PENDENTE').length})</summary>
            {requests.filter(r => r.status !== 'PENDENTE').slice(0, 20).map(r => (
              <div key={r.id} style={{ fontSize: 13, padding: '4px 0' }}>#{r.id} — {r.user_name || r.login} · {r.status} · {r.handled_at || ''}</div>
            ))}
          </details>
        )}
      </div>

      <div className="card">
        <h3>Configurações gerais do site</h3>
        <label>Nome do site</label>
        <input value={settings.site_name || ''} onChange={e => setSettings({ ...settings, site_name: e.target.value })} />
        <label>Subtítulo</label>
        <input value={settings.site_subtitle || ''} onChange={e => setSettings({ ...settings, site_subtitle: e.target.value })} />
        <label>Logotipo (imagem — aparece no login e no menu lateral)</label>
        {settings.site_logo && <div style={{ margin: '8px 0' }}><img src={settings.site_logo} alt="Logotipo atual" style={{ maxHeight: 80, maxWidth: 220, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 4 }} /></div>}
        <div className="row">
          <input type="file" accept="image/*" onChange={e => onLogoFile(e.target.files?.[0])} style={{ maxWidth: 320 }} />
          {settings.site_logo && <button type="button" className="ghost" onClick={() => setSettings({ ...settings, site_logo: '' })}>Remover logo</button>}
        </div>
        <label>Exibição do cabeçalho (login + menu lateral)</label>
        <select value={settings.site_header_mode || 'logo-name-subtitle'} onChange={e => setSettings({ ...settings, site_header_mode: e.target.value })} style={{ maxWidth: 320 }}>
          <option value="logo-only">Apenas logotipo</option>
          <option value="logo-name">Logotipo + nome do site</option>
          <option value="logo-name-subtitle">Logotipo + nome + subtítulo</option>
          <option value="none">Nenhum (ocultar tudo)</option>
        </select>
        <button style={{ marginTop: 10 }} onClick={async () => { await api('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }); alert('Salvo!'); }}>Salvar</button>
      </div>
    </div>
  );
}
