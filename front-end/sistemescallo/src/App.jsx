import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import IndividualView from './components/IndividualView';
import useRefreshData from './hooks/useRefreshData';

function App() {
  // Estado para gerenciar o setor (suporte ou comercial)
  const [setor, setSetor] = useState(() => {
    // Tenta carregar do localStorage, padrão para 'suporte'
    return localStorage.getItem('escallo_setor') || 'suporte';
  });

  // Hook para buscar dados - agora recebe o setor como parâmetro
  const { 
    todayData, 
    monthData, 
    ligacoesAtivasData,
    ligacoesRecuperadasData, 
    loading, 
    error, 
    lastUpdate, 
    refreshData 
  } = useRefreshData(setor); // Passa o setor atual para o hook

  // Função para mudar o setor
  const handleSetorChange = (novoSetor) => {
    /* console.log(`Mudando setor de ${setor} para ${novoSetor}`); */
    setSetor(novoSetor);
    localStorage.setItem('escallo_setor', novoSetor);
  };

  // Função de refresh que recebe um parâmetro para forçar refresh
  const handleRefresh = (forceRefresh = false) => {
    /* console.log(`🔄 Refresh solicitado via Header, setor: ${setor}, force: ${forceRefresh}`); */
    refreshData(forceRefresh);
  };

  // Carregar setor salvo do localStorage ao iniciar
  useEffect(() => {
    const savedSetor = localStorage.getItem('escallo_setor');
    if (savedSetor && (savedSetor === 'suporte' || savedSetor === 'comercial')) {
      setSetor(savedSetor);
    }
  }, []);

  // Efeito para debug quando o setor muda
  useEffect(() => {
    /* console.log(`Setor alterado para: ${setor}`); */
  }, [setor]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-gray-100">
        {/* Passe a função handleRefresh (que chama refreshData) para o Header */}
        <Header 
          onRefresh={handleRefresh} // ← AGORA PASSA A FUNÇÃO QUE RECEBE forceRefresh
          lastUpdate={lastUpdate} 
          loading={loading}
          setor={setor}
          onSetorChange={handleSetorChange}
        />
        
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route 
              path="/" 
              element={
                <Home 
                  todayData={todayData} 
                  monthData={monthData} 
                  ligacoesRecuperadasData={ligacoesRecuperadasData}
                  loading={loading} 
                  error={error}
                  setor={setor}
                />
              } 
            />
            <Route 
              path="/collaborator/:codigo" 
              element={
                <IndividualView 
                  todayData={todayData}
                  monthData={monthData}
                  ligacoesAtivasData={ligacoesAtivasData}
                  ligacoesRecuperadasData={ligacoesRecuperadasData}
                  loading={loading}
                  error={error}
                  setor={setor}
                />
              } 
            />
          </Routes>
        </main>

        {/* Exibição de erro global */}
        {error && (
          <div className="fixed bottom-4 right-4 bg-red-600 text-white p-4 rounded-lg shadow-lg">
            {error}
          </div>
        )}

        <footer className="mt-12 text-center text-gray-400 text-sm border-t border-gray-800 pt-4">
          <p>Dashboard de Monitoramento &copy; {new Date().getFullYear()} - Atualizações automáticas a cada 1 hora</p>
          <p className="mt-1 mb-4">
            Setor atual: <span className={`font-semibold ${setor === 'suporte' ? 'text-blue-400' : 'text-green-400'}`}>
              {setor === 'suporte' ? 'Suporte' : 'Comercial'}
            </span> | Clique no botão "Atualizar" para forçar uma atualização imediata
          </p>
        </footer>
      </div>
    </Router>
  );
}

export default App;