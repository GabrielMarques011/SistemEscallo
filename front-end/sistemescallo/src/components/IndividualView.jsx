// components/IndividualView.js
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FiArrowLeft, 
  FiPhone, 
  FiPercent, 
  FiCalendar,
  FiClock,
  FiCheckCircle,
  FiAlertTriangle,
  FiUsers,
  FiRefreshCw
} from 'react-icons/fi';

// Funções de formatação inline
const formatTMA = (seconds) => {
  if (!seconds && seconds !== 0) return '00:00';
  const secs = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
  if (isNaN(secs) || secs < 0) return '00:00';
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const remainingSeconds = Math.floor(secs % 60);
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const IndividualView = ({ 
  todayData, 
  monthData, 
  ligacoesAtivasData, 
  ligacoesRecuperadasData, // ADICIONEI ESTA PROP
  loading, 
  error, 
  setor 
}) => {
  const { codigo } = useParams();
  const navigate = useNavigate();
  
  console.log('IndividualView - Props:', {
    setor,
    hasTodayData: !!todayData,
    hasMonthData: !!monthData,
    hasLigacoesAtivasData: !!ligacoesAtivasData,
    hasLigacoesRecuperadasData: !!ligacoesRecuperadasData, // LOG ADICIONADO
    ligacoesRecuperadasData, // LOG ADICIONADO
    codigo
  });

  // Se ainda está carregando
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Carregando dados do colaborador...</p>
        </div>
      </div>
    );
  }

  // Se houver erro e não tiver dados básicos
  if (error && !todayData && !monthData) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 text-5xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-300 mb-4">Erro ao carregar dados</h2>
        <p className="text-gray-400 mb-6">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="text-blue-400 hover:text-blue-300 font-medium px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          ← Voltar para dashboard
        </button>
      </div>
    );
  }

  // Buscar dados com proteção
  const collaboratorToday = todayData?.data?.find(c => c.codigo === codigo);
  const collaboratorMonth = monthData?.data?.find(c => c.codigo === codigo);
  
  // console.log('collaboratorToday:', collaboratorToday);
  // console.log('collaboratorMonth:', collaboratorMonth);
  
  // Buscar ligações ativas com proteção
  let ligacoesAtivas = 0;
  let hasLigacoesAtivas = false;
  
  if (ligacoesAtivasData && ligacoesAtivasData.data && Array.isArray(ligacoesAtivasData.data)) {
    const ligacoesItem = ligacoesAtivasData.data.find(item => item.codigo === codigo);
    if (ligacoesItem) {
      ligacoesAtivas = ligacoesItem.ligacoesAtivasMes || 0;
      hasLigacoesAtivas = true;
    }
  }

  // BUSCAR LIGAÇÕES RECUPERADAS - MESMA LÓGICA DA HOME
  const getLigacoesRecuperadasColaborador = (codigo) => {
    if (!ligacoesRecuperadasData) return { dia: 0, mes: 0 };
    
    const dia = ligacoesRecuperadasData.dia?.find(item => item.codigo === codigo);
    const mes = ligacoesRecuperadasData.mes?.find(item => item.codigo === codigo);
    
    return {
      dia: dia?.ligacoesRecuperadasDia || 0,
      mes: mes?.ligacoesRecuperadasMes || 0
    };
  };

  const recuperadas = getLigacoesRecuperadasColaborador(codigo);
  
  // console.log('Dados de recuperação encontrados:', recuperadas);
  // console.log('ligacoesRecuperadasData estrutura:', ligacoesRecuperadasData);

  // Se não encontrou nenhum dado do colaborador
  if (!collaboratorToday && !collaboratorMonth) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-300 mb-4">Colaborador não encontrado</h2>
        <p className="text-gray-400 mb-6">Código: {codigo} | Setor: {setor}</p>
        <button
          onClick={() => navigate('/')}
          className="text-blue-400 hover:text-blue-300 font-medium px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          ← Voltar para dashboard
        </button>
      </div>
    );
  }

  const collaborator = collaboratorToday || collaboratorMonth;

  const getInitials = (name) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const renderStatCard = (title, value, icon, description, color = 'blue', warning = false) => {
    const colors = {
      blue: 'from-blue-500 to-blue-600 shadow-blue-500/20',
      green: 'from-green-500 to-green-600 shadow-green-500/20',
      red: 'from-red-500 to-red-600 shadow-red-500/20',
      yellow: 'from-yellow-500 to-yellow-600 shadow-yellow-500/20',
      purple: 'from-purple-500 to-purple-600 shadow-purple-500/20',
      indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-500/20',
      gray: 'from-gray-500 to-gray-600 shadow-gray-500/20',
      teal: 'from-teal-500 to-teal-600 shadow-teal-500/20'
    };

    const colorClass = colors[color] || colors.blue;

    return (
      <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700 hover:border-gray-600 transition-all duration-300 ${warning ? 'ring-2 ring-yellow-500/30' : ''}`}>
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClass} shadow-lg`}>
            {icon}
          </div>
          {warning && (
            <span className="text-xs px-2.5 py-1 bg-yellow-500/10 text-yellow-400 rounded-full border border-yellow-500/20 flex items-center gap-1">
              <FiAlertTriangle size={10} />
              Parcial
            </span>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-4xl font-bold text-white tracking-tight">
            {value}
          </div>
          <div className="text-sm font-semibold text-gray-300">{title}</div>
          {description && (
            <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
    );
  };

  // Cálculos
  const percentualHoje = collaboratorToday?.percentualOferecidasAtendidas || 0;
  const percentualMes = collaboratorMonth?.percentualOferecidasAtendidas || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-400 hover:text-gray-300 group transition-colors"
        >
          <FiArrowLeft className="mr-2 group-hover:-translate-x-1 transition-transform" />
          Voltar para dashboard
        </button>
        
        {/* Badge do setor */}
        <div className={`px-4 py-2 rounded-lg shadow-lg ${setor === 'suporte' ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-gradient-to-r from-green-600 to-green-700'}`}>
          <div className="flex items-center gap-2">
            <FiUsers size={16} className="text-white" />
            <span className="text-white font-semibold">
              Setor: {setor === 'suporte' ? 'Suporte' : 'Comercial'}
            </span>
          </div>
        </div>
      </div>

      {/* Header do Colaborador */}
      <div className="bg-gray-800 rounded-2xl shadow-lg p-8 mb-8 border border-gray-700">
        <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
          <div className="flex-shrink-0">
            <div className={`w-24 h-24 rounded-full ${setor === 'suporte' ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-gradient-to-r from-green-600 to-green-700'} flex items-center justify-center text-white text-3xl font-bold`}>
              {getInitials(collaborator?.nome)}
            </div>
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-bold text-gray-100 mb-2">
              {collaborator?.nome || 'Nome não disponível'}
            </h1>
            <p className="text-lg text-gray-400 mb-4">
              Código: <span className="font-mono bg-gray-900 px-2 py-1 rounded">{codigo}</span>
            </p>
            
            {/* Status dos dados */}
            <div className="mt-4 flex flex-wrap gap-2">
              {!hasLigacoesAtivas && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-900 text-yellow-300">
                  <FiAlertTriangle className="mr-1" size={12} />
                  Dados de ligações ativas indisponíveis
                </span>
              )}
              {!ligacoesRecuperadasData && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-900 text-yellow-300">
                  <FiAlertTriangle className="mr-1" size={12} />
                  Dados de ligações recuperadas indisponíveis
                </span>
              )}
              {error && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-900 text-red-300">
                  ⚠️ {error}
                </span>
              )}
            </div>
            
            {/* Seção de Recuperação */}
            <div className="pt-6 mt-6 border-t border-gray-700">
              <div className="flex items-center space-x-2 text-gray-400 mb-4">
                <FiRefreshCw size={16} />
                <span className="text-sm font-semibold">Ligações Recuperadas</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center bg-gray-900/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-white">{recuperadas.dia}</div>
                  <div className="text-xs text-gray-500 mt-1">Hoje</div>
                </div>
                <div className="text-center bg-gray-900/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-white">{recuperadas.mes}</div>
                  <div className="text-xs text-gray-500 mt-1">Mês</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dados do Dia */}
      {collaboratorToday && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-100 flex items-center">
              <FiCalendar className="mr-3" />
              Desempenho Hoje
            </h2>
            {/* {todayData?.atualizado_em && (
              <span className="text-sm text-gray-500">
                Atualizado: {new Date(todayData.atualizado_em).toLocaleTimeString('pt-BR')}
              </span>
            )} */}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {renderStatCard(
              'Ligações Recebidas',
              collaboratorToday?.ligacoesOferecidas || 0,
              <FiPhone size={24} />,
              'Total de ligações oferecidas',
              'blue'
            )}
            
            {renderStatCard(
              'Ligações Atendidas',
              collaboratorToday?.ligacoesOferecidasAtendidas || 0,
              <FiPhone size={24} />,
              'Ligações atendidas com sucesso',
              'green'
            )}
            
            {renderStatCard(
              'Percentual de Atendidas',
              `${percentualHoje?.toFixed(1) || 0}%`,
              <FiPercent size={24} />,
              'Taxa de sucesso',
              percentualHoje >= 90 ? 'green' : 
              percentualHoje >= 70 ? 'yellow' : 'red'
            )}
            
            {renderStatCard(
              'Tempo Médio (TMA)',
              formatTMA(collaboratorToday?.TMA),
              <FiClock size={24} />,
              'Tempo médio de atendimento',
              'purple'
            )}
          </div>
        </div>
      )}

      {/* Dados do Mês */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-100 flex items-center">
            <FiCalendar className="mr-3" />
            Desempenho do Mês
          </h2>
          {/* {monthData?.atualizado_em && (
            <span className="text-sm text-gray-500">
              Atualizado: {new Date(monthData.atualizado_em).toLocaleTimeString('pt-BR')}
            </span>
          )} */}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {renderStatCard(
            'Ligações Recebidas',
            collaboratorMonth?.ligacoesOferecidas || 0,
            <FiPhone size={24} />,
            'Total de ligações oferecidas no mês',
            'blue'
          )}
          
          {renderStatCard(
            'Ligações Atendidas',
            collaboratorMonth?.ligacoesOferecidasAtendidas || 0,
            <FiPhone size={24} />,
            'Ligações atendidas no mês',
            'green'
          )}
          
          {renderStatCard(
            'Ligações Ativas',
            hasLigacoesAtivas ? ligacoesAtivas : 'N/D',
            <FiCheckCircle size={24} />,
            hasLigacoesAtivas ? 'Ligações completadas com sucesso' : 'Dados indisponíveis',
            hasLigacoesAtivas ? 'indigo' : 'gray',
            !hasLigacoesAtivas
          )}
          
          {renderStatCard(
            'Percentual de Atendidas',
            `${percentualMes?.toFixed(1) || 0}%`,
            <FiPercent size={24} />,
            'Taxa de sucesso no mês',
            percentualMes >= 90 ? 'green' : 
            percentualMes >= 70 ? 'yellow' : 'red'
          )}
          
          {renderStatCard(
            'Tempo Médio (TMA)',
            formatTMA(collaboratorMonth?.TMA),
            <FiClock size={24} />,
            'Tempo médio de atendimento no mês',
            'purple'
          )}
        </div>
      </div>
    </div>
  );
};

export default IndividualView;