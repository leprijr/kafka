import { useEffect, useState } from 'react';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ login: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [site, setSite] = useState({ site_name: 'Kafka', site_subtitle: 'Sistema de Gestão de Processos', site_logo: '' });

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.settings) setSite(s => ({ ...s, ...d.settings }));
      })
      .catch(() => {});
  }, []);

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
        {site.site_logo && <img src={site.site_logo} alt="Logotipo" className="login-logo" />}
        <h1>{site.site_name || 'Kafka'}</h1>
        <p style={{ color: '#64748b', marginTop: 0 }}>{site.site_subtitle || ''}</p>
        <label>Login</label>
        <input value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} autoFocus />
        <div style={{ height: 10 }} />
        <label>Senha</label>
        <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        {err && <p style={{ color: '#dc2626' }}>{err}</p>}
        <button style={{ width: '100%', marginTop: 14 }} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
