import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import PasswordInput from '../components/PasswordInput';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ login: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [site, setSite] = useState({ site_name: 'Kafka', site_subtitle: 'Sistema de Gestão de Processos', site_logo: '', site_header_mode: 'logo-name-subtitle' });
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotLogin, setForgotLogin] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');

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

  const sendForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg('');
    try {
      const r = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: forgotLogin })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao enviar');
      setForgotMsg(d.message || 'Solicitação enviada.');
    } catch (e: any) {
      setForgotMsg(e.message);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={submit}>
        {site.site_header_mode !== 'none' && (
          <>
            {(site.site_header_mode === 'logo-only' || site.site_header_mode === 'logo-name' || site.site_header_mode === 'logo-name-subtitle') && site.site_logo && (
              <img src={site.site_logo} alt="Logotipo" className="login-logo" />
            )}
            {(site.site_header_mode === 'logo-name' || site.site_header_mode === 'logo-name-subtitle') && <h1>{site.site_name || 'Kafka'}</h1>}
            {site.site_header_mode === 'logo-name-subtitle' && <p style={{ color: '#64748b', marginTop: 0 }}>{site.site_subtitle || ''}</p>}
          </>
        )}
        <label>Login</label>
        <input value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} autoFocus />
        <div style={{ height: 10 }} />
        <label>Senha</label>
        <PasswordInput value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        {err && <p style={{ color: '#dc2626' }}>{err}</p>}
        <button style={{ width: '100%', marginTop: 14 }} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <p style={{ textAlign: 'center', marginTop: 10 }}>
          <a href="#" onClick={e => { e.preventDefault(); setForgotOpen(true); setForgotMsg(''); }}>Esqueci a senha</a>
        </p>
      </form>

      {forgotOpen && (
        <div className="modal-bg" onClick={() => setForgotOpen(false)}>
          <form className="modal" onSubmit={sendForgot} onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>Esqueci a senha</h3>
            <p style={{ color: '#64748b' }}>Informe seu login. O Administrador vai autorizar uma nova senha.</p>
            <label>Login</label>
            <input value={forgotLogin} onChange={e => setForgotLogin(e.target.value)} required />
            {forgotMsg && <p>{forgotMsg}</p>}
            <div className="row" style={{ marginTop: 12 }}>
              <button type="submit">Enviar solicitação</button>
              <button type="button" className="ghost" onClick={() => setForgotOpen(false)}>Fechar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
