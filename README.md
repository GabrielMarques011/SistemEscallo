# 📞 SistemEscallo

> Sistema fullstack de monitoramento do fluxo de ligações de entrada, saída e recuperadas pelos agentes do suporte e comercial.

---

## 📋 Sobre o Projeto

O **SistemEscallo** é uma aplicação **fullstack** desenvolvida para monitorar e centralizar em tempo real o fluxo de chamadas telefônicas realizadas e recebidas pelos agentes das equipes de **suporte técnico** e **comercial**.

O sistema consome dados da plataforma de telefonia **Escallo** (ou similar) via API, processa as métricas de ligações e as exibe em um **dashboard interativo**, permitindo que gestores e coordenadores acompanhem a produtividade da equipe, identifiquem gargalos e tomem decisões baseadas em dados concretos — sem precisar acessar diretamente o painel da operadora.

### Problemas que resolve

- Falta de visibilidade em tempo real sobre o volume de ligações da equipe
- Dificuldade em identificar chamadas perdidas ou não recuperadas
- Ausência de métricas consolidadas por agente, equipe ou período
- Necessidade de acessar múltiplos sistemas para ter uma visão completa do atendimento

---

## 🏗️ Arquitetura

O projeto é organizado em duas camadas independentes que se comunicam via API REST:

```
SistemEscallo/
│
├── back-end/                    # ⚙️  API e coleta de dados (Python)
│
├── front-end/
│   └── sistemescallo/           # 🎨 Interface web (JavaScript/React)
│
└── README.md
```

### Stack Tecnológica

| Camada | Tecnologia | Proporção |
|--------|-----------|-----------|
| Frontend | JavaScript (React) | ~53% |
| Backend | Python | ~45% |
| Outros | CSS, HTML, configs | ~2% |

A distribuição quase equilibrada entre Python e JavaScript reflete um backend robusto com lógica de coleta e processamento de dados, e um frontend rico em interatividade para exibição dos dashboards.

---

## 🎨 Frontend — `front-end/sistemescallo`

Interface web desenvolvida em **JavaScript/React**, responsável por apresentar os dados de ligações de forma visual e intuitiva. Funcionalidades esperadas:

- **Dashboard principal** com métricas em tempo real: total de ligações, duração média, taxa de recuperação
- **Tabelas e gráficos** com o histórico de ligações por agente, equipe e período
- **Filtros dinâmicos** por data, agente, tipo de ligação (entrada / saída / recuperada)
- **Indicadores visuais** de performance individual e coletiva
- **Alertas** para chamadas não atendidas ou fora do padrão esperado

### Estrutura típica do frontend

```
front-end/sistemescallo/
│
├── public/                  # Arquivos estáticos e index.html
├── src/
│   ├── components/          # Componentes reutilizáveis (cards, tabelas, gráficos)
│   ├── pages/               # Páginas (Dashboard, Relatórios, Agentes)
│   ├── services/            # Integração com o backend via HTTP
│   ├── hooks/               # Lógica de estado e efeitos
│   └── App.js               # Componente raiz e rotas
├── package.json
└── .env                     # URL da API do backend
```

---

## ⚙️ Backend — `back-end`

Camada servidor desenvolvida em **Python**, responsável por:

- **Coletar dados** da API da plataforma Escallo (telefonia) em intervalos regulares
- **Processar e classificar** as ligações por tipo: entrada, saída e recuperadas
- **Agregar métricas** por agente, equipe e janela de tempo
- **Expor endpoints REST** consumidos pelo frontend
- **Armazenar histórico** das ligações para consulta posterior

### Estrutura típica do backend

```
back-end/
│
├── app.py / main.py         # Ponto de entrada e configuração da API
├── routes/                  # Endpoints REST expostos ao frontend
├── services/
│   ├── escallo_api.py       # Integração com a API da plataforma Escallo
│   └── processamento.py     # Lógica de classificação e agregação de métricas
├── models/                  # Estruturas de dados e schemas
├── config/                  # Variáveis de ambiente e configurações
└── requirements.txt         # Dependências Python
```

---

## 📊 Tipos de Ligações Monitoradas

| Tipo | Descrição |
|------|-----------|
| 📥 **Entrada** | Chamadas recebidas pelos agentes vindas de clientes |
| 📤 **Saída** | Chamadas realizadas proativamente pelos agentes |
| 🔄 **Recuperadas** | Chamadas perdidas que foram retornadas com sucesso pelo agente |

Cada tipo de ligação é rastreado individualmente por agente, permitindo uma análise granular da performance de cada colaborador e do time como um todo.

---

## 🔄 Fluxo do Sistema

```
[Plataforma Escallo / Telefonia]
          │
          │  API de ligações
          ▼
    [Backend Python]
    • Coleta periódica de dados
    • Classifica por tipo (entrada/saída/recuperada)
    • Agrega métricas por agente e período
    • Expõe API REST
          │
          │  HTTP/REST (JSON)
          ▼
  [Frontend React/JS]
    • Dashboard com gráficos e métricas
    • Filtros por agente, data, tipo
    • Visualização em tempo real
          │
          ▼
   [Gestor / Coordenador]
    • Acompanha produtividade
    • Identifica gargalos
    • Toma decisões baseadas em dados
```

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos

