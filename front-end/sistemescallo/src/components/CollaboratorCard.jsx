import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPhone, FiClock, FiActivity, FiRefreshCw } from 'react-icons/fi'; // Adicione FiRefreshCw
import { formatTMA } from '../utils/formatters';

const CollaboratorCard = ({ collaborator, ligacoesRecuperadasDia, ligacoesRecuperadasMes }) => {
  const navigate = useNavigate();
  
  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getPerformanceColor = (percentage) => {
    if (percentage >= 90) return 'text-emerald-400';
    if (percentage >= 70) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div 
      onClick={() => navigate(`/collaborator/${collaborator.codigo}`)}
      className="bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-all duration-200 cursor-pointer hover:shadow-lg"
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-md">
            {getInitials(collaborator.nome)}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white truncate">
              {collaborator.nome}
            </h3>
            <p className="text-xs text-gray-500">ID: {collaborator.codigo}</p>
          </div>
        </div>

        {/* Main Stats */}
        <div className="space-y-3">
          {/* Calls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-gray-400">
              <FiPhone size={16} />
              <span className="text-sm">Ligações</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-white">
                {collaborator.ligacoesOferecidasAtendidas || 0}
              </span>
              <span className="text-sm text-gray-500 ml-1">
                / {collaborator.ligacoesOferecidas || 0}
              </span>
            </div>
          </div>

          {/* Performance */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-gray-400">
              <FiActivity size={16} />
              <span className="text-sm">Aproveitamento</span>
            </div>
            <span className={`text-lg font-bold ${getPerformanceColor(collaborator.percentualOferecidasAtendidas)}`}>
              {collaborator.percentualOferecidasAtendidas?.toFixed(1) || 0}%
            </span>
          </div>

          {/* TMA */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-gray-400">
              <FiClock size={14} />
              <span className="text-sm">TMA: {formatTMA(collaborator.TMA)}</span>
            </div>
            <div>
              {/* <span>CH: {collaborator.chamadasPorHora || '0'}</span> */}
            </div>
          </div>

          {/* TMA */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-gray-400">
              <FiClock size={14} />
              <span className="text-sm">Recuperadas Hoje: {ligacoesRecuperadasDia || 0}</span>
            </div>
            <div>
              {/* <span>CH: {collaborator.chamadasPorHora || '0'}</span> */}
            </div>
          </div>

          {/* ADICIONE ESTA SEÇÃO PARA LIGAÇÕES RECUPERADAS */}
          {/* {(ligacoesRecuperadasDia !== undefined || ligacoesRecuperadasMes !== undefined) && (
            <div className="pt-3 mt-3 border-t border-gray-700">
              <div className="flex items-center space-x-2 text-gray-400 mb-2">
                <FiRefreshCw size={14} />
                <span className="text-sm">Ligações Recuperadas</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{ligacoesRecuperadasDia || 0}</div>
                  <div className="text-xs text-gray-500">Hoje</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{ligacoesRecuperadasMes || 0}</div>
                  <div className="text-xs text-gray-500">Mês</div>
                </div>
              </div>
            </div>
          )} */}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/collaborator/${collaborator.codigo}`);
            }}
            className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            Ver detalhes →
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollaboratorCard;