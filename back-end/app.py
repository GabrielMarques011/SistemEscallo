from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import requests
import json
from dotenv import load_dotenv
from datetime import datetime, timedelta
import threading
import time
import atexit
from functools import wraps
import hashlib
import traceback
import queue
from collections import defaultdict

# Carrega variáveis de ambiente
load_dotenv()

app = Flask(__name__)
CORS(app)  # Habilita CORS para todas as rotas

# Obtém as variáveis de ambiente
HOST = os.getenv('ESCALLO_HOST')
TOKEN = os.getenv('ESCALLO_TOKEN')

# Definição dos setores e seus atendentes
SETORES = {
    'suporte': [
        {"codigo": "4002", "nome": "Pedro Henrique"},
        {"codigo": "4004", "nome": "João Miyake"},
        {"codigo": "4006", "nome": "Gabriel Rosa"},
        {"codigo": "4008", "nome": "Gabriel Brambila (Estagiário)"},
        {"codigo": "4009", "nome": "Marcos Moraes (Estagiário)"},
        {"codigo": "4021", "nome": "Rodrigo Akira"},
        {"codigo": "4025", "nome": "Alison da Silva"},
        {"codigo": "4027", "nome": "Pedro Chaves (Estagiário)"},
        {"codigo": "4028", "nome": "Ryan da Silva (Estagiário)"},
        {"codigo": "4029", "nome": "Samuel Mendes (Estagiário)"},
        {"codigo": "4030", "nome": "Pedro Boni"},
        {"codigo": "4031", "nome": "Rafael Guedes"},
        {"codigo": "4032", "nome": "Ricardo Correa"},
        {"codigo": "4033", "nome": "João Silva (Estagiario)"}
    ],
    'comercial': [
        {"codigo": "1201", "nome": "Gustavo Leônidas"},
        {"codigo": "1204", "nome": "Tamires Cavalcante"},
        {"codigo": "1205", "nome": "Miguel Roveda"},
        {"codigo": "1208", "nome": "Rennan Taioqui"},
        {"codigo": "1210", "nome": "Rodrigo Boani"},
        {"codigo": "4016", "nome": "Henrique Alves"}
    ]
}

# Cache em memória - agora estruturado por setor e tipo
cache = {}
background_tasks = {}

# Inicializar cache para cada setor
for setor in SETORES.keys():
    cache[setor] = {
        'hoje': {'data': None, 'timestamp': None, 'hash': None, 'periodo': None},
        'mes': {'data': None, 'timestamp': None, 'hash': None, 'periodo': None},
        '7dias': {'data': None, 'timestamp': None, 'hash': None, 'periodo': None},
        'ligacoesAtivasMes': {'data': None, 'timestamp': None, 'hash': None, 'periodo': None},
        'ligacoesRecuperadas': {'data': None, 'timestamp': None, 'hash': None, 'periodo': None}
    }
    
    background_tasks[setor] = {
        'ligacoesAtivasMes': {
            'is_running': False,
            'last_started': None,
            'last_completed': None,
            'error': None,
            'progress': 0
        },
        'ligacoesRecuperadas': {
            'is_running': False,
            'last_started': None,
            'last_completed': None,
            'error': None,
            'progress': 0
        }
    }

# Lock para thread safety
cache_lock = threading.RLock()
background_lock = threading.RLock()

# Configurações
CACHE_DURATION_HOURS = 1  # Cache de 1 hora
FORCE_REFRESH_PARAM = 'force_refresh'
SETOR_PARAM = 'setor'
BACKGROUND_UPDATE_ENABLED = True  # Habilitar atualização em background

def calcular_hash(data):
    """Calcula hash dos dados para verificar mudanças"""
    if data is None:
        return None
    data_str = json.dumps(data, sort_keys=True)
    return hashlib.md5(data_str.encode()).hexdigest()

def buscar_dados_escallo(data_inicial, data_final):
    """Função para buscar dados da API do Escallo"""
    API_URL = f"http://{HOST}/escallo/api/v1/recurso/relatorio/rel025/?registros=100&pagina=0"
    
    payload = {
        "dataInicial": data_inicial,
        "dataFinal": data_final,
        "horarioInicial": "00:00:01",
        "horarioFinal": "23:59:59",
        "exibirUsuarioSistema": "1",
        "ultimosDias": 30
    }
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Partner {TOKEN}'
    }
    
    try:
        # app.logger.info(f"📤 Buscando dados da API Escallo: {data_inicial} a {data_final}")
        response = requests.post(API_URL, json=payload, headers=headers, timeout=30)
        
        if response.status_code != 200:
            app.logger.error(f"Erro na API: {response.status_code} - {response.text}")
            return {"error": f"Erro na API: {response.status_code}"}
        
        data = response.json()
        
        if 'data' in data and 'registros' in data['data']:
            registros = data['data']['registros']
            # app.logger.info(f"✅ Dados recebidos da API: {len(registros)} registros")
            
            # Log dos primeiros registros para debug
            if registros:
                for i, registro in enumerate(registros[:3]):
                    if isinstance(registro, dict):
                        # app.logger.info(f"📝 Registro {i+1}: Código: {registro.get('codigo', 'N/A')}, Nome: {registro.get('nome', 'N/A')}")
                        pass
            
            return registros
        else:
            app.logger.warning("API retornou estrutura inesperada")
            return []
            
    except requests.exceptions.Timeout:
        app.logger.error("Timeout na requisição para API do Escallo")
        return {"error": "Timeout na conexão com a API"}
    except Exception as e:
        app.logger.error(f"Erro na requisição: {str(e)}")
        return {"error": str(e)}

def buscar_dados_ligacoes_ativas(data_inicial, data_final, progress_callback=None):
    """Função para buscar dados de ligações ativas (rel003) com paginação completa"""
    todos_registros = []
    pagina = 0
    registros_por_pagina = 100
    
    while True:
        API_URL = f"http://{HOST}/escallo/api/v1/recurso/relatorio/rel003/?registros={registros_por_pagina}&pagina={pagina}"
        
        payload = {
            "dataInicial": data_inicial,
            "dataFinal": data_final,
            "horarioInicial": "00:00:01",
            "horarioFinal": "23:59:59",
            "filtrarFilhas": 0,
            "ultimosDias": 30
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Partner {TOKEN}'
        }
        
        try:
            if progress_callback and pagina % 5 == 0:
                progress = min(100, int((pagina / 50) * 100))
                progress_callback(progress)
            
            response = requests.post(API_URL, json=payload, headers=headers, timeout=60)
            
            if response.status_code != 200:
                app.logger.error(f"Erro na API rel003 (página {pagina}): {response.status_code}")
                if pagina == 0:
                    return {"error": f"Erro na API: {response.status_code}"}
                else:
                    app.logger.warning(f"Erro na página {pagina}, retornando dados parciais")
                    break
            
            data = response.json()
            
            if 'data' not in data:
                app.logger.error(f"Resposta API não contém 'data': {data}")
                if pagina == 0:
                    return {"error": "Estrutura da resposta inválida - sem 'data'"}
                else:
                    break
            
            if 'registros' not in data['data']:
                app.logger.error(f"Resposta API não contém 'registros' em 'data': {data['data']}")
                if pagina == 0:
                    return {"error": "Estrutura da resposta inválida - sem 'registros'"}
                else:
                    break
            
            registros_pagina = data['data']['registros']
            
            if not registros_pagina:
                # app.logger.info(f"Página {pagina} vazia - encerrando paginação")
                break
            
            todos_registros.extend(registros_pagina)
            
            if len(registros_pagina) < registros_por_pagina:
                # app.logger.info(f"Última página detectada (página {pagina} tem {len(registros_pagina)} registros)")
                break
            
            pagina += 1
            
            if pagina >= 50:
                app.logger.warning(f"Limite de 50 páginas atingido - coletados {len(todos_registros)} registros")
                break
            
            time.sleep(0.1)
                
        except requests.exceptions.Timeout:
            app.logger.error(f"Timeout na requisição para API do Escallo (rel003) página {pagina}")
            if pagina == 0:
                return {"error": "Timeout na conexão com a API"}
            else:
                app.logger.warning(f"Timeout na página {pagina}, retornando dados parciais")
                break
        except Exception as e:
            app.logger.error(f"Erro na requisição rel003 página {pagina}: {str(e)}")
            if pagina == 0:
                return {"error": str(e)}
            else:
                app.logger.warning(f"Erro na página {pagina}, retornando dados parciais: {str(e)}")
                break
    
    # app.logger.info(f"Total de registros coletados do rel003: {len(todos_registros)} após {pagina + 1} páginas")
    
    if progress_callback:
        progress_callback(100)
    
    return todos_registros

