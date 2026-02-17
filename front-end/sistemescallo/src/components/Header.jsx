import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiRefreshCw, FiHome, FiClock, FiActivity, FiBarChart2, FiZap, FiUsers } from 'react-icons/fi';

const Header = ({ onRefresh, lastUpdate, loading, setor, onSetorChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSetorDropdown, setShowSetorDropdown] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatLastUpdate = (date) => {
    if (!date) return 'Nunca atualizado';
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatCurrentTime = () => {
    return currentTime.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getTimeSinceUpdate = () => {
    if (!lastUpdate) return null;
    const diff = Math.floor((new Date() - new Date(lastUpdate)) / 1000);
    if (diff < 60) return `${diff}s atrás`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
    return `${Math.floor(diff / 3600)}h atrás`;
  };

  const handleSetorChange = (novoSetor) => {
    onSetorChange(novoSetor);
    setShowSetorDropdown(false);
    // Força refresh dos dados quando mudar o setor
    if (onRefresh) {
      onRefresh(true); // Passa true para indicar que é uma mudança de setor
    }
  };

  const getSetorLabel = () => {
    switch(setor) {
      case 'suporte':
        return 'Suporte';
      case 'comercial':
        return 'Comercial';
      default:
        return 'Selecionar';
    }
  };

  const getSetorIconColor = () => {
    switch(setor) {
      case 'suporte':
        return 'from-blue-500 to-blue-600';
      case 'comercial':
        return 'from-green-500 to-green-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700/50 backdrop-blur-xl shadow-2xl">
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Header Content */}
        <div className="flex items-center justify-between h-20">
          {/* Left Section - Logo/Title */}
          <div className="flex items-center space-x-4">
            {/* Logo/Home Button */}
            <button
              onClick={() => navigate('/')}
              className="relative group"
              title="Voltar para dashboard"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl opacity-0 group-hover:opacity-100 blur transition-all duration-300"></div>
              <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg group-hover:shadow-blue-500/50 transition-all duration-300 group-hover:scale-105">
                <FiHome size={22} className="text-white" />
              </div>
            </button>
            
            <div className="hidden sm:block">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-white tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Dashboard de Monitoramento
                </h1>
              </div>
            </div>

            {/* Mobile Logo Text */}
            <div className="sm:hidden">
              <h1 className="text-lg font-bold text-white">Dashboard</h1>
              <p className="text-xs text-gray-400">{getSetorLabel()}</p>
            </div>
          </div>

          {/* Center Section - Setor Selector */}
          <div className="hidden md:flex items-center">
            <div className="relative">
              <button
                onClick={() => setShowSetorDropdown(!showSetorDropdown)}
                className={`
                  relative group flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm
                  transition-all duration-300 overflow-hidden
                  bg-gradient-to-r ${getSetorIconColor()} text-white shadow-lg
                  hover:shadow-lg hover:scale-105 active:scale-95
                `}
              >
                {/* Efeito de brilho no hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                
                <FiUsers size={18} className="relative z-10" />
                <span className="relative z-10 font-semibold">{getSetorLabel()}</span>
                <svg 
                  className={`relative z-10 w-4 h-4 transition-transform duration-300 ${showSetorDropdown ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showSetorDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSetorDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 z-20 rounded-xl shadow-2xl bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700/50 backdrop-blur-xl overflow-hidden">
                    <div className="p-2">
                      <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Selecione o Setor
                      </div>
                      
                      <button
                        onClick={() => handleSetorChange('suporte')}
                        className={`
                          w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                          ${setor === 'suporte' 
                            ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-white border border-blue-500/30' 
                            : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                          }
                        `}
                      >
                        <div className={`w-3 h-3 rounded-full ${setor === 'suporte' ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                        <div className="flex-1 text-left">Suporte</div>
                        <div className="text-xs px-2 py-1 rounded bg-gray-700/50">
                          {setor === 'suporte' ? '14 atendentes' : '14'}
                        </div>
                      </button>

                      <button
                        onClick={() => handleSetorChange('comercial')}
                        className={`
                          w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 mt-1
                          ${setor === 'comercial' 
                            ? 'bg-gradient-to-r from-green-500/20 to-green-600/20 text-white border border-green-500/30' 
                            : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                          }
                        `}
                      >
                        <div className={`w-3 h-3 rounded-full ${setor === 'comercial' ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                        <div className="flex-1 text-left">Comercial</div>
                        <div className="text-xs px-2 py-1 rounded bg-gray-700/50">
                          {setor === 'comercial' ? '5 atendentes' : '5'}
                        </div>
                      </button>
                    </div>
                    
                    <div className="border-t border-gray-700/50 p-2">
                      <div className="text-xs text-gray-500 px-3 py-2">
                        Os dados são filtrados por setor
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Section - Status & Actions */}
          <div className="flex items-center space-x-3">
            {/* Status de Atualização - Desktop */}
            {lastUpdate && (
              <div className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-gray-800/50 rounded-xl border border-gray-700/50 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <FiRefreshCw size={16} className="text-purple-400" />
                    {loading && (
                      <div className="absolute inset-0 animate-ping">
                        <FiRefreshCw size={16} className="text-purple-400 opacity-75" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 leading-none">Última atualização</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-mono font-semibold text-white leading-none tabular-nums">
                        {formatLastUpdate(lastUpdate)}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({getTimeSinceUpdate()})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Status de Atualização - Mobile */}
            {lastUpdate && (
              <div className="md:hidden flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-xl border border-gray-700/50">
                <FiClock size={14} className="text-purple-400" />
                <span className="text-xs font-mono font-semibold text-white tabular-nums">
                  {formatLastUpdate(lastUpdate)}
                </span>
              </div>
            )}

            {/* Mobile Setor Selector */}
            <div className="md:hidden">
              <div className="relative">
                <button
                  onClick={() => setShowSetorDropdown(!showSetorDropdown)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                    ${setor === 'suporte' 
                      ? 'bg-gradient-to-r from-blue-600/20 to-blue-700/20 text-blue-300 border border-blue-500/30' 
                      : 'bg-gradient-to-r from-green-600/20 to-green-700/20 text-green-300 border border-green-500/30'
                    }
                  `}
                >
                  <FiUsers size={16} />
                  <span className="font-semibold">{getSetorLabel().substring(0, 3)}</span>
                </button>

                {/* Mobile Dropdown */}
                {showSetorDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40"
                      onClick={() => setShowSetorDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 z-50 rounded-xl shadow-2xl bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700/50 backdrop-blur-xl overflow-hidden">
                      <div className="p-2">
                        <button
                          onClick={() => handleSetorChange('suporte')}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                            ${setor === 'suporte' 
                              ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-white' 
                              : 'text-gray-300 hover:bg-gray-700/50'
                            }
                          `}
                        >
                          <div className={`w-2 h-2 rounded-full ${setor === 'suporte' ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                          <div className="flex-1 text-left">Suporte</div>
                          <div className="text-xs">14</div>
                        </button>

                        <button
                          onClick={() => handleSetorChange('comercial')}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mt-1
                            ${setor === 'comercial' 
                              ? 'bg-gradient-to-r from-green-500/20 to-green-600/20 text-white' 
                              : 'text-gray-300 hover:bg-gray-700/50'
                            }
                          `}
                        >
                          <div className={`w-2 h-2 rounded-full ${setor === 'comercial' ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                          <div className="flex-1 text-left">Comercial</div>
                          <div className="text-xs">5</div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Botão de Atualizar - AGORA SEMPRE COM forceRefresh=true */}
            <button
              onClick={() => {
                /* console.log('🔄 Botão de atualizar clicado - Forçando refresh'); */
                onRefresh(true);
              }}
              disabled={loading}
              className={`
                relative group flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm
                transition-all duration-300 overflow-hidden
                ${loading
                  ? 'bg-blue-600/50 text-blue-200 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-95'
                }
              `}
              title="atualização de todos os dados"
            >
              {/* Efeito de brilho no hover */}
              {!loading && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
              )}
              
              <FiRefreshCw 
                size={18} 
                className={`relative z-10 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} 
              />
              <span className="relative z-10 hidden sm:inline">
                {loading ? 'Atualizando...' : 'Atualizar'}
              </span>
            </button>

          </div>
        </div>

        {/* Barra de progresso de loading */}
        {loading && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-[shimmer_2s_infinite] bg-[length:200%_100%]"></div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </header>
  );
};

export default Header;