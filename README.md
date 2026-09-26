# Kafka — Sistema de Gestão de Processos

To-Do List multiusuário com RBAC (Admin > Gestor > Usuário), Áreas + Origens (N origens por tarefa),
tramitações, calendário nativo, dashboard por escopo e botão de resumo.

> O arquivo `TO-DO LIST.xlsx` citado no pedido não estava anexado ao workspace, então a modelagem
> foi inferida do padrão clássico de planilha (Título, Descrição, Status, Prioridade, Datas, Responsável)
> + os requisitos extras (Área, Origens N:N, Tramitações, Calendário, Dashboard, Resumo).

## Stack sugerida (e implementada neste repo)

| Camada | Tecnologia | Motivo |
|---|---|---|
| Front-end | React 18 + Vite + TypeScript + React Router + CSS puro | Leve, rápido, deploy estático simples, sem dependência de FullCalendar (calendário nativo próprio) |
| Back-end | Node 20 + Express + TypeScript | Simples de hospedar na Fly.io, suficiente para o escopo |
| DB | SQLite (`better-sqlite3`) + volume Fly.io | Zero config, relacional (FKs), migra facilmente para Postgres depois |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` | Padrão seguro para login/senha + RBAC |
| Deploy | GitHub + Fly.io (1 app, Dockerfile multi-stage) | Backend serve o frontend buildado — 1 deploy, 1 URL |

## Estrutura

```
kafka/
├── backend/src/
│   ├── index.ts          # app Express + serve static frontend
│   ├── db.ts             # schema SQL + seed admin/123456
│   └── auth.ts           # authenticate + requireAdmin + escopo Gestor/Usuário
├── frontend/src/
│   ├── api.ts            # wrapper fetch + token
│   ├── auth.tsx          # AuthContext
│   ├── App.tsx           # rotas + layout
│   ├── pages/Login.tsx
│   ├── pages/Dashboard.tsx
│   ├── pages/Tasks.tsx
│   ├── pages/Calendar.tsx
│   ├── pages/Areas.tsx
│   ├── pages/AdminUsers.tsx
│   └── pages/Profile.tsx
├── Dockerfile
├── fly.toml
└── README.md (este arquivo)
```

## Banco de dados (SQL — SQLite)

```sql
users(id, name, login UNIQUE, password_hash, role, manager_id→users, active, created_at)
areas(id, user_id→users, nome, cor)                                   -- Área configurada pelo próprio usuário
origens(id, user_id→users, area_id→areas, nome)                       -- Origem atrelada a uma Área
tasks(id, user_id→users, titulo, descricao, status, prioridade,
      data_inicio, data_prazo, data_conclusao, area_id→areas, created_at, updated_at)
task_origens(task_id→tasks, origem_id→origens, PK composta)           -- N origens na mesma tarefa
tramitacoes(id, task_id→tasks, user_id→users, texto, created_at)      -- histórico / tramitações
settings(key PK, value)                                               -- configurações gerais do site
```

Relacionamento hierárquico: `users.manager_id → users.id`.
- ADMIN: escopo = todos (`WHERE` sem filtro).
- GESTOR: escopo = próprio `id` + `users.manager_id = <gestor_id>`.
- USUARIO: escopo = próprio `id`.

Áreas/Origens têm `user_id` = dono (cada usuário configura as suas).
Tarefas têm `user_id` = dono. Gestor edita tarefas dos gerenciados via checagem de escopo.

Seed inicial: `login: admin / senha: 123456 / role: ADMIN` (senha com bcrypt, 10 rounds).

## Rodar localmente

Pré-requisito: Node 20+.

```powershell
# 1) backend
cd backend
npm install
npm run dev        # http://localhost:3001 (API em /api/*)

# 2) frontend (outro terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxy /api -> 3001)
```

Login inicial: `admin` / `123456`. Depois crie gestores e usuários no painel **Usuários** (só admin).

## Publicar (GitHub + Fly.io)

```powershell
# 1) Subir para o GitHub
git init; git add -A; git commit -m "kafka initial"
gh repo create kafka --public --source=. --push

# 2) Fly.io (uma única vez)
fly auth login
fly launch --no-deploy        # aceita o fly.toml existente
fly volumes create kafka_data --region gru --size 1
fly secrets set JWT_SECRET="troque-por-algo-longo-aleatorio"
fly deploy                    # build Dockerfile (frontend+backend) e publica
fly open
```

Atualizações contínuas:

```powershell
git push                      # GitHub
fly deploy                    # Fly.io
```

Ou automático via Actions: basta adicionar o secret `FLY_API_TOKEN` (`fly tokens create deploy`)
— o workflow `.github/workflows/deploy.yml` já faz `fly deploy` a cada push na `main`.

## API (resumo)

```
POST /api/auth/login                 { login, password } -> { token, user }
GET  /api/auth/me                    Bearer -> user
PUT  /api/auth/profile               { name } / PUT /api/auth/password { currentPassword, newPassword }
GET  /api/users                      ADMIN lista todos | GESTOR lista gerenciados+self
POST /api/users                      ADMIN cria (define role + manager_id)
PUT  /api/users/:id                  ADMIN edita | próprio edita nome (via /profile)
DELETE /api/users/:id                ADMIN (não pode excluir a si mesmo)
GET/POST /api/areas   PUT/DELETE /api/areas/:id            (escopo próprio)
GET/POST /api/origens PUT/DELETE /api/origens/:id          (escopo próprio, exige area_id)
GET  /api/tasks?status=&areaId=&origemId=&q=&from=&to=&userId=   (userId só ADMIN/GESTOR, respeita escopo)
POST /api/tasks   PUT /api/tasks/:id   DELETE /api/tasks/:id
GET  /api/tasks/:id/tramitacoes   POST /api/tasks/:id/tramitacoes { texto }
GET  /api/dashboard/summary?userId=  (escopo por role)
GET  /api/tasks/resumo              texto pronto p/ botão Resumo (respeita filtros via query)
GET  /api/tasks/calendar?start=&end= eventos do calendário
GET  /api/settings  PUT /api/settings   (PUT só ADMIN)
```

## Funcionalidades entregues

- [x] Login + JWT + troca de senha + editar perfil
- [x] Painel admin: usuários (criar/excluir/atribuir role e gestor) + configurações do site
- [x] Área por tarefa + Origens N:N por tarefa, ambas configuráveis pelo próprio usuário
- [x] Tramitações (timeline por tarefa)
- [x] Calendário nativo (grade mensal, clica no dia filtra tarefas)
- [x] Dashboard: usuário vê o seu; gestor vê agregado dos gerenciados+self; admin vê tudo (filtro por usuário)
- [x] Botão Resumo por usuário (modal com texto copiável)