def buscar_dados_ligacoes_recuperadas(data_inicial, data_final, progress_callback=None):
    """Função para buscar dados de ligações recuperadas (rel030) com paginação completa"""
    todos_registros = []
    pagina = 0
    registros_por_pagina = 100
    
    while True:
        API_URL = f"http://{HOST}/escallo/api/v1/recurso/relatorio/rel030/?registros={registros_por_pagina}&pagina={pagina}"
        
        payload = {
            "dataInicial": data_inicial,
            "dataFinal": data_final,
            "horarioInicial": "00:00:01",
            "horarioFinal": "23:59:59"
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Partner {TOKEN}'
        }
        
        try:
            response = requests.post(API_URL, json=payload, headers=headers, timeout=60)
            
            if response.status_code != 200:
                app.logger.error(f"Erro na API rel030 (página {pagina}): {response.status_code}")
                break
            
            data = response.json()
            
            # LOG PARA VER ESTRUTURA DA RESPOSTA
            if pagina == 0:
                # app.logger.info(f"📦 ESTRUTURA DA RESPOSTA (página 0):")
                # app.logger.info(f"   Tipo de data: {type(data)}")
                if 'data' in data:
                    # app.logger.info(f"   Tem 'data': Sim")
                    if 'registros' in data['data']:
                        registros = data['data']['registros']
                        # app.logger.info(f"   Tem 'registros': Sim")
                        # app.logger.info(f"   Tipo de registros: {type(registros)}")
                        if isinstance(registros, dict):
                            # app.logger.info(f"   Quantidade de registros: {len(registros)}")
                            # Mostrar primeiro registro
                            if registros:
                                primeira_chave = list(registros.keys())[0]
                                primeiro_valor = registros[primeira_chave]
                                # app.logger.info(f"   Primeiro registro:")
                                # app.logger.info(f"     Chave: {primeira_chave}")
                                # app.logger.info(f"     Valor tipo: {type(primeiro_valor)}")
                                if isinstance(primeiro_valor, dict):
                                    for k, v in primeiro_valor.items():
                                        # app.logger.info(f"     {k}: {repr(v)}")
                                        pass
            
            if 'data' not in data or 'registros' not in data['data']:
                app.logger.error(f"Estrutura inválida na página {pagina}")
                break
            
            registros_pagina = data['data']['registros']
            
            # IMPORTANTE: Verificar se registros_pagina é um dicionário
            # Se for dicionário, precisamos extrair os valores
            if isinstance(registros_pagina, dict):
                valores = list(registros_pagina.values())
                # app.logger.info(f"📄 Página {pagina}: Extraindo {len(valores)} valores de dicionário")
                todos_registros.extend(valores)
            else:
                # app.logger.info(f"📄 Página {pagina}: {len(registros_pagina)} registros")
                todos_registros.extend(registros_pagina)
            
            if not registros_pagina or (isinstance(registros_pagina, dict) and len(registros_pagina) < registros_por_pagina) or (not isinstance(registros_pagina, dict) and len(registros_pagina) < registros_por_pagina):
                break
            
            pagina += 1
            if pagina >= 50:
                break
                
        except Exception as e:
            app.logger.error(f"Erro na página {pagina}: {str(e)}")
            break
    
    # app.logger.info(f"✅ Total de registros coletados: {len(todos_registros)}")
    
    # Log dos primeiros registros
    if todos_registros:
        # app.logger.info("📝 PRIMEIROS REGISTROS COLETADOS:")
        for i in range(min(3, len(todos_registros))):
            registro = todos_registros[i]
            # app.logger.info(f"  Registro {i}: {type(registro)}")
            if isinstance(registro, dict):
                for key in ['agente', 'origem', 'status', 'data']:
                    # app.logger.info(f"    {key}: {repr(registro.get(key))}")
                    pass
    
    return todos_registros

def processar_dados(atendentes, resultados_api, cache_key=None, setor=None):
    """Processa os dados dos atendentes com informações de cache"""
    # app.logger.info(f"🔍 PROCESSAR DADOS para setor: {setor}")
    # app.logger.info(f"📊 Total de atendentes configurados: {len(atendentes)}")
    # app.logger.info(f"📊 Códigos dos atendentes: {[a['codigo'] for a in atendentes]}")
    # app.logger.info(f"📊 Total de registros da API: {len(resultados_api)}")
    
    # Se resultados_api for um dict com erro, retorna dados zerados
    if isinstance(resultados_api, dict) and 'error' in resultados_api:
        app.logger.warning(f"API retornou erro, criando dados zerados para {setor}")
        resultados_finais = []
        for atendente in atendentes:
            resultados_finais.append({
                'nome': atendente['nome'],
                'codigo': atendente['codigo'],
                'ligacoesOferecidas': 0,
                'ligacoesOferecidasAtendidas': 0,
                'percentualOferecidasAtendidas': 0,
                'tempoAtendimento': 0,
                'TMA': 0,
                'ligacoesRealizadas': 0,
                'tempoLogin': 0,
                'tempoPausa': 0,
                'chamadasPorHora': 0
            })
    else:
        resultados_finais = []
        
        # Log dos códigos encontrados na API
        codigos_api = []
        for item in resultados_api:
            if isinstance(item, dict):
                codigo = str(item.get('codigo', ''))
                if codigo not in codigos_api:
                    codigos_api.append(codigo)
        
        # app.logger.info(f"🔍 Códigos encontrados na API: {codigos_api[:10]}")
        
        # Contadores para debug
        encontrados = 0
        nao_encontrados = 0
        
        for atendente in atendentes:
            codigo = atendente['codigo']
            encontrado = False
            
            for item in resultados_api:
                if isinstance(item, dict):
                    item_codigo = str(item.get('codigo', ''))
                    if item_codigo == codigo:
                        encontrado = True
                        encontrados += 1
                        
                        # Normaliza chamadasPorHora (converte vírgula para ponto)
                        chamadas_por_hora_str = item.get('chamadasPorHora', '0')
                        if isinstance(chamadas_por_hora_str, str):
                            chamadas_por_hora = float(chamadas_por_hora_str.replace(',', '.'))
                        else:
                            chamadas_por_hora = float(chamadas_por_hora_str or 0)
                        
                        resultados_finais.append({
                            'nome': atendente['nome'],
                            'codigo': codigo,
                            'ligacoesOferecidas': item.get('ligacoesOferecidas', 0),
                            'ligacoesOferecidasAtendidas': item.get('ligacoesOferecidasAtendidas', 0),
                            'percentualOferecidasAtendidas': item.get('percentualOferecidasAtendidas', 0),
                            'tempoAtendimento': item.get('tempoAtendimento', 0),
                            'TMA': item.get('TMA', 0),
                            'ligacoesRealizadas': item.get('ligacoesRealizadas', 0),
                            'tempoLogin': item.get('tempoLogin', 0),
                            'tempoPausa': item.get('tempoPausa', 0),
                            'chamadasPorHora': chamadas_por_hora
                        })
                        break
            
            if not encontrado:
                nao_encontrados += 1
                resultados_finais.append({
                    'nome': atendente['nome'],
                    'codigo': codigo,
                    'ligacoesOferecidas': 0,
                    'ligacoesOferecidasAtendidas': 0,
                    'percentualOferecidasAtendidas': 0,
                    'tempoAtendimento': 0,
                    'TMA': 0,
                    'ligacoesRealizadas': 0,
                    'tempoLogin': 0,
                    'tempoPausa': 0,
                    'chamadasPorHora': 0
                })
        
        # app.logger.info(f"📊 Estatísticas: {encontrados} encontrados, {nao_encontrados} não encontrados")
    
    # Calcular totais
    total_oferecidas = sum(r['ligacoesOferecidas'] for r in resultados_finais)
    total_atendidas = sum(r['ligacoesOferecidasAtendidas'] for r in resultados_finais)
    percentual_geral = (total_atendidas / total_oferecidas * 100) if total_oferecidas > 0 else 0
    
    # Ordenar por percentual (do maior para o menor)
    resultados_finais.sort(key=lambda x: x['percentualOferecidasAtendidas'], reverse=True)
    
    resultado = {
        'data': resultados_finais,
        'totais': {
            'ligacoesOferecidas': total_oferecidas,
            'ligacoesOferecidasAtendidas': total_atendidas,
            'percentualOferecidasAtendidas': round(percentual_geral, 2)
        },
        'atualizado_em': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'cache_info': {
            'cached': cache_key is not None,
            'cache_key': cache_key,
            'cache_timestamp': datetime.now().isoformat(),
            'cache_expires_in': '1 hour'
        },
        'setor': setor
    }
    
    # app.logger.info(f"✅ Processamento concluído para setor {setor}: {len(resultados_finais)} registros")
    return resultado

