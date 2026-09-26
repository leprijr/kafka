import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import PasswordInput from '../components/PasswordInput';

export default function Profile() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState('');

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ name }) });
    await refresh();
    setMsg('Perfil atualizado.');
  };
  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      await api('/api/auth/password', { method: 'PUT', body: JSON.stringify(pw) });
      setPw({ currentPassword: '', newPassword: '' });
      setMsg('Senha alterada.');
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  return (
    <div>
      <h2>Perfil</h2>
      <div className="card">
        <p>Login: <b>{user?.login}</b> · Nível: <b>{user?.role}</b></p>
        <form onSubmit={saveName}>
          <label>Nome</label>
          <input value={name} onChange={e => setName(e.target.value)} />
          <button style={{ marginTop: 8 }}>Salvar nome</button>
        </form>
      </div>
      <div className="card">
        <h3>Alterar senha</h3>
        <form onSubmit={savePw}>
          <label>Senha atual</label>
          <PasswordInput value={pw.currentPassword} onChange={e => setPw({ ...pw, currentPassword: e.target.value })} />
          <label>Nova senha</label>
          <PasswordInput value={pw.newPassword} onChange={e => setPw({ ...pw, newPassword: e.target.value })} />
          <button style={{ marginTop: 8 }}>Alterar senha</button>
        </form>
      </div>
      {msg && <p>{msg}</p>}
    </div>
  );
}
