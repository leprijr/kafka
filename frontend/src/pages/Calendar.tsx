import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

interface Ev { id: number; title: string; date: string; status: string; prioridade: string; color: string; owner_name: string; }

export default function CalendarPage() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [events, setEvents] = useState<Ev[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [dayTasks, setDayTasks] = useState<any[]>([]);

  const start = useMemo(() => `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-01`, [ym]);
  const end = useMemo(() => {
    const d = new Date(ym.y, ym.m + 1, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [ym]);

  const load = async () => {
    const { events } = await api(`/api/tasks/calendar?start=${start}&end=${end}`);
    setEvents(events);
  };
  useEffect(() => {
    load();
  }, [start, end]);

  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
    const out: { date: string; other: boolean; n: number }[] = [];
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(ym.y, ym.m, -i);
      out.push({ date: d.toISOString().slice(0, 10), other: true, n: d.getDate() });
    }
    for (let d = 1; d <= daysInMonth; d++) out.push({ date: `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, other: false, n: d });
    while (out.length % 7 !== 0) {
      const last = new Date(out[out.length - 1].date);
      last.setDate(last.getDate() + 1);
      out.push({ date: last.toISOString().slice(0, 10), other: true, n: last.getDate() });
    }
    return out;
  }, [ym]);

  const byDate = useMemo(() => {
    const m: Record<string, Ev[]> = {};
    for (const e of events) (m[e.date] = m[e.date] || []).push(e);
    return m;
  }, [events]);

  const select = async (date: string) => {
    setSel(date);
    const { tasks } = await api(`/api/tasks?from=${date}&to=${date}`);
    setDayTasks(tasks);
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Calendário — {String(ym.m + 1).padStart(2, '0')}/{ym.y}</h2>
        <div className="row">
          <button className="ghost" onClick={() => setYm({ y: ym.m === 0 ? ym.y - 1 : ym.y, m: ym.m === 0 ? 11 : ym.m - 1 })}>‹ Anterior</button>
          <button className="ghost" onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}>Hoje</button>
          <button className="ghost" onClick={() => setYm({ y: ym.m === 11 ? ym.y + 1 : ym.y, m: ym.m === 11 ? 0 : ym.m + 1 })}>Próximo ›</button>
        </div>
      </div>
      <div className="cal" style={{ marginTop: 12 }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="dow">{d}</div>)}
        {cells.map(c => (
          <div key={c.date + c.n} className={`day ${c.other ? 'other' : ''} ${sel === c.date ? 'sel' : ''}`} onClick={() => select(c.date)}>
            <b>{c.n}</b>
            {(byDate[c.date] || []).slice(0, 3).map(e => <div key={e.id} className="ev" title={`${e.title} (${e.owner_name})`}>{e.title}</div>)}
            {(byDate[c.date] || []).length > 3 && <div className="ev">+{(byDate[c.date] || []).length - 3} mais</div>}
          </div>
        ))}
      </div>
      {sel && (
        <div className="card">
          <h3>Tarefas em {sel} ({dayTasks.length})</h3>
          {dayTasks.map((t: any) => <div key={t.id} className="row" style={{ justifyContent: 'space-between' }}><span>#{t.id} — {t.titulo}</span><span className="badge">{t.status}</span></div>)}
          {dayTasks.length === 0 && <p style={{ color: '#64748b' }}>Nenhuma tarefa com prazo neste dia.</p>}
        </div>
      )}
    </div>
  );
}