def processar_dados_ligacoes_ativas(atendentes, resultados_api, cache_key=None, setor=None):
    """Processa os dados de ligações ativas (atendidas) do rel003"""
    # app.logger.info(f"🔍 PROCESSAR LIGAÇÕES ATIVAS para setor: {setor}")
    # app.logger.info(f"📊 Atendentes: {len(atendentes)}, Registros API: {len(resultados_api)}")
    
    # Dicionário para contar ligações por atendente
    contador_ligacoes = {atendente['codigo']: 0 for atendente in atendentes}
    
    total_registros = len(resultados_api)
    atendidos_count = 0
    
    for i, registro in enumerate(resultados_api):
        if isinstance(registro, dict):
            status = registro.get('ligacao.statusFormatado', '')
            codigo_atendente = registro.get('ligacao.codigoAgenteOrigem', '')
            
            if status == 'Atendido':
                atendidos_count += 1
                
                if codigo_atendente and codigo_atendente in contador_ligacoes:
                    contador_ligacoes[codigo_atendente] += 1
    
    # Criar lista de resultados
    resultados_finais = []
    for atendente in atendentes:
        ligacoes = contador_ligacoes[atendente['codigo']]
        resultados_finais.append({
            'nome': atendente['nome'],
            'codigo': atendente['codigo'],
            'ligacoesAtivasMes': ligacoes
        })
    
    # Calcular total geral
    total_geral = sum(contador_ligacoes.values())
    
    # Ordenar por quantidade de ligações (do maior para o menor)
    resultados_finais.sort(key=lambda x: x['ligacoesAtivasMes'], reverse=True)
    
    resultado = {
        'data': resultados_finais,
        'totais': {
            'ligacoesAtivasMes': total_geral
        },
        'atualizado_em': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'cache_info': {
            'cached': cache_key is not None,
            'cache_key': cache_key,
            'cache_timestamp': datetime.now().isoformat(),
            'cache_expires_in': '1 hour'
        },
        'setor': setor
    }
    
    # app.logger.info(f"✅ Ligações ativas processadas para setor {setor}: {len(resultados_finais)} registros, total {total_geral}")
    return resultado

def processar_dados_ligacoes_recuperadas(atendentes, resultados_api, cache_key=None, setor=None):
    """DEBUG COMPLETO - Processa os dados de ligações recuperadas"""
    # app.logger.info(f"🔍 DEBUG LIGAÇÕES RECUPERADAS - Setor: {setor}")
    
    # 1. Verificar estrutura dos resultados_api
    # app.logger.info(f"📊 TIPO de resultados_api: {type(resultados_api)}")
    # app.logger.info(f"📊 LEN de resultados_api: {len(resultados_api) if hasattr(resultados_api, '__len__') else 'N/A'}")
    
    # 2. Amostra detalhada dos primeiros registros
    if resultados_api and hasattr(resultados_api, '__len__'):
        # app.logger.info("🔎 AMOSTRA DETALHADA DOS PRIMEIROS 3 REGISTROS:")
        for i in range(min(3, len(resultados_api))):
            registro = resultados_api[i]
            # app.logger.info(f"  --- Registro {i} ---")
            # app.logger.info(f"  Tipo: {type(registro)}")
            if isinstance(registro, dict):
                for key, value in registro.items():
                    # app.logger.info(f"  {key}: {repr(value)}")
                    pass
            else:
                # app.logger.info(f"  Conteúdo: {repr(registro)}")
                pass
    
    # 3. Verificar TODOS os registros que têm "Alison" no agente
    # app.logger.info("🔍 BUSCANDO TODOS OS REGISTROS COM 'ALISON':")
    registros_alison = []
    if resultados_api and hasattr(resultados_api, '__len__'):
        for i, registro in enumerate(resultados_api):
            if isinstance(registro, dict):
                agente = registro.get('agente', '')
                if 'alison' in str(agente).lower():
                    registros_alison.append((i, registro))
    
    # app.logger.info(f"📊 Total de registros com 'Alison': {len(registros_alison)}")
    for i, registro in registros_alison:
        # app.logger.info(f"  Registro {i}:")
        # app.logger.info(f"    Agente: {registro.get('agente')}")
        # app.logger.info(f"    Origem: {registro.get('origem')}")
        # app.logger.info(f"    Status: {registro.get('status')}")
        # app.logger.info(f"    Data: {registro.get('data')}")
    
    # 4. Verificar se há registros com status "Concluído" (qualquer agente)
    # app.logger.info("🔍 VERIFICANDO REGISTROS COM STATUS 'CONCLUÍDO':")
        pass
    registros_concluidos = []
    if resultados_api and hasattr(resultados_api, '__len__'):
        for i, registro in enumerate(resultados_api):
            if isinstance(registro, dict):
                status = registro.get('status', '')
                if status == 'Concluído':
                    registros_concluidos.append((i, registro))
    
    # app.logger.info(f"📊 Total de registros com status 'Concluído': {len(registros_concluidos)}")
    for i, registro in registros_concluidos[:5]:  # Primeiros 5
        # app.logger.info(f"  Registro {i}:")
        # app.logger.info(f"    Agente: {registro.get('agente')}")
        # app.logger.info(f"    Origem: {registro.get('origem')}")
        # app.logger.info(f"    Status: {registro.get('status')}")
        # app.logger.info(f"    Data: {registro.get('data')}")
    
    # 5. Verificar códigos dos atendentes
    # app.logger.info("📋 LISTA DE ATENDENTES DO SETOR:")
        pass
    for atendente in atendentes:
        # app.logger.info(f"  {atendente['nome']} - Código: {atendente['codigo']}")
        pass
    
    # 6. Agora processar de fato
    contador_ligacoes_dia = {atendente['codigo']: 0 for atendente in atendentes}
    contador_ligacoes_mes = {atendente['codigo']: 0 for atendente in atendentes}
    
    hoje = datetime.now().date()
    total_processados = 0
    match_encontrados = 0
    
    if resultados_api and hasattr(resultados_api, '__len__'):
        for i, registro in enumerate(resultados_api):
            if not isinstance(registro, dict):
                continue
                
            total_processados += 1
            
            status = registro.get('status', '')
            origem = registro.get('origem', '')
            data_hora_str = registro.get('data', '')
            
            # VERIFICAÇÃO 1: Status
            if status != 'Concluído':
                continue
            
            # VERIFICAÇÃO 2: Origem existe
            if not origem:
                continue
            
            origem_limpa = str(origem).strip()
            
            # VERIFICAÇÃO 3: Origem está na lista de códigos
            if origem_limpa not in contador_ligacoes_dia:
                continue
            
            match_encontrados += 1
            
            # VERIFICAÇÃO 4: Data válida
            if not data_hora_str:
                continue
                
            try:
                data_parts = data_hora_str.strip().split(' ')
                data_str = data_parts[0] if data_parts else ''
                
                if not data_str:
                    continue
                    
                data_registro = datetime.strptime(data_str, '%d/%m/%Y').date()
                
                # Contar para mês
                contador_ligacoes_mes[origem_limpa] += 1
                
                # Contar para dia
                if data_registro == hoje:
                    contador_ligacoes_dia[origem_limpa] += 1
                    
            except Exception as e:
                app.logger.warning(f"Erro data registro {i}: {e}")
    
    # 7. Log dos resultados
    # app.logger.info("📊 RESULTADO DO PROCESSAMENTO:")
    # app.logger.info(f"  Total de registros: {len(resultados_api) if resultados_api else 0}")
    # app.logger.info(f"  Total processados: {total_processados}")
    # app.logger.info(f"  Match encontrados: {match_encontrados}")
    
    # app.logger.info("📊 CONTAGEM FINAL POR ATENDENTE:")
    for codigo in sorted(contador_ligacoes_dia.keys()):
        count_dia = contador_ligacoes_dia[codigo]
        count_mes = contador_ligacoes_mes[codigo]
        if count_dia > 0 or count_mes > 0:
            nome = next((a['nome'] for a in atendentes if a['codigo'] == codigo), codigo)
            # app.logger.info(f"  {nome} ({codigo}): Dia={count_dia}, Mês={count_mes}")
    
    # 8. Criar resultados
    resultados_dia = []
    resultados_mes = []
    
    for atendente in atendentes:
        codigo = atendente['codigo']
        
        resultados_dia.append({
            'nome': atendente['nome'],
            'codigo': codigo,
            'ligacoesRecuperadasDia': contador_ligacoes_dia[codigo]
        })
        
        resultados_mes.append({
            'nome': atendente['nome'],
            'codigo': codigo,
            'ligacoesRecuperadasMes': contador_ligacoes_mes[codigo]
        })
    
    # 9. Totais
    total_dia = sum(contador_ligacoes_dia.values())
    total_mes = sum(contador_ligacoes_mes.values())
    
    return {
        'dia': resultados_dia,
        'mes': resultados_mes,
        'totais': {
            'ligacoesRecuperadasDia': total_dia,
            'ligacoesRecuperadasMes': total_mes
        },
        'debug_info': {
            'total_registros': len(resultados_api) if resultados_api else 0,
            'total_processados': total_processados,
            'match_encontrados': match_encontrados,
            'data_hoje': hoje.strftime('%Y-%m-%d')
        },
        'atualizado_em': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'cache_info': {
            'cached': cache_key is not None,
            'cache_key': cache_key,
            'cache_timestamp': datetime.now().isoformat(),
            'cache_expires_in': '1 hour'
        },
        'setor': setor
    }

