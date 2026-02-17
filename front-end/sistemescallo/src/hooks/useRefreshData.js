import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

const useRefreshData = (setor = 'suporte', refreshInterval = 3600000) => {
  const [todayData, setTodayData] = useState(null);
  const [monthData, setMonthData] = useState(null);
  const [ligacoesAtivasData, setLigacoesAtivasData] = useState(null);
  const [ligacoesRecuperadasData, setLigacoesRecuperadasData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    console.log('🚀🚀 INICIANDO FETCHDATA COMPLETO 🚀🚀');
    console.log(`📌 Setor: ${setor}`);
    console.log(`📌 Forçar refresh: ${forceRefresh ? 'SIM ✅' : 'NÃO (usar cache)'}`);
    
    setLoading(true);
    
    try {
      console.log('📡📡 FAZENDO 4 REQUISIÇÕES PARALELAS 📡📡');
      
      const [today, month, ligacoesAtivas, ligacoesRecuperadas] = await Promise.all([
        apiService.getTodayData(setor, forceRefresh),
        apiService.getMonthData(setor, forceRefresh),
        apiService.getLigacoesAtivasMes(setor, forceRefresh),
        apiService.getLigacoesRecuperadas(setor, forceRefresh)
      ]);
      
      console.log('✅✅ TODOS OS DADOS RECEBIDOS ✅✅', {
        hoje: today?.data?.length || 0,
        mes: month?.data?.length || 0,
        ativas: ligacoesAtivas?.data?.length || 0,
        recuperadasDia: ligacoesRecuperadas?.dia?.length || 0,
        recuperadasMes: ligacoesRecuperadas?.mes?.length || 0
      });
      
      // Verifique se os dados foram atualizados
      console.log('📊 Comparando com dados anteriores:');
      console.log('- Dados de hoje:', today?.atualizado_em || 'N/A');
      console.log('- Dados do mês:', month?.atualizado_em || 'N/A');
      
      setTodayData(today);
      setMonthData(month);
      setLigacoesAtivasData(ligacoesAtivas);
      setLigacoesRecuperadasData(ligacoesRecuperadas);
      setLastUpdate(new Date());
      setError(null);
      
      console.log('🎉🎉 FETCHDATA CONCLUÍDO COM SUCESSO 🎉🎉');
      
    } catch (err) {
      console.error('❌❌ ERRO AO BUSCAR DADOS ❌❌', err);
      setError('Erro ao carregar dados do servidor');
    } finally {
      setLoading(false);
      console.log('🏁🏁 FETCHDATA FINALIZADO 🏁🏁');
    }
  }, [setor]);

  const refreshData = useCallback((forceRefresh = false) => {
    console.log(`🔄🔄 REFRESH MANUAL SOLICITADO 🔄🔄`);
    console.log(`📌 Setor: ${setor}`);
    console.log(`📌 Force Refresh: ${forceRefresh ? 'SIM (forçar API)' : 'NÃO (usar cache se disponível)'}`);
    fetchData(forceRefresh);
  }, [fetchData, setor]);

  // Atualizar dados quando o setor muda
  useEffect(() => {
    console.log(`🎯🎯 SETOR ALTERADO ou COMPONENTE MONTADO 🎯🎯`);
    console.log(`📌 Setor atual: ${setor}`);
    fetchData(false);
  }, [fetchData, setor]);

  useEffect(() => {
    if (refreshInterval <= 0) return;

    console.log(`⏰⏰ CONFIGURANDO AUTO-REFRESH ⏰⏰`);
    console.log(`📌 Intervalo: ${refreshInterval / 60000} minutos`);
    console.log(`📌 Setor: ${setor}`);
    
    const intervalId = setInterval(() => {
      console.log('🔄🔄 AUTO-REFRESH DISPARADO 🔄🔄');
      fetchData(false);
    }, refreshInterval);

    return () => {
      console.log('🧹🧹 LIMPANDO INTERVALO DE AUTO-REFRESH 🧹🧹');
      clearInterval(intervalId);
    };
  }, [fetchData, refreshInterval, setor]);

  return {
    todayData,
    monthData,
    ligacoesAtivasData,
    ligacoesRecuperadasData,
    loading,
    error,
    lastUpdate,
    refreshData,
    fetchData
  };
};

export default useRefreshData;