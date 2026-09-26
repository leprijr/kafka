import { useState } from 'react';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ login: 'admin', password: '123456' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(form.login.trim(), form.password);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={submit}>
        <h1>Kafka</h1>
        <p style={{ color: '#64748b', marginTop: 0 }}>Sistema de Gestão de Processos</p>
        <label>Login</label>
        <input value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} autoFocus />
        <div style={{ height: 10 }} />
        <label>Senha</label>
        <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        {err && <p style={{ color: '#dc2626' }}>{err}</p>}
        <button style={{ width: '100%', marginTop: 14 }} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <p style={{ fontSize: 12, color: '#64748b' }}>Acesso inicial: <b>admin</b> / <b>123456</b></p>
      </form>
    </div>
  );
}