def get_cache_key(setor, tipo):
    """Retorna chave do cache baseada no setor, tipo e data"""
    hoje = datetime.now()
    if tipo == 'hoje':
        return f"{setor}_{tipo}_{hoje.strftime('%Y%m%d')}"
    elif tipo == 'mes':
        return f"{setor}_{tipo}_{hoje.strftime('%Y%m')}"
    elif tipo == '7dias':
        return f"{setor}_{tipo}_{hoje.strftime('%Y%m%d')}"
    elif tipo == 'ligacoesAtivasMes':
        return f"{setor}_{tipo}_{hoje.strftime('%Y%m')}"
    elif tipo == 'ligacoesRecuperadas':
        return f"{setor}_{tipo}_{hoje.strftime('%Y%m%d')}"
    return f"{setor}_{tipo}"

def atualizar_cache_ligacoes_ativas_background(setor):
    """Atualiza o cache de ligações ativas em background para um setor específico"""
    with background_lock:
        if background_tasks[setor]['ligacoesAtivasMes']['is_running']:
            # app.logger.info(f"Atualização de ligações ativas para {setor} já está em execução")
            return
        
        background_tasks[setor]['ligacoesAtivasMes']['is_running'] = True
        background_tasks[setor]['ligacoesAtivasMes']['last_started'] = datetime.now()
        background_tasks[setor]['ligacoesAtivasMes']['error'] = None
        background_tasks[setor]['ligacoesAtivasMes']['progress'] = 0
    
    def progress_callback(progress):
        with background_lock:
            background_tasks[setor]['ligacoesAtivasMes']['progress'] = progress
    
    def executar_atualizacao():
        try:
            # app.logger.info(f"🎬 Iniciando atualização em background de ligações ativas para {setor}...")
            
            # Definição de período
            hoje = datetime.now()
            primeiro_dia_mes = hoje.replace(day=1)
            ultimo_dia_mes = (primeiro_dia_mes + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            data_inicial = primeiro_dia_mes.strftime('%Y-%m-%d')
            data_final = ultimo_dia_mes.strftime('%Y-%m-%d')
            
            # Buscar dados com callback de progresso
            resultados_api = buscar_dados_ligacoes_ativas(data_inicial, data_final, progress_callback)
            
            # Se houver erro na API
            if isinstance(resultados_api, dict) and 'error' in resultados_api:
                app.logger.error(f"Erro ao buscar dados para {setor}: {resultados_api['error']}")
                with background_lock:
                    background_tasks[setor]['ligacoesAtivasMes']['error'] = resultados_api['error']
                return
            
            # Processar dados
            atendentes = SETORES.get(setor, [])
            dados_processados = processar_dados_ligacoes_ativas(atendentes, resultados_api, 'background', setor)
            
            # Atualizar cache
            with cache_lock:
                cache_key = get_cache_key(setor, 'ligacoesAtivasMes')
                cache[setor]['ligacoesAtivasMes']['data'] = dados_processados
                cache[setor]['ligacoesAtivasMes']['timestamp'] = datetime.now()
                cache[setor]['ligacoesAtivasMes']['hash'] = calcular_hash(dados_processados)
                cache[setor]['ligacoesAtivasMes']['periodo'] = f"{data_inicial} a {data_final}"
            
            # app.logger.info(f"✅ Atualização em background de ligações ativas para {setor} concluída com sucesso!")
            
        except Exception as e:
            app.logger.error(f"❌ Erro na atualização em background para {setor}: {str(e)}")
            app.logger.error(traceback.format_exc())
            with background_lock:
                background_tasks[setor]['ligacoesAtivasMes']['error'] = str(e)
        finally:
            with background_lock:
                background_tasks[setor]['ligacoesAtivasMes']['is_running'] = False
                background_tasks[setor]['ligacoesAtivasMes']['last_completed'] = datetime.now()
                background_tasks[setor]['ligacoesAtivasMes']['progress'] = 100
    
    # Executar em thread separada
    thread = threading.Thread(target=executar_atualizacao, daemon=True)
    thread.start()

def atualizar_cache_ligacoes_recuperadas_background(setor):
    """Atualiza o cache de ligações recuperadas em background para um setor específico"""
    with background_lock:
        if background_tasks[setor]['ligacoesRecuperadas']['is_running']:
            # app.logger.info(f"Atualização de ligações recuperadas para {setor} já está em execução")
            return
        
        background_tasks[setor]['ligacoesRecuperadas']['is_running'] = True
        background_tasks[setor]['ligacoesRecuperadas']['last_started'] = datetime.now()
        background_tasks[setor]['ligacoesRecuperadas']['error'] = None
        background_tasks[setor]['ligacoesRecuperadas']['progress'] = 0
    
    def progress_callback(progress):
        with background_lock:
            background_tasks[setor]['ligacoesRecuperadas']['progress'] = progress
    
    def executar_atualizacao():
        try:
            # app.logger.info(f"🎬 Iniciando atualização em background de ligações recuperadas para {setor}...")
            
            # Buscar dados do mês inteiro
            hoje = datetime.now()
            primeiro_dia_mes = hoje.replace(day=1)
            ultimo_dia_mes = (primeiro_dia_mes + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            data_inicial = primeiro_dia_mes.strftime('%Y-%m-%d')
            data_final = ultimo_dia_mes.strftime('%Y-%m-%d')
            
            resultados_api = buscar_dados_ligacoes_recuperadas(data_inicial, data_final, progress_callback)
            
            if isinstance(resultados_api, dict) and 'error' in resultados_api:
                app.logger.error(f"Erro ao buscar ligações recuperadas para {setor}: {resultados_api['error']}")
                with background_lock:
                    background_tasks[setor]['ligacoesRecuperadas']['error'] = resultados_api['error']
                return
            
            # Processar dados
            atendentes = SETORES.get(setor, [])
            dados_processados = processar_dados_ligacoes_recuperadas(atendentes, resultados_api, 'background', setor)
            
            # Atualizar cache
            with cache_lock:
                cache_key = get_cache_key(setor, 'ligacoesRecuperadas')
                cache[setor]['ligacoesRecuperadas']['data'] = dados_processados
                cache[setor]['ligacoesRecuperadas']['timestamp'] = datetime.now()
                cache[setor]['ligacoesRecuperadas']['hash'] = calcular_hash(dados_processados)
                cache[setor]['ligacoesRecuperadas']['periodo'] = f"{data_inicial} a {data_final}"
            
            # app.logger.info(f"✅ Atualização em background de ligações recuperadas para {setor} concluída!")
            
        except Exception as e:
            app.logger.error(f"❌ Erro na atualização em background de ligações recuperadas para {setor}: {str(e)}")
            app.logger.error(traceback.format_exc())
            with background_lock:
                background_tasks[setor]['ligacoesRecuperadas']['error'] = str(e)
        finally:
            with background_lock:
                background_tasks[setor]['ligacoesRecuperadas']['is_running'] = False
                background_tasks[setor]['ligacoesRecuperadas']['last_completed'] = datetime.now()
                background_tasks[setor]['ligacoesRecuperadas']['progress'] = 100
    
    thread = threading.Thread(target=executar_atualizacao, daemon=True)
    thread.start()

def atualizar_cache(setor, tipo, force=False, background=False):
    """Atualiza o cache se necessário para um setor específico"""
    # Verificar se setor existe
    if setor not in SETORES:
        app.logger.error(f"❌ Setor {setor} não encontrado")
        return None
    
    # app.logger.info(f"🔄 ATUALIZAR_CACHE chamado - Setor: {setor}, Tipo: {tipo}, Force: {force}")
    
    # Para ligações ativas, se for forçar e background estiver habilitado, usar background
    if tipo == 'ligacoesAtivasMes' and force and BACKGROUND_UPDATE_ENABLED:
        with background_lock:
            if background_tasks[setor]['ligacoesAtivasMes']['is_running']:
                # app.logger.info(f"Atualização em background para {setor} já está em execução, aguardando...")
                pass
            else:
                atualizar_cache_ligacoes_ativas_background(setor)
        
        return cache[setor][tipo]['data']
    
    # Para ligações recuperadas, se for forçar e background estiver habilitado, usar background
    if tipo == 'ligacoesRecuperadas' and force and BACKGROUND_UPDATE_ENABLED:
        with background_lock:
            if background_tasks[setor]['ligacoesRecuperadas']['is_running']:
                # app.logger.info(f"Atualização em background de ligações recuperadas para {setor} já está em execução")
                pass
            else:
                atualizar_cache_ligacoes_recuperadas_background(setor)
        
        # Retornar cache atual se existir
        with cache_lock:
            if cache[setor]['ligacoesRecuperadas']['data']:
                return cache[setor]['ligacoesRecuperadas']['data']
    
    with cache_lock:
        cache_key = get_cache_key(setor, tipo)
        
        precisa_atualizar = force or cache[setor][tipo]['data'] is None
        
        if not precisa_atualizar and cache[setor][tipo]['timestamp']:
            tempo_passado = datetime.now() - cache[setor][tipo]['timestamp']
            precisa_atualizar = tempo_passado.total_seconds() > (CACHE_DURATION_HOURS * 3600)
        
        if precisa_atualizar:
            try:
                # app.logger.info(f"🔄 Atualizando cache para {setor} - {tipo}")
                
                hoje = datetime.now()
                resultados_api = []
                periodo = ""
                atendentes = SETORES.get(setor, [])
                
                # app.logger.info(f"📋 Atendentes do setor {setor}: {len(atendentes)}")
                # app.logger.info(f"📋 Códigos: {[a['codigo'] for a in atendentes]}")
                
                if tipo == 'hoje':
                    data_hoje = hoje.strftime('%Y-%m-%d')
                    resultados_api = buscar_dados_escallo(data_hoje, data_hoje)
                    periodo = data_hoje
                elif tipo == 'mes':
                    primeiro_dia_mes = hoje.replace(day=1)
                    ultimo_dia_mes = (primeiro_dia_mes + timedelta(days=32)).replace(day=1) - timedelta(days=1)
                    data_inicial = primeiro_dia_mes.strftime('%Y-%m-%d')
                    data_final = ultimo_dia_mes.strftime('%Y-%m-%d')
                    resultados_api = buscar_dados_escallo(data_inicial, data_final)
                    periodo = f"{data_inicial} a {data_final}"
                elif tipo == '7dias':
                    sete_dias_atras = hoje - timedelta(days=7)
                    data_inicial = sete_dias_atras.strftime('%Y-%m-%d')
                    data_final = hoje.strftime('%Y-%m-%d')
                    resultados_api = buscar_dados_escallo(data_inicial, data_final)
                    periodo = f"{data_inicial} a {data_final}"
                elif tipo == 'ligacoesAtivasMes':
                    primeiro_dia_mes = hoje.replace(day=1)
                    ultimo_dia_mes = (primeiro_dia_mes + timedelta(days=32)).replace(day=1) - timedelta(days=1)
                    data_inicial = primeiro_dia_mes.strftime('%Y-%m-%d')
                    data_final = ultimo_dia_mes.strftime('%Y-%m-%d')
                    resultados_api = buscar_dados_ligacoes_ativas(data_inicial, data_final)
                    periodo = f"{data_inicial} a {data_final}"
                elif tipo == 'ligacoesRecuperadas':
                    # Buscar dados do mês inteiro para processar dia e mês juntos
                    primeiro_dia_mes = hoje.replace(day=1)
                    ultimo_dia_mes = (primeiro_dia_mes + timedelta(days=32)).replace(day=1) - timedelta(days=1)
                    data_inicial = primeiro_dia_mes.strftime('%Y-%m-%d')
                    data_final = ultimo_dia_mes.strftime('%Y-%m-%d')
                    resultados_api = buscar_dados_ligacoes_recuperadas(data_inicial, data_final)
                    periodo = f"{data_inicial} a {data_final}"
                else:
                    return None
                
                # Se houver erro na API, mantém dados antigos
                if isinstance(resultados_api, dict) and 'error' in resultados_api:
                    app.logger.error(f"Erro ao buscar dados para {setor} - {tipo}: {resultados_api['error']}")
                    if cache[setor][tipo]['data'] is not None:
                        app.logger.warning(f"Retornando cache antigo para {setor} - {tipo} devido a erro na API")
                        cache[setor][tipo]['timestamp'] = datetime.now()
                        return cache[setor][tipo]['data']
                    else:
                        if tipo == 'ligacoesAtivasMes':
                            dados_processados = processar_dados_ligacoes_ativas(atendentes, [], cache_key, setor)
                        elif tipo == 'ligacoesRecuperadas':
                            dados_processados = processar_dados_ligacoes_recuperadas(atendentes, [], cache_key, setor)
                        else:
                            dados_processados = processar_dados(atendentes, [], cache_key, setor)
                else:
                    if tipo == 'ligacoesAtivasMes':
                        dados_processados = processar_dados_ligacoes_ativas(atendentes, resultados_api, cache_key, setor)
                    elif tipo == 'ligacoesRecuperadas':
                        dados_processados = processar_dados_ligacoes_recuperadas(atendentes, resultados_api, cache_key, setor)
                    else:
                        dados_processados = processar_dados(atendentes, resultados_api, cache_key, setor)
                
                # Atualiza cache apenas se dados foram processados com sucesso
                cache[setor][tipo]['data'] = dados_processados
                cache[setor][tipo]['timestamp'] = datetime.now()
                cache[setor][tipo]['hash'] = calcular_hash(dados_processados)
                cache[setor][tipo]['periodo'] = periodo
                
                # app.logger.info(f"✅ Cache {setor} - {tipo} atualizado com sucesso: {len(dados_processados.get('data', []))} registros")
                return dados_processados
                
            except Exception as e:
                app.logger.error(f"❌ Erro crítico ao atualizar cache {setor} - {tipo}: {str(e)}")
                app.logger.error(traceback.format_exc())
                if cache[setor][tipo]['data'] is not None:
                    return cache[setor][tipo]['data']
                else:
                    if tipo == 'ligacoesAtivasMes':
                        return processar_dados_ligacoes_ativas(atendentes, [], cache_key, setor)
                    elif tipo == 'ligacoesRecuperadas':
                        return processar_dados_ligacoes_recuperadas(atendentes, [], cache_key, setor)
                    else:
                        return processar_dados(atendentes, [], cache_key, setor)
        
        # app.logger.info(f"📦 Retornando dados do cache para {setor} - {tipo}")
        return cache[setor][tipo]['data']

def iniciar_atualizador_periodico():
    """Inicia thread para atualização periódica do cache de todos os setores"""
    def atualizador():
        while True:
            try:
                for setor in SETORES.keys():
                    for tipo in ['hoje', 'mes', '7dias']:
                        atualizar_cache(setor, tipo, force=False)
                
                time.sleep(1800)
                
            except Exception as e:
                app.logger.error(f"Erro no atualizador periódico: {str(e)}")
                time.sleep(300)
    
    thread = threading.Thread(target=atualizador, daemon=True)
    thread.start()
    # app.logger.info("Atualizador periódico iniciado para todos os setores")

def iniciar_atualizador_ligacoes_background():
    """Inicia thread para atualização periódica de ligações ativas em background para todos os setores"""
    def atualizador_ligacoes():
        while True:
            try:
                time.sleep(7200)
                
                for setor in SETORES.keys():
                    with background_lock:
                        if background_tasks[setor]['ligacoesAtivasMes']['is_running']:
                            # app.logger.info(f"Atualização de ligações para {setor} já está em execução, pulando...")
                            continue
                    
                    atualizar_cache_ligacoes_ativas_background(setor)
                    time.sleep(10)
                
            except Exception as e:
                app.logger.error(f"Erro no atualizador de ligações: {str(e)}")
                time.sleep(600)
    
    thread = threading.Thread(target=atualizador_ligacoes, daemon=True)
    thread.start()
    # app.logger.info("Atualizador periódico de ligações ativas iniciado para todos os setores")

def iniciar_atualizador_ligacoes_recuperadas_background():
    """Inicia thread para atualização periódica de ligações recuperadas em background para todos os setores"""
    def atualizador_ligacoes_recuperadas():
        while True:
            try:
                time.sleep(7200)  # A cada 2 horas
                
                for setor in SETORES.keys():
                    with background_lock:
                        if background_tasks[setor]['ligacoesRecuperadas']['is_running']:
                            # app.logger.info(f"Atualização de ligações recuperadas para {setor} já está em execução, pulando...")
                            continue
                    
                    atualizar_cache_ligacoes_recuperadas_background(setor)
                    time.sleep(10)
                
            except Exception as e:
                app.logger.error(f"Erro no atualizador de ligações recuperadas: {str(e)}")
                time.sleep(600)
    
    thread = threading.Thread(target=atualizador_ligacoes_recuperadas, daemon=True)
    thread.start()
    # app.logger.info("Atualizador periódico de ligações recuperadas iniciado para todos os setores")

# ==================== ROTAS DA API ====================

@app.route('/api/teste-ligacoes-recuperadas', methods=['GET'])
def teste_ligacoes_recuperadas():
    """Rota de teste direto para debug"""
    hoje = datetime.now().strftime('%Y-%m-%d')
    # app.logger.info(f"🧪 TESTE DIRETO LIGAÇÕES RECUPERADAS - {hoje}")
    
    resultados = buscar_dados_ligacoes_recuperadas(hoje, hoje)
    
    return jsonify({
        'data_consulta': hoje,
        'total_registros': len(resultados),
        'primeiros_registros': resultados[:10] if resultados else [],
        'registros_concluidos': [r for r in resultados if isinstance(r, dict) and r.get('status') == 'Concluído'],
        'contagem_status': {
            'Concluído': len([r for r in resultados if isinstance(r, dict) and r.get('status') == 'Concluído']),
            'Outros': len([r for r in resultados if isinstance(r, dict) and r.get('status') != 'Concluído']),
            'Sem status': len([r for r in resultados if isinstance(r, dict) and not r.get('status')])
        }
    })

@app.route('/api/debug', methods=['GET'])
def debug_info():
    """Rota para debug do sistema"""
    info = {
        'servidor': {
            'data_hora': datetime.now().isoformat(),
            'cache_duration_hours': CACHE_DURATION_HOURS,
            'host_escallo': HOST,
            'token_length': len(TOKEN) if TOKEN else 0,
            'background_update_enabled': BACKGROUND_UPDATE_ENABLED,
            'setores_disponiveis': list(SETORES.keys()),
            'total_atendentes': {setor: len(atendentes) for setor, atendentes in SETORES.items()}
        },
        'cache': {},
        'background_tasks': background_tasks,
        'api_test': {}
    }
    
    try:
        hoje = datetime.now().strftime('%Y-%m-%d')
        test_result = buscar_dados_escallo(hoje, hoje)
        info['api_test'] = {
            'status': 'success' if not isinstance(test_result, dict) or 'error' not in test_result else 'error',
            'result_type': type(test_result).__name__,
            'result_length': len(test_result) if isinstance(test_result, list) else 0,
            'has_error': 'error' in test_result if isinstance(test_result, dict) else False
        }
    except Exception as e:
        info['api_test'] = {'status': 'exception', 'error': str(e)}
    
    for setor in SETORES.keys():
        info['cache'][setor] = {}
        for tipo in ['hoje', 'mes', '7dias', 'ligacoesAtivasMes', 'ligacoesRecuperadas']:
            if cache[setor][tipo]['timestamp']:
                idade = datetime.now() - cache[setor][tipo]['timestamp']
                info['cache'][setor][tipo] = {
                    'has_data': cache[setor][tipo]['data'] is not None,
                    'age_seconds': idade.total_seconds(),
                    'age_minutes': idade.total_seconds() / 60,
                    'timestamp': cache[setor][tipo]['timestamp'].isoformat(),
                    'periodo': cache[setor][tipo]['periodo'],
                    'registros': len(cache[setor][tipo]['data']['data']) if cache[setor][tipo]['data'] and 'data' in cache[setor][tipo]['data'] else 0
                }
    
    return jsonify(info)

@app.route('/api/dados/mes', methods=['GET'])
def dados_mes():
    """Rota para obter dados do mês atual"""
    setor = request.args.get(SETOR_PARAM, 'suporte')
    # app.logger.info(f"📥 /api/dados/mes - Setor recebido: {setor}")
    force = request.args.get(FORCE_REFRESH_PARAM, 'false').lower() == 'true'
    dados = atualizar_cache(setor, 'mes', force=force)
    
    if dados:
        dados['setor'] = setor
        # app.logger.info(f"📤 Respondendo /api/dados/mes: {len(dados.get('data', []))} registros para setor {setor}")
        return jsonify(dados)
    else:
        app.logger.error(f"❌ Setor {setor} não encontrado em /api/dados/mes")
        return jsonify({'error': f'Setor {setor} não encontrado ou dados não disponíveis'}), 404

@app.route('/api/dados/hoje', methods=['GET'])
def dados_hoje():
    """Rota para obter dados do dia atual"""
    setor = request.args.get(SETOR_PARAM, 'suporte')
    # app.logger.info(f"📥 /api/dados/hoje - Setor recebido: {setor}")
    force = request.args.get(FORCE_REFRESH_PARAM, 'false').lower() == 'true'
    dados = atualizar_cache(setor, 'hoje', force=force)
    
    if dados:
        dados['setor'] = setor
        # app.logger.info(f"📤 Respondendo /api/dados/hoje: {len(dados.get('data', []))} registros para setor {setor}")
        return jsonify(dados)
    else:
        app.logger.error(f"❌ Setor {setor} não encontrado em /api/dados/hoje")
        return jsonify({'error': f'Setor {setor} não encontrado ou dados não disponíveis'}), 404

@app.route('/api/dados/ultimos-7-dias', methods=['GET'])
def dados_ultimos_7_dias():
    """Rota para obter dados dos últimos 7 dias"""
    setor = request.args.get(SETOR_PARAM, 'suporte')
    force = request.args.get(FORCE_REFRESH_PARAM, 'false').lower() == 'true'
    dados = atualizar_cache(setor, '7dias', force=force)
    
    if dados:
        dados['setor'] = setor
        return jsonify(dados)
    else:
        return jsonify({'error': f'Setor {setor} não encontrado ou dados não disponíveis'}), 404

@app.route('/api/dados/ligacoes-ativas-mes', methods=['GET'])
def dados_ligacoes_ativas_mes():
    """Rota para obter o total de ligações ativas (atendidas) no mês, por atendente"""
    try:
        setor = request.args.get(SETOR_PARAM, 'suporte')
        # app.logger.info(f"📥 /api/dados/ligacoes-ativas-mes - Setor recebido: {setor}")
        force = request.args.get(FORCE_REFRESH_PARAM, 'false').lower() == 'true'
        
        dados = atualizar_cache(setor, 'ligacoesAtivasMes', force=force, background=True)
        
        if dados:
            with background_lock:
                dados['background_info'] = {
                    'is_updating': background_tasks[setor]['ligacoesAtivasMes']['is_running'],
                    'last_started': background_tasks[setor]['ligacoesAtivasMes']['last_started'].isoformat() if background_tasks[setor]['ligacoesAtivasMes']['last_started'] else None,
                    'last_completed': background_tasks[setor]['ligacoesAtivasMes']['last_completed'].isoformat() if background_tasks[setor]['ligacoesAtivasMes']['last_completed'] else None,
                    'progress': background_tasks[setor]['ligacoesAtivasMes']['progress'],
                    'has_error': background_tasks[setor]['ligacoesAtivasMes']['error'] is not None
                }
                dados['setor'] = setor
            
            # app.logger.info(f"📤 Respondendo /api/dados/ligacoes-ativas-mes: {len(dados.get('data', []))} registros para setor {setor}")
            return jsonify(dados)
        else:
            app.logger.error(f"❌ Setor {setor} não encontrado em /api/dados/ligacoes-ativas-mes")
            return jsonify({'error': f'Setor {setor} não encontrado ou dados não disponíveis'}), 404
        
    except Exception as e:
        app.logger.error(f"❌ Erro em /api/dados/ligacoes-ativas-mes: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/dados/ligacoes-recuperadas', methods=['GET'])
def dados_ligacoes_recuperadas():
    """Rota para obter o total de ligações recuperadas no dia e no mês, por atendente"""
    try:
        setor = request.args.get(SETOR_PARAM, 'suporte')
        # app.logger.info(f"📥 /api/dados/ligacoes-recuperadas - Setor recebido: {setor}")
        force = request.args.get(FORCE_REFRESH_PARAM, 'false').lower() == 'true'
        
        # Para ligações recuperadas, usar background se for forçar
        if force and BACKGROUND_UPDATE_ENABLED:
            with background_lock:
                if background_tasks[setor]['ligacoesRecuperadas']['is_running']:
                    # app.logger.info(f"Atualização em background para {setor} já está em execução")
                    pass
                else:
                    atualizar_cache_ligacoes_recuperadas_background(setor)
            
            # Retornar cache atual se existir
            with cache_lock:
                if cache[setor]['ligacoesRecuperadas']['data']:
                    dados = cache[setor]['ligacoesRecuperadas']['data']
                else:
                    # Se não houver cache, buscar síncrono
                    dados = atualizar_cache(setor, 'ligacoesRecuperadas', force=True)
        else:
            dados = atualizar_cache(setor, 'ligacoesRecuperadas', force=force)
        
        if dados:
            with background_lock:
                dados['background_info'] = {
                    'is_updating': background_tasks[setor]['ligacoesRecuperadas']['is_running'],
                    'last_started': background_tasks[setor]['ligacoesRecuperadas']['last_started'].isoformat() if background_tasks[setor]['ligacoesRecuperadas']['last_started'] else None,
                    'last_completed': background_tasks[setor]['ligacoesRecuperadas']['last_completed'].isoformat() if background_tasks[setor]['ligacoesRecuperadas']['last_completed'] else None,
                    'progress': background_tasks[setor]['ligacoesRecuperadas']['progress'],
                    'has_error': background_tasks[setor]['ligacoesRecuperadas']['error'] is not None
                }
                dados['setor'] = setor
            
            # app.logger.info(f"📤 Respondendo /api/dados/ligacoes-recuperadas: {len(dados.get('dia', []))} registros para setor {setor}")
            return jsonify(dados)
        else:
            app.logger.error(f"❌ Setor {setor} não encontrado em /api/dados/ligacoes-recuperadas")
            return jsonify({'error': f'Setor {setor} não encontrado ou dados não disponíveis'}), 404
        
    except Exception as e:
        app.logger.error(f"❌ Erro em /api/dados/ligacoes-recuperadas: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/limpar-cache', methods=['POST'])
def limpar_cache():
    """Limpa todo o cache (para debug e testes)"""
    with cache_lock:
        for setor in SETORES.keys():
            for tipo in ['hoje', 'mes', '7dias', 'ligacoesAtivasMes', 'ligacoesRecuperadas']:
                cache[setor][tipo]['data'] = None
                cache[setor][tipo]['timestamp'] = None
                cache[setor][tipo]['hash'] = None
        
        # app.logger.info("🧹 Cache limpo com sucesso")
        pass
        return jsonify({'status': 'success', 'message': 'Cache limpo para todos os setores'})

@app.route('/api/teste-comercial', methods=['GET'])
def teste_comercial():
    """Teste direto para verificar se a API do Escallo tem dados do comercial"""
    hoje = datetime.now().strftime('%Y-%m-%d')
    # app.logger.info(f"🧪 TESTE COMERCIAL - buscando dados para {hoje}")
    
    resultados = buscar_dados_escallo(hoje, hoje)
    
    if isinstance(resultados, dict) and 'error' in resultados:
        return jsonify({'error': resultados['error']}), 500
    
    # Filtrar códigos do comercial
    codigos_comercial = [a['codigo'] for a in SETORES['comercial']]
    encontrados = []
    
    for resultado in resultados:
        if isinstance(resultado, dict):
            codigo = str(resultado.get('codigo', ''))
            if codigo in codigos_comercial:
                encontrados.append({
                    'codigo': codigo,
                    'nome': resultado.get('nome', ''),
                    'ligacoesOferecidas': resultado.get('ligacoesOferecidas', 0),
                    'ligacoesOferecidasAtendidas': resultado.get('ligacoesOferecidasAtendidas', 0)
                })
    
    # app.logger.info(f"🧪 Resultado teste comercial: {len(encontrados)} encontrados")
    
    return jsonify({
        'data_consulta': hoje,
        'total_registros_api': len(resultados),
        'codigos_comercial': codigos_comercial,
        'encontrados_no_api': encontrados,
        'total_encontrados': len(encontrados),
        'amostra_registros_api': resultados[:10] if resultados else []
    })

# ==================== ROTAS ADICIONAIS ====================

@app.route('/api/background/status', methods=['GET'])
def background_status():
    """Rota para verificar status das atualizações em background"""
    with background_lock:
        status_info = {}
        for setor in SETORES.keys():
            status_info[setor] = {}
            for task_name, task_info in background_tasks[setor].items():
                status_info[setor][task_name] = {
                    'is_running': task_info['is_running'],
                    'last_started': task_info['last_started'].isoformat() if task_info['last_started'] else None,
                    'last_completed': task_info['last_completed'].isoformat() if task_info['last_completed'] else None,
                    'progress': task_info['progress'],
                    'error': task_info['error']
                }
    
    return jsonify({
        'background_tasks': status_info,
        'current_time': datetime.now().isoformat(),
        'setores': list(SETORES.keys())
    })

@app.route('/api/background/trigger-update', methods=['POST'])
def trigger_background_update():
    """Rota para forçar atualização em background"""
    try:
        tipo = request.json.get('tipo', 'ligacoesAtivasMes')
        setor = request.json.get('setor', 'suporte')
        
        if setor not in SETORES:
            return jsonify({'error': f'Setor {setor} não encontrado'}), 404
        
        if tipo == 'ligacoesAtivasMes':
            atualizar_cache_ligacoes_ativas_background(setor)
            return jsonify({
                'status': 'success',
                'message': f'Atualização em background iniciada para {setor}',
                'tipo': tipo,
                'setor': setor,
                'timestamp': datetime.now().isoformat()
            })
        elif tipo == 'ligacoesRecuperadas':
            atualizar_cache_ligacoes_recuperadas_background(setor)
            return jsonify({
                'status': 'success',
                'message': f'Atualização em background de ligações recuperadas iniciada para {setor}',
                'tipo': tipo,
                'setor': setor,
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'error': f'Atualização em background não implementada para {tipo}'}), 400
        
    except Exception as e:
        app.logger.error(f"Erro ao acionar atualização em background: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/setores', methods=['GET'])
def listar_setores():
    """Rota para listar todos os setores disponíveis"""
    setores_info = {}
    for setor, atendentes in SETORES.items():
        setores_info[setor] = {
            'quantidade_atendentes': len(atendentes),
            'atendentes': atendentes
        }
    
    return jsonify({
        'setores': setores_info,
        'total_setores': len(SETORES)
    })

@app.route('/api/status', methods=['GET'])
def status():
    """Rota para verificar status do servidor"""
    with background_lock:
        background_status = {}
        for setor in SETORES.keys():
            ligacoes_status = background_tasks[setor]['ligacoesAtivasMes']
            recuperadas_status = background_tasks[setor]['ligacoesRecuperadas']
            background_status[setor] = {
                'ligacoesAtivasMes': {
                    'is_running': ligacoes_status['is_running'],
                    'last_started': ligacoes_status['last_started'].isoformat() if ligacoes_status['last_started'] else None,
                    'last_completed': ligacoes_status['last_completed'].isoformat() if ligacoes_status['last_completed'] else None
                },
                'ligacoesRecuperadas': {
                    'is_running': recuperadas_status['is_running'],
                    'last_started': recuperadas_status['last_started'].isoformat() if recuperadas_status['last_started'] else None,
                    'last_completed': recuperadas_status['last_completed'].isoformat() if recuperadas_status['last_completed'] else None
                }
            }
    
    return jsonify({
        'status': 'online',
        'servidor': 'API Escallo Dashboard',
        'versao': '2.0.0',
        'atualizado_em': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'setores_disponiveis': list(SETORES.keys()),
        'total_atendentes': {setor: len(atendentes) for setor, atendentes in SETORES.items()},
        'cache_config': {
            'duracao_horas': CACHE_DURATION_HOURS,
            'auto_atualizacao': True,
            'background_update': BACKGROUND_UPDATE_ENABLED
        },
        'background_tasks': background_status
    })

# ==================== INICIALIZAÇÃO ====================

if __name__ == '__main__':
    # Configurar logging
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Inicializa cache na primeira execução
    # print("Inicializando cache para todos os setores...")
    
    def inicializar_cache_com_retry():
        """Inicializa cache com retry em caso de falha"""
        max_retries = 3
        for tentativa in range(max_retries):
            try:
                # print(f"\n=== Tentativa {tentativa + 1} de {max_retries} ===")
                
                # Ordem de inicialização: primeiro os mais rápidos para cada setor
                for setor in SETORES.keys():
                    # print(f"\nInicializando cache para setor: {setor}")
                    # print(f"  Quantidade de atendentes: {len(SETORES[setor])}")
                    # print(f"  Códigos: {[a['codigo'] for a in SETORES[setor]]}")
                    
                    for tipo in ['hoje', 'mes', '7dias']:
                        # print(f"    Inicializando cache para {tipo}...")
                        dados = atualizar_cache(setor, tipo, force=True)
                        if dados:
                            # print(f"      ✅ {len(dados.get('data', []))} registros")
                            pass
                        time.sleep(1)
                        
                    
                    # Ligações ativas - inicia em background
                    # print(f"    Inicializando cache para ligacoesAtivasMes em background...")
                    atualizar_cache_ligacoes_ativas_background(setor)
                    
                    # Ligações recuperadas - inicia em background
                    # print(f"    Inicializando cache para ligacoesRecuperadas em background...")
                    atualizar_cache_ligacoes_recuperadas_background(setor)
                
                # print("\n✅ Cache inicializado com sucesso para todos os setores!")
                return True
            except Exception as e:
                # print(f"\n❌ Erro na tentativa {tentativa + 1}: {str(e)}")
                # print(traceback.format_exc())
                if tentativa < max_retries - 1:
                    # print(f"Aguardando 10 segundos antes de tentar novamente...")
                    time.sleep(10)
        
        # print("\n❌ Falha ao inicializar cache após todas as tentativas")
        return False
    
    # Tenta inicializar o cache
    if not inicializar_cache_com_retry():
        # print("⚠️ AVISO: Sistema iniciado com cache vazio. O front-end pode não funcionar até a primeira atualização automática.")
        pass
    
    # Inicia thread de atualização periódica
    iniciar_atualizador_periodico()
    iniciar_atualizador_ligacoes_background()
    iniciar_atualizador_ligacoes_recuperadas_background()
    
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('DEBUG', 'False').lower() == 'true'
    
    # print(f"\n{'='*50}")
    # print("🎯 Servidor Escallo Dashboard")
    # print(f"{'='*50}")
    # print(f"📡 Porta: {port}")
    # print(f"⏱️  Cache: {CACHE_DURATION_HOURS} hora(s)")
    # print(f"🔄 Background update: {BACKGROUND_UPDATE_ENABLED}")
    # print(f"🐛 Debug: {debug}")
    # print(f"👥 Setores: {', '.join(SETORES.keys())}")
    for setor, atendentes in SETORES.items():
        # print(f"   • {setor.capitalize()}: {len(atendentes)} atendentes")
    # print(f"🌐 Host Escallo: {HOST}")
    # print(f"\n🔗 Rotas disponíveis:")
    # print(f"   GET  /api/status                - Status do servidor")
    # print(f"   GET  /api/status-cache          - Status do cache")
    # print(f"   GET  /api/setores               - Lista de setores")
    # print(f"   GET  /api/debug                 - Informações de debug")
    # print(f"   GET  /api/teste-comercial       - Teste de dados do comercial")
    # print(f"   POST /api/limpar-cache          - Limpa o cache")
    # print(f"   GET  /api/dados/hoje?setor=...  - Dados do dia")
    # print(f"   GET  /api/dados/mes?setor=...   - Dados do mês")
    # print(f"   GET  /api/dados/ligacoes-ativas-mes?setor=... - Ligações ativas")
    # print(f"   GET  /api/dados/ligacoes-recuperadas?setor=... - Ligações recuperadas")
    # print(f"{'='*50}\n")
        pass
    
    app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=False)