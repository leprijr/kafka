import { useEffect, useState } from 'react';
import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import CalendarPage from './pages/Calendar';
import Areas from './pages/Areas';
import AdminUsers from './pages/AdminUsers';
import Profile from './pages/Profile';

function Shell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [logo, setLogo] = useState('');
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => setLogo(d.settings?.site_logo || ''))
      .catch(() => {});
  }, []);
  if (!user) return <Navigate to="/login" />;
  const out = () => {
    logout();
    nav('/login');
  };
  return (
    <div className="layout">
      <aside className="sidebar">
        {logo && <img src={logo} alt="Logotipo" className="sidebar-logo" />}
        <h1>Kafka</h1>
        <small>Sistema de Gestão de Processos</small>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/tarefas">Tarefas</NavLink>
          <NavLink to="/calendario">Calendário</NavLink>
          <NavLink to="/areas">Áreas e Origens</NavLink>
          {user.role === 'ADMIN' && <NavLink to="/usuarios">Usuários</NavLink>}
          <NavLink to="/perfil">Perfil</NavLink>
        </nav>
        <div className="who">
          {user.name} · {user.role}
          <br />
          <button className="ghost" onClick={out} style={{ width: '100%' }}>Sair</button>
        </div>
      </aside>
      <div className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tarefas" element={<Tasks />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/areas" element={<Areas />} />
          <Route path="/usuarios" element={user.role === 'ADMIN' ? <AdminUsers /> : <Navigate to="/" />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Carregando…</div>;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/*" element={<Shell />} />
    </Routes>
  );
}