- [Node.js](https://nodejs.org/) v16+
- [Python](https://www.python.org/) 3.8+
- `npm` ou `yarn`
- `pip`
- Credenciais de acesso à API da plataforma Escallo

---

### ⚙️ Backend

```bash
# 1. Entre na pasta do backend
cd back-end

# 2. Crie e ative o ambiente virtual
python -m venv venv
source venv/bin/activate      # Linux/macOS
venv\Scripts\activate         # Windows

# 3. Instale as dependências
pip install -r requirements.txt

# 4. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais da API Escallo

# 5. Inicie o servidor
python app.py
```

Backend disponível em: `http://localhost:5000`

---

### 🎨 Frontend

```bash
# 1. Entre na pasta do frontend
cd front-end/sistemescallo

# 2. Instale as dependências
npm install

# 3. Configure a URL do backend
echo "REACT_APP_API_URL=http://localhost:5000" > .env

# 4. Inicie o servidor de desenvolvimento
npm start
```

Frontend disponível em: `http://localhost:3000`

---

## 🔐 Variáveis de Ambiente

### Backend (`.env`)

```env
# Plataforma de telefonia (Escallo ou similar)
ESCALLO_API_URL=https://api.escallo.com.br
ESCALLO_API_KEY=sua_chave_aqui
ESCALLO_ACCOUNT_ID=seu_id_de_conta

# Configurações do servidor
PORT=5000
DEBUG=True

# Intervalo de coleta (em segundos)
POLLING_INTERVAL=60
```

### Frontend (`.env`)

```env
REACT_APP_API_URL=http://localhost:5000
```

> ⚠️ **Nunca** commite arquivos `.env` com credenciais reais. Adicione-os ao `.gitignore`.

---

## 📦 Dependências Principais

### Backend (Python)

| Pacote | Descrição |
|--------|-----------|
| `flask` ou `fastapi` | Framework web para a API REST |
| `requests` | Requisições HTTP para a API Escallo |
| `python-dotenv` | Gerenciamento de variáveis de ambiente |
| `flask-cors` | Habilita CORS para comunicação com o React |
| `schedule` | Coleta periódica de dados da telefonia |

### Frontend (JavaScript)

| Pacote | Descrição |
|--------|-----------|
| `react` | Biblioteca principal de UI |
| `react-router-dom` | Roteamento entre páginas |
| `axios` | Requisições HTTP ao backend |
| `recharts` e `chart.js` | Gráficos e visualizações de dados |

---

## 🌐 Endpoints da API (Backend)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/ligacoes` | Lista todas as ligações com filtros opcionais |
| `GET` | `/ligacoes/entrada` | Retorna apenas ligações de entrada |
| `GET` | `/ligacoes/saida` | Retorna apenas ligações de saída |
| `GET` | `/ligacoes/recuperadas` | Retorna ligações recuperadas |
| `GET` | `/agentes` | Lista agentes e suas métricas consolidadas |
| `GET` | `/metricas` | Resumo geral de performance (totais, médias, taxas) |
| `GET` | `/metricas?periodo=hoje` | Métricas filtradas por período |

---

## 📈 Métricas Acompanhadas

- Total de ligações por tipo (entrada / saída / recuperadas)
- Volume de chamadas por agente e por equipe
- Duração média das ligações
- Taxa de recuperação de chamadas perdidas
- Comparativo de performance entre agentes
- Evolução histórica por período (dia, semana, mês)

---

## 🛠️ Deploy em Produção

**Frontend — build otimizado:**

```bash
cd front-end/sistemescallo
npm run build
# Sirva a pasta /build com Nginx, Vercel ou similar
```

**Backend — com Gunicorn:**

```bash
cd back-end
pip install gunicorn
gunicorn app:app --workers 4 --bind 0.0.0.0:5000
```

**Processos contínuos com PM2:**

```bash
npm install -g pm2

pm2 start "python app.py" --name "escallo-backend" --cwd ./back-end
pm2 start "npm start" --name "escallo-frontend" --cwd ./front-end/sistemescallo
pm2 startup && pm2 save
```

---

## 🌟 Diferenciais do Sistema

- **Centralização de dados** — Consolida métricas de ligações de suporte e comercial em um único painel
- **Visibilidade em tempo real** — Gestores acompanham o fluxo de chamadas sem depender de relatórios manuais
- **Separação por equipes** — Monitoramento independente para suporte e comercial
- **Arquitetura desacoplada** — Frontend e backend independentes, fáceis de escalar e manter
- **Histórico completo** — Rastreamento de ligações recuperadas, métrica crucial para equipes de atendimento

---

## 👤 Autor

**Gabriel Marques**
- GitHub: [@GabrielMarques011](https://github.com/GabrielMarques011)

---

## 📄 Licença

Este projeto não possui uma licença definida. Entre em contato com o autor para mais informações sobre uso e distribuição.