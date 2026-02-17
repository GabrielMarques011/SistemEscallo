// pages/Home.js
import React, { useState, useMemo } from 'react';
import CollaboratorCard from '../components/CollaboratorCard';
import { FiUsers, FiPhone, FiPercent, FiFilter, FiTrendingUp, FiAward, FiActivity, FiBriefcase, FiUser, FiClock, FiRefreshCw, FiCalendar } from 'react-icons/fi';

const Home = ({ todayData, monthData, ligacoesRecuperadasData, loading, error, setor }) => {
  const [filter, setFilter] = useState('all');

  // Função para obter o label do setor
  const getSetorLabel = () => {
    return setor === 'suporte' ? 'Suporte' : 'Comercial';
  };

  // Função para obter a cor do setor
  const getSetorColor = () => {
    return setor === 'suporte' ? 'blue' : 'green';
  };

  // Função para obter o ícone do setor
  const getSetorIcon = () => {
    return setor === 'suporte' ? FiActivity : FiBriefcase;
  };

  // Função para obter dados do mês de um colaborador
  const getDadosMesColaborador = (codigo) => {
    if (!monthData || !monthData.data || monthData.data.length === 0) {
      return {
        ligacoesOferecidasAtendidas: 0,
        tma: '0:00'
      };
    }
    
    const colaboradorMes = monthData.data.find(item => item.codigo === codigo);
    
    return {
      ligacoesOferecidasAtendidas: colaboradorMes?.ligacoesOferecidasAtendidas || 0,
      tma: colaboradorMes?.tma || '0:00'
    };
  };

  // Função para converter TMA para segundos
  const tmaToSeconds = (tma) => {
    if (!tma) return 0;
    
    const cleanTma = tma.toString().trim();
    
    if (/^\d+$/.test(cleanTma)) {
      return parseInt(cleanTma, 10);
    }
    
    const parts = cleanTma.split(':').map(Number);
    
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      return parts[0];
    }
    
    return 0;
  };

  // Função para obter ligações recuperadas de um colaborador
  const getLigacoesRecuperadasColaborador = (codigo) => {
    if (!ligacoesRecuperadasData) return { dia: 0, mes: 0 };
    
    const dia = ligacoesRecuperadasData.dia?.find(item => item.codigo === codigo);
    const mes = ligacoesRecuperadasData.mes?.find(item => item.codigo === codigo);
    
    return {
      dia: dia?.ligacoesRecuperadasDia || 0,
      mes: mes?.ligacoesRecuperadasMes || 0
    };
  };

  // Função para calcular total de ligações atendidas no mês
  const getLigacoesAtendidasMesTotal = () => {
    if (!monthData || !monthData.data || monthData.data.length === 0) return 0;
    
    return monthData.data.reduce((total, colaborador) => {
      return total + (colaborador.ligacoesOferecidasAtendidas || 0);
    }, 0);
  };

  // Função para calcular total de ligações oferecidas no mês
  const getLigacoesOferecidasMesTotal = () => {
    if (!monthData || !monthData.data || monthData.data.length === 0) return 0;
    
    return monthData.data.reduce((total, colaborador) => {
      return total + (colaborador.ligacoesOferecidas || 0);
    }, 0);
  };

  // Função para calcular percentual de atendidas no mês
  const getPercentualAtendidasMes = () => {
    const oferecidas = getLigacoesOferecidasMesTotal();
    const atendidas = getLigacoesAtendidasMesTotal();
    
    if (oferecidas === 0) return 0;
    return (atendidas / oferecidas) * 100;
  };

  // Função para obter estatísticas
  const getStats = () => {
    if (!todayData || !todayData.data) {
      return {
        totalCollaborators: 0,
        totalCalls: 0,
        answeredCalls: 0,
        avgPerformance: 0
      };
    }
    
    const filtered = todayData.data.filter(collaborator => {
      if (filter === 'estagiarios') {
        return collaborator.nome.includes('(Estagiário)') || collaborator.nome.includes('(Estagiario)');
      }
      if (filter === 'efetivos') {
        return !collaborator.nome.includes('(Estagiário)') && !collaborator.nome.includes('(Estagiario)');
      }
      return true;
    });
    
    return {
      totalCollaborators: filtered.length,
      totalCalls: filtered.reduce((acc, c) => acc + (c.ligacoesOferecidas || 0), 0),
      answeredCalls: filtered.reduce((acc, c) => acc + (c.ligacoesOferecidasAtendidas || 0), 0),
      avgPerformance: filtered.length > 0 
        ? filtered.reduce((acc, c) => acc + (c.percentualOferecidasAtendidas || 0), 0) / filtered.length 
        : 0
    };
  };

  // Função para obter colaboradores filtrados e ordenados
  const getFilteredAndSortedCollaborators = () => {
    if (!todayData || !todayData.data) return [];
    
    let filtered = todayData.data.filter(collaborator => {
      if (filter === 'estagiarios') {
        return collaborator.nome.includes('(Estagiário)') || collaborator.nome.includes('(Estagiario)');
      }
      if (filter === 'efetivos') {
        return !collaborator.nome.includes('(Estagiário)') && !collaborator.nome.includes('(Estagiario)');
      }
      return true;
    });

    // Ordenação para a lista geral (mantida igual)
    return [...filtered].sort((a, b) => {
      // 1. Prioridade: Percentual de aproveitamento (maior é melhor)
      const percentualA = a.percentualOferecidasAtendidas || 0;
      const percentualB = b.percentualOferecidasAtendidas || 0;
      
      if (Math.abs(percentualB - percentualA) > 0.1) {
        return percentualB - percentualA;
      }
      
      // 2. Desempate: Quantidade de atendimentos (maior é melhor)
      const atendimentosA = a.ligacoesOferecidasAtendidas || 0;
      const atendimentosB = b.ligacoesOferecidasAtendidas || 0;
      
      if (atendimentosB !== atendimentosA) {
        return atendimentosB - atendimentosA;
      }
      
      // 3. Desempate: TMA (menor é melhor)
      const tmaA = tmaToSeconds(a.tma);
      const tmaB = tmaToSeconds(b.tma);
      
      return tmaA - tmaB;
    });
  };

  // Função para obter top 3 performers
  const getTopPerformers = () => {
    const filteredCollaborators = getFilteredAndSortedCollaborators();
    
    if (filteredCollaborators.length === 0) return [];
    
    // 1. Filtrar apenas colaboradores com aproveitamento > 90%
    const colaboradoresAcima90 = filteredCollaborators.filter(collaborator => {
      return (collaborator.percentualOferecidasAtendidas || 0) > 90;
    });

    if (colaboradoresAcima90.length === 0) return [];

    // 2. Ordenar pelo TOP 3 seguindo as métricas
    const top3Ordenado = [...colaboradoresAcima90].sort((a, b) => {
      // Primeira métrica: Percentual de aproveitamento (já garantido > 90%)
      const percentualA = a.percentualOferecidasAtendidas || 0;
      const percentualB = b.percentualOferecidasAtendidas || 0;
      
      if (Math.abs(percentualB - percentualA) > 0.1) {
        return percentualB - percentualA;
      }
      
      // Segunda métrica: Se porcentagens iguais, quem tiver mais atendidas no dia
      const atendidasDiaA = a.ligacoesOferecidasAtendidas || 0;
      const atendidasDiaB = b.ligacoesOferecidasAtendidas || 0;
      
      if (atendidasDiaB !== atendidasDiaA) {
        return atendidasDiaB - atendidasDiaA;
      }
      
      // Terceira métrica: Se atendidas no dia iguais, quem atendeu mais no mês
      const dadosMesA = getDadosMesColaborador(a.codigo);
      const dadosMesB = getDadosMesColaborador(b.codigo);
      
      const atendidasMesA = dadosMesA.ligacoesOferecidasAtendidas;
      const atendidasMesB = dadosMesB.ligacoesOferecidasAtendidas;
      
      if (atendidasMesB !== atendidasMesA) {
        return atendidasMesB - atendidasMesA;
      }
      
      // Quarta métrica: Se atendidas no mês iguais, quem tem TMA menor no mês
      const tmaMesA = tmaToSeconds(dadosMesA.tma);
      const tmaMesB = tmaToSeconds(dadosMesB.tma);
      
      return tmaMesA - tmaMesB;
    });

    // Pegar apenas os 3 primeiros
    return top3Ordenado.slice(0, 3);
  };

  // Use useMemo para otimização
  const filteredCollaborators = useMemo(() => getFilteredAndSortedCollaborators(), [todayData, filter]);
  const topPerformers = useMemo(() => getTopPerformers(), [filteredCollaborators, monthData]);
  const stats = useMemo(() => getStats(), [todayData, filter]);

  // Cálculos para o mês
  const ligacoesAtendidasMes = getLigacoesAtendidasMesTotal();
  const ligacoesOferecidasMes = getLigacoesOferecidasMesTotal();
  const percentualAtendidasMes = getPercentualAtendidasMes();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-700 border-t-blue-500 mx-auto"></div>
            <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-gray-700 opacity-20 mx-auto"></div>
          </div>
          <p className="mt-6 text-gray-400 font-medium">Carregando dados do dashboard...</p>
          <p className="text-sm text-gray-500 mt-2">Setor: {getSetorLabel()}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Erro ao carregar dados</h2>
          <p className="text-gray-400 leading-relaxed">{error}</p>
          <p className="text-sm text-gray-500 mt-2 mb-4">Setor: {getSetorLabel()}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const SetorIcon = getSetorIcon();

  const StatCard = ({ title, value, subtitle, icon: Icon, color = 'blue', trend }) => {
    const colors = {
      blue: {
        icon: 'from-blue-500 to-blue-600',
        bg: 'from-blue-500/5 to-blue-600/5',
        border: 'border-blue-500/10',
        text: 'text-blue-400'
      },
      green: {
        icon: 'from-green-500 to-green-600',
        bg: 'from-green-500/5 to-green-600/5',
        border: 'border-green-500/10',
        text: 'text-green-400'
      },
      purple: {
        icon: 'from-purple-500 to-purple-600',
        bg: 'from-purple-500/5 to-purple-600/5',
        border: 'border-purple-500/10',
        text: 'text-purple-400'
      },
      amber: {
        icon: 'from-amber-500 to-amber-600',
        bg: 'from-amber-500/5 to-amber-600/5',
        border: 'border-amber-500/10',
        text: 'text-amber-400'
      },
      indigo: {
        icon: 'from-indigo-500 to-indigo-600',
        bg: 'from-indigo-500/5 to-indigo-600/5',
        border: 'border-indigo-500/10',
        text: 'text-indigo-400'
      }
    };

    const colorScheme = colors[color] || colors.blue;

    return (
      <div className={`relative overflow-hidden bg-gradient-to-br ${colorScheme.bg} backdrop-blur-sm rounded-2xl border ${colorScheme.border} p-6 hover:border-opacity-30 transition-all duration-300 group`}>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorScheme.icon} flex items-center justify-center shadow-lg`}>
              <Icon size={22} className="text-white" />
            </div>
            {trend && (
              <span className={`text-sm font-semibold ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className={`text-3xl font-bold text-white tracking-tight`}>
              {value}
            </div>
            <div className="text-sm font-medium text-gray-300">{title}</div>
            {subtitle && (
              <div className="text-xs text-gray-500 leading-relaxed">{subtitle}</div>
            )}
          </div>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500"></div>
      </div>
    );
  };

  const FilterButton = ({ active, onClick, children, count }) => (
    <button
      onClick={onClick}
      className={`relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
          : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-300 border border-gray-700/50'
      }`}
    >
      <span className="flex items-center gap-2">
        {children}
        {count !== undefined && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            active ? 'bg-white/20' : 'bg-gray-700/50'
          }`}>
            {count}
          </span>
        )}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header com Setor */}
        <div className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${setor === 'suporte' ? 'from-blue-500 to-blue-600' : 'from-green-500 to-green-600'} flex items-center justify-center shadow-lg`}>
                <SetorIcon className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Dashboard de {getSetorLabel()}
                </h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  {setor === 'suporte' 
                    ? 'Monitoramento da equipe de suporte técnico' 
                    : 'Monitoramento da equipe comercial'}
                </p>
              </div>
            </div>
            
            {/* Badge do Setor */}
            <div className={`px-4 py-2 rounded-lg ${setor === 'suporte' ? 'bg-gradient-to-r from-blue-600/20 to-blue-700/20 border border-blue-500/30' : 'bg-gradient-to-r from-green-600/20 to-green-700/20 border border-green-500/30'}`}>
              <div className="flex items-center gap-2">
                <SetorIcon size={16} className={setor === 'suporte' ? 'text-blue-400' : 'text-green-400'} />
                <span className={`font-semibold ${setor === 'suporte' ? 'text-blue-300' : 'text-green-300'}`}>
                  Setor: {getSetorLabel()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Estatísticas Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
          <StatCard
            title="Colaboradores"
            value={stats.totalCollaborators}
            subtitle={`Total no ${getSetorLabel()}`}
            icon={FiUsers}
            color={setor === 'suporte' ? 'blue' : 'green'}
          />

          <StatCard
            title="Ligações Recebidas Hoje"
            value={stats.totalCalls.toLocaleString('pt-BR')}
            subtitle={`Total de oferecidas (${getSetorLabel()})`}
            icon={FiPhone}
            color="purple"
          />

          <StatCard
            title="Ligações Atendidas Hoje"
            value={stats.answeredCalls.toLocaleString('pt-BR')}
            subtitle={`${stats.totalCalls > 0 ? ((stats.answeredCalls / stats.totalCalls) * 100).toFixed(1) : 0}% do total`}
            icon={FiPhone}
            color={setor === 'suporte' ? 'blue' : 'green'}
          />

          <StatCard
            title="Ligações Recuperadas"
            value={ligacoesRecuperadasData?.totais?.ligacoesRecuperadasDia || 0}
            subtitle={`${ligacoesRecuperadasData?.totais?.ligacoesRecuperadasMes || 0} no mês`}
            icon={FiRefreshCw}
            color="purple"
          />

          <StatCard
            title="Ligações Atendidas no Mês"
            value={ligacoesAtendidasMes.toLocaleString('pt-BR')}
            subtitle={`${percentualAtendidasMes.toFixed(1)}% de ${ligacoesOferecidasMes.toLocaleString('pt-BR')} oferecidas`}
            icon={FiCalendar}
            color="amber"
          />
        </div>

        {/* Top 3 Performers - Apenas se houver colaboradores com aproveitamento > 90% */}
        {topPerformers.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${setor === 'suporte' ? 'from-blue-500 to-blue-600' : 'from-green-500 to-green-600'} flex items-center justify-center shadow-lg`}>
                <FiAward className="text-white" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Top 3 do {getSetorLabel()}</h2>
                <p className="text-sm text-gray-400">Melhores desempenhos do dia (aproveitamento maior que 90%)</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {topPerformers.map((collaborator, index) => {
                const recuperadas = getLigacoesRecuperadasColaborador(collaborator.codigo);
                const dadosMes = getDadosMesColaborador(collaborator.codigo);
                
                return (
                  <div key={collaborator.codigo} className="relative">
                    {index === 0 && (
                      <div className={`absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-br ${setor === 'suporte' ? 'from-blue-400 to-blue-600' : 'from-green-400 to-green-600'} rounded-full flex items-center justify-center shadow-lg z-10 border-2 border-gray-900`}>
                        <span className="text-xs font-bold text-white">👑</span>
                      </div>
                    )}
                    <div className="relative">
                      <CollaboratorCard 
                        collaborator={collaborator} 
                        ligacoesRecuperadasDia={recuperadas.dia}
                        ligacoesRecuperadasMes={recuperadas.mes}
                        dadosMes={dadosMes}
                      />
                      {/* Badge de posição */}
                      <div className={`absolute -top-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center ${setor === 'suporte' ? 'bg-blue-600' : 'bg-green-600'} text-white font-bold text-sm shadow-lg`}>
                        #{index + 1}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filtros - Apenas para suporte (tem estagiários) */}
        {setor === 'suporte' && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-gray-800/50 to-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                    <FiFilter className="text-gray-400" size={16} />
                  </div>
                  <span className="font-semibold text-white">Filtrar colaboradores</span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={filter === 'all'}
                    onClick={() => setFilter('all')}
                    count={todayData?.data?.length || 0}
                  >
                    <FiUsers size={16} />
                    Todos
                  </FilterButton>
                  <FilterButton
                    active={filter === 'efetivos'}
                    onClick={() => setFilter('efetivos')}
                    count={todayData?.data?.filter(c => !c.nome.includes('(Estagiário)') && !c.nome.includes('(Estagiario)')).length || 0}
                  >
                    <FiUser size={16} />
                    Assistentes
                  </FilterButton>
                  <FilterButton
                    active={filter === 'estagiarios'}
                    onClick={() => setFilter('estagiarios')}
                    count={todayData?.data?.filter(c => c.nome.includes('(Estagiário)') || c.nome.includes('(Estagiario)')).length || 0}
                  >
                    <FiUser size={16} />
                    Estagiários
                  </FilterButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Colaboradores */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-white">
                {setor === 'suporte' 
                  ? 'Todos os Colaboradores' 
                  : 'Equipe Comercial'}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {filteredCollaborators.length} {filteredCollaborators.length === 1 ? 'colaborador' : 'colaboradores'} no setor de {getSetorLabel()}
                {setor === 'suporte' && filter !== 'all' && ` (${filter === 'efetivos' ? 'Assistentes' : 'Estagiários'})`}
              </p>
            </div>
          </div>
          
          {filteredCollaborators.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredCollaborators.map((collaborator) => {
                const recuperadas = getLigacoesRecuperadasColaborador(collaborator.codigo);
                const dadosMes = getDadosMesColaborador(collaborator.codigo);
                
                return (
                  <CollaboratorCard
                    key={collaborator.codigo}
                    collaborator={collaborator}
                    ligacoesRecuperadasDia={recuperadas.dia}
                    ligacoesRecuperadasMes={recuperadas.mes}
                    dadosMes={dadosMes}
                    showDadosMes={true}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-gray-800/30 rounded-2xl border border-gray-700/50">
              <FiUsers className={`${setor === 'suporte' ? 'text-blue-600' : 'text-green-600'} mx-auto mb-4`} size={48} />
              <p className="text-gray-400">
                {setor === 'suporte' && filter !== 'all'
                  ? `Nenhum ${filter === 'efetivos' ? 'assistente' : 'estagiário'} encontrado`
                  : `Nenhum colaborador encontrado no setor de ${getSetorLabel()}`
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;