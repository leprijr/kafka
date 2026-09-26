import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Areas() {
  const [areas, setAreas] = useState<any[]>([]);
  const [origens, setOrigens] = useState<any[]>([]);
  const [areaForm, setAreaForm] = useState({ nome: '', cor: '#4f46e5' });
  const [origForm, setOrigForm] = useState({ nome: '', area_id: '' });

  const load = async () => {
    const [a, o] = await Promise.all([api('/api/areas'), api('/api/origens')]);
    setAreas(a.areas);
    setOrigens(o.origens);
  };
  useEffect(() => {
    load();
  }, []);

  const addArea = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/api/areas', { method: 'POST', body: JSON.stringify(areaForm) });
    setAreaForm({ nome: '', cor: '#4f46e5' });
    load();
  };
  const addOrigem = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/api/origens', { method: 'POST', body: JSON.stringify({ nome: origForm.nome, area_id: Number(origForm.area_id) }) });
    setOrigForm({ nome: '', area_id: '' });
    load();
  };

  return (
    <div>
      <h2>Áreas e Origens</h2>
      <p style={{ color: '#64748b' }}>Cada usuário configura as suas. A Origem é sempre atrelada a uma Área, e a tarefa pode marcar várias origens.</p>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: 1, minWidth: 280 }}>
          <h3>Áreas</h3>
          <form onSubmit={addArea} className="row">
            <input placeholder="Nome da área" value={areaForm.nome} onChange={e => setAreaForm({ ...areaForm, nome: e.target.value })} required />
            <input type="color" value={areaForm.cor} onChange={e => setAreaForm({ ...areaForm, cor: e.target.value })} style={{ maxWidth: 60 }} />
            <button>Adicionar</button>
          </form>
          {areas.map(a => (
            <div key={a.id} className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <span><span style={{ display: 'inline-block', width: 12, height: 12, background: a.cor, borderRadius: 4, marginRight: 6 }} />{a.nome}</span>
              <button className="danger" onClick={async () => { if (confirm('Excluir área e suas origens?')) { await api(`/api/areas/${a.id}`, { method: 'DELETE' }); load(); } }}>X</button>
            </div>
          ))}
        </div>
        <div className="card" style={{ flex: 1, minWidth: 280 }}>
          <h3>Origens</h3>
          <form onSubmit={addOrigem}>
            <label>Área vinculada</label>
            <select value={origForm.area_id} onChange={e => setOrigForm({ ...origForm, area_id: e.target.value })} required>
              <option value="">Selecione…</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            <div style={{ height: 8 }} />
            <label>Nome da origem</label>
            <input value={origForm.nome} onChange={e => setOrigForm({ ...origForm, nome: e.target.value })} required />
            <button style={{ marginTop: 8 }}>Adicionar origem</button>
          </form>
          <div style={{ marginTop: 10 }}>
            {origens.map(o => (
              <div key={o.id} className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <span>{o.nome} <small style={{ color: '#64748b' }}>({o.area_nome})</small></span>
                <button className="danger" onClick={async () => { if (confirm('Excluir origem?')) { await api(`/api/origens/${o.id}`, { method: 'DELETE' }); load(); } }}>X</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
