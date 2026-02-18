import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://10.0.30.251:9494';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Interceptor para tratamento de erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // console.error('API Error:', error.message);
    // console.error('URL:', error.config?.url);
    // console.error('Status:', error.response?.status);
    return Promise.reject(error);
  }
);

// Funções da API
export const apiService = {
  // Dados do dia - COM LOGS DETALHADOS
  getTodayData: async (setor = 'suporte', forceRefresh = false) => {
    try {
      const params = { setor };
      if (forceRefresh) {
        params.force_refresh = 'true';
        params._t = new Date().getTime(); // Timestamp para evitar cache
        // console.log(`🟢🔄 TODAY DATA - FORÇANDO REFRESH para setor: ${setor}`);
      } else {
        // console.log(`🟢 TODAY DATA - Consulta normal para setor: ${setor}`);
      }
      
      // console.log('📡 Parâmetros da requisição (hoje):', params);
      const response = await api.get('/api/dados/hoje', { params });
      // console.log('✅ TODAY data recebida:', response.data?.data?.length || 0, 'registros');
      // console.log('🕐 Última atualização:', response.data?.atualizado_em || 'N/A');
      return response.data;
    } catch (error) {
      // console.error('🔴 Erro ao buscar dados de hoje:', error.message);
      return {
        data: [],
        totais: { ligacoesOferecidas: 0, ligacoesOferecidasAtendidas: 0, percentualOferecidasAtendidas: 0 },
        atualizado_em: new Date().toISOString(),
        setor
      };
    }
  },

  // Dados do mês - COM LOGS DETALHADOS
  getMonthData: async (setor = 'suporte', forceRefresh = false) => {
    try {
      const params = { setor };
      if (forceRefresh) {
        params.force_refresh = 'true';
        params._t = new Date().getTime(); // Timestamp para evitar cache
        // console.log(`🟠🔄 MONTH DATA - FORÇANDO REFRESH para setor: ${setor}`);
      } else {
        // console.log(`🟠 MONTH DATA - Consulta normal para setor: ${setor}`);
      }
      
      // console.log('📡 Parâmetros da requisição (mês):', params);
      const response = await api.get('/api/dados/mes', { params });
      // console.log('✅ MONTH data recebida:', response.data?.data?.length || 0, 'registros');
      return response.data;
    } catch (error) {
      // console.error('🔴 Erro ao buscar dados do mês:', error.message);
      return {
        data: [],
        totais: { ligacoesOferecidas: 0, ligacoesOferecidasAtendidas: 0, percentualOferecidasAtendidas: 0 },
        atualizado_em: new Date().toISOString(),
        setor
      };
    }
  },

  // Dados dos últimos 7 dias
  getLast7DaysData: async (setor = 'suporte', forceRefresh = false) => {
    try {
      const params = { setor };
      if (forceRefresh) {
        params.force_refresh = 'true';
      }
      // console.log('🔵 Fetching last 7 days data with params:', params);
      const response = await api.get('/api/dados/ultimos-7-dias', { params });
      // console.log('✅ Last 7 days data received:', response.data?.data?.length || 0, 'records');
      return response.data;
    } catch (error) {
      // console.error('🔴 Error fetching last 7 days data:', error);
      return null;
    }
  },

  // Dados de ligações ativas no mês (com fallback específico por setor)
  getLigacoesAtivasMes: async (setor = 'suporte', forceRefresh = false) => {
    try {
      const params = { setor };
      if (forceRefresh) {
        params.force_refresh = 'true';
        params._t = new Date().getTime();
        // console.log(`🟣🔄 LIGAÇÕES ATIVAS - FORÇANDO REFRESH para setor: ${setor}`);
      } else {
        // console.log(`🟣 LIGAÇÕES ATIVAS - Consulta normal para setor: ${setor}`);
      }
      
      // console.log('📡 Parâmetros da requisição (ativas):', params);
      const response = await api.get('/api/dados/ligacoes-ativas-mes', { params });
      // console.log('✅ LIGAÇÕES ATIVAS recebidas:', response.data?.data?.length || 0, 'registros');
      return response.data;
    } catch (error) {
      // console.warn('⚠️ API de ligações ativas não disponível, usando fallback:', error.message);
      
      // Cria dados vazios como fallback, baseado no setor
      let atendentes = [];
      
      if (setor === 'suporte') {
        atendentes = [
          { codigo: "4002", nome: "Pedro Henrique" },
          { codigo: "4004", nome: "João Miyake" },
          { codigo: "4006", nome: "Gabriel Rosa" },
          { codigo: "4008", nome: "Gabriel Brambila (Estagiário)" },
          { codigo: "4009", nome: "Marcos Moraes (Estagiário)" },
          { codigo: "4021", nome: "Rodrigo Akira" },
          { codigo: "4025", nome: "Alison da Silva" },
          { codigo: "4027", nome: "Pedro Chaves (Estagiário)" },
          { codigo: "4028", nome: "Ryan da Silva (Estagiário)" },
          { codigo: "4029", nome: "Samuel Mendes (Estagiário)" },
          { codigo: "4030", nome: "Pedro Boni" },
          { codigo: "4031", nome: "Rafael Guedes" },
          { codigo: "4032", nome: "Ricardo Correa" },
          { codigo: "4033", nome: "João Silva (Estagiario)" }
        ];
      } else if (setor === 'comercial') {
        atendentes = [
          { codigo: "1201", nome: "Gustavo Leônidas" },
          { codigo: "1204", nome: "Tamires Cavalcante" },
          { codigo: "1205", nome: "Miguel Roveda" },
          { codigo: "1208", nome: "Rennan Taioqui" },
          { codigo: "1210", nome: "Rodrigo Boani" },
          { codigo: "4016", nome: "Henrique Alves" }
        ];
      }
      
      return {
        data: atendentes.map(atendente => ({
          nome: atendente.nome,
          codigo: atendente.codigo,
          ligacoesAtivasMes: 0
        })),
        totais: { ligacoesAtivasMes: 0 },
        atualizado_em: new Date().toISOString(),
        setor,
        cache_info: { cached: false, fallback: true }
      };
    }
  },

  // Dados de ligações recuperadas (dia e mês) - COM LOGS DETALHADOS
  getLigacoesRecuperadas: async (setor = 'suporte', forceRefresh = false) => {
    try {
      const params = { setor };
      if (forceRefresh) {
        params.force_refresh = 'true';
        params._t = new Date().getTime(); // Timestamp para evitar cache
        // console.log(`🟡🔄 LIGAÇÕES RECUPERADAS - FORÇANDO REFRESH para setor: ${setor}`);
      } else {
        // console.log(`🟡 LIGAÇÕES RECUPERADAS - Consulta normal para setor: ${setor}`);
      }
      
      // console.log('📡 Parâmetros da requisição (recuperadas):', params);
      const response = await api.get('/api/dados/ligacoes-recuperadas', { params });
      console.log('✅ LIGAÇÕES RECUPERADAS recebidas:', {
        dia: response.data?.dia?.length || 0,
        mes: response.data?.mes?.length || 0,
        totais: response.data?.totais
      });
      return response.data;
    } catch (error) {
      // console.warn('⚠️ API de ligações recuperadas não disponível, usando fallback:', error.message);
      
      // Cria dados vazios como fallback, baseado no setor
      let atendentes = [];
      
      if (setor === 'suporte') {
        atendentes = [
          { codigo: "4002", nome: "Pedro Henrique" },
          { codigo: "4004", nome: "João Miyake" },
          { codigo: "4006", nome: "Gabriel Rosa" },
          { codigo: "4008", nome: "Gabriel Brambila (Estagiário)" },
          { codigo: "4009", nome: "Marcos Moraes (Estagiário)" },
          { codigo: "4021", nome: "Rodrigo Akira" },
          { codigo: "4025", nome: "Alison da Silva" },
          { codigo: "4027", nome: "Pedro Chaves (Estagiário)" },
          { codigo: "4028", nome: "Ryan da Silva (Estagiário)" },
          { codigo: "4029", nome: "Samuel Mendes (Estagiário)" },
          { codigo: "4030", nome: "Pedro Boni" },
          { codigo: "4031", nome: "Rafael Guedes" },
          { codigo: "4032", nome: "Ricardo Correa" },
          { codigo: "4033", nome: "João Silva (Estagiario)" }
        ];
      } else if (setor === 'comercial') {
        atendentes = [
          { codigo: "1201", nome: "Gustavo Leônidas" },
          { codigo: "1204", nome: "Tamires Cavalcante" },
          { codigo: "1205", nome: "Miguel Roveda" },
          { codigo: "1208", nome: "Rennan Taioqui" },
          { codigo: "1210", nome: "Rodrigo Boani" },
          { codigo: "4016", nome: "Henrique Alves" }
        ];
      }
      
      return {
        dia: atendentes.map(atendente => ({
          nome: atendente.nome,
          codigo: atendente.codigo,
          ligacoesRecuperadasDia: 0
        })),
        mes: atendentes.map(atendente => ({
          nome: atendente.nome,
          codigo: atendente.codigo,
          ligacoesRecuperadasMes: 0
        })),
        totais: {
          ligacoesRecuperadasDia: 0,
          ligacoesRecuperadasMes: 0
        },
        atualizado_em: new Date().toISOString(),
        setor,
        cache_info: { cached: false, fallback: true }
      };
    }
  },
  
  forceUpdateAll: async (setor = 'suporte') => {
    const response = await api.post('/api/atualizar-tudo', { setor });
    return response.data;
  },

  getCacheStatus: async () => {
    const response = await api.get('/api/status-cache');
    return response.data;
  },

  getServerStatus: async () => {
    const response = await api.get('/api/status');
    return response.data;
  },

  getSetores: async () => {
    const response = await api.get('/api/setores');
    return response.data;
  }
};