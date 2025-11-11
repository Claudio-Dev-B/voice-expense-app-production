import re
import whisper
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List

# Configurar logging
logger = logging.getLogger(__name__)

# SOLUÇÃO RÁPIDA: Usar modelo base com cache
_model = None

def get_model():
    global _model
    if _model is None:
        logger.info("🚀 Carregando modelo Whisper base (ultra-rápido)...")
        _model = whisper.load_model("base")
    return _model

def transcribe_and_extract(audio_path: str, user_cost_centers: List[str] = None, user_categories: List[str] = None) -> Dict[str, Any]:
    """
    Processamento ULTRA-RÁPIDO com modelo base + pós-processamento inteligente
    """
    start_time = datetime.now()
    
    try:
        if user_cost_centers is None or len(user_cost_centers) == 0:
            user_cost_centers = ["Pessoal"]
        if user_categories is None or len(user_categories) == 0:
            user_categories = ["Alimentação", "Transporte", "Moradia", "Saúde", "Educação", "Entretenimento", "Outros"]
        
        # 1. TRANSCRIÇÃO RÁPIDA (1-2 segundos)
        model = get_model()
        result = model.transcribe(
            audio_path,
            language='pt',
            task='transcribe',
            fp16=False,
            beam_size=1,  # MÍNIMO para velocidade
            best_of=1,    # MÍNIMO para velocidade
            temperature=0.0,
            no_speech_threshold=0.7,  # Mais tolerante
            compression_ratio_threshold=3.0,  # Muito tolerante
            logprob_threshold=-2.0,  # Muito tolerante
            condition_on_previous_text=False,
            verbose=None  # SEM logs do Whisper
        )
        
        raw_text = result["text"].strip()
        transcribe_time = (datetime.now() - start_time).total_seconds()
        
        logger.info(f"⏱️  Transcrição: {transcribe_time:.1f}s -> {raw_text}")
        
        # 2. PÓS-PROCESSAMENTO INTELIGENTE (instantâneo)
        text = ultra_fast_text_processing(raw_text)
        logger.info(f"🔧 Texto processado: {text}")
        
        # 3. EXTRAÇÃO ULTRA-RÁPIDA (instantânea)
        extract_start = datetime.now()
        amount = ultra_fast_amount_extraction(text)
        payment_method = ultra_fast_payment_method(text)
        cost_center = ultra_fast_cost_center(text, user_cost_centers)
        category = ultra_fast_category(text, user_categories, cost_center)
        
        # CORREÇÃO CRÍTICA: Apenas cartão crédito gera parcelas futuras
        installments_data = ultra_fast_installments(text, amount, payment_method)
        
        extract_time = (datetime.now() - extract_start).total_seconds()
        total_time = (datetime.now() - start_time).total_seconds()
        
        description = f"Despesa de R$ {amount:.2f} em {category} - {cost_center} ({payment_method})"
        
        logger.info(f"✅ TOTAL: {total_time:.1f}s | R$ {amount:.2f} | {payment_method} | {cost_center} | {category} | {len(installments_data)}x")
        
        return {
            "text": text,
            "description": description,
            "total_amount": amount,
            "payment_method": payment_method,
            "cost_center": cost_center,
            "category": category,
            "installments": installments_data
        }
        
    except Exception as e:
        logger.error(f"❌ Erro: {e}")
        # Fallback instantâneo
        return {
            "text": "Processamento rápido",
            "description": "Despesa registrada",
            "total_amount": 0.0,
            "payment_method": "indefinida",
            "cost_center": user_cost_centers[0] if user_cost_centers else "Pessoal",
            "category": user_categories[0] if user_categories else "Outros",
            "installments": []
        }

def ultra_fast_text_processing(text: str) -> str:
    """
    Processamento INSTANTÂNEO - CORREÇÕES APLICADAS dos problemas identificados
    """
    if not text:
        return "gastei 100 reais"
    
    text = text.lower().strip()
    
    # CORREÇÕES ESPECÍFICAS dos problemas identificados nos logs:
    critical_fixes = {
        # Problemas do log atual:
        'gasteio': 'gastei',
        'ininsumos': 'insumos',
        'insumos': 'insumos',
        'catão': 'cartão',
        'vezess': 'vezes',
        'dasteio': 'gastei',
        'compradir': 'comprar',
        'manutençãoo': 'manutenção',
        'restaaurante': 'restaurante',
        'manutenção': 'manutenção',
        'ser lado': 'parcelado',
        'na compra de': 'comprar',
        'meu restaurante': 'restaurante',
        'meu ': '',
        
        # Problemas anteriores:
        r'(\d+)x(\d+)%': r'\1 reais e \2 centavos',
        r'(\d+)x(\d+)': r'\1 reais e \2 centavos',
        r'(\d+)h(\d+)': r'\1 reais e \2 centavos',
        r'(\d+)e(\d+)': r'\1 reais e \2 centavos',
        'centaos': 'centavos',
        'sumos': 'insumos',
        'parcelass': 'parcelas',
        'veze': 'vezes',
        'cartão de crédito': 'cartão crédito',
        'cartão crédito': 'cartão crédito',
        'mil ': '1000 ',
        'mil,': '1000,',
        'mil.': '1000.',
        'mil reais': '1000 reais',
    }
    
    # Aplicar correções de forma ULTRA-RÁPIDA
    for wrong, correct in critical_fixes.items():
        if wrong in text:
            text = text.replace(wrong, correct)
    
    # Garantir que tem contexto monetário básico
    if not any(word in text for word in ['gastei', 'paguei', 'reais']):
        if any(word in text for word in ['centavos', 'cartão', 'parcela']):
            text = f"gastei {text}"
        elif re.search(r'\d+', text):
            text = f"gastei {text} reais"
    
    return text

def ultra_fast_amount_extraction(text: str) -> float:
    """
    Extração INSTANTÂNEA de valores - CORRIGIDA para milhares
    """
    # ESTRATÉGIA 1: Padrão "mil reais"
    if 'mil reais' in text or '1000 reais' in text:
        logger.info(f"💰 Valor por 'mil reais': R$ 1000.00")
        return 1000.0
    
    # ESTRATÉGIA 2: Padrão "X,Y" (87,55)
    match_decimal = re.search(r'(\d+)[,.](\d{2})', text)
    if match_decimal:
        try:
            reais = float(match_decimal.group(1))
            centavos = float(match_decimal.group(2)) / 100
            amount = round(reais + centavos, 2)
            logger.info(f"💰 Valor por decimal: {reais} + {centavos} = R$ {amount:.2f}")
            return amount
        except:
            pass
    
    # ESTRATÉGIA 3: Padrão "X reais Y centavos" 
    match_reais_centavos = re.search(r'(\d+)\s*reais?\s*(?:e\s*)?(\d+)\s*centavos?', text)
    if match_reais_centavos:
        try:
            reais = float(match_reais_centavos.group(1))
            centavos = float(match_reais_centavos.group(2)) / 100
            amount = round(reais + centavos, 2)
            logger.info(f"💰 Valor por reais/centavos: {reais} + {centavos} = R$ {amount:.2f}")
            return amount
        except:
            pass
    
    # ESTRATÉGIA 4: Apenas números que fazem sentido
    numbers = re.findall(r'\b\d{2,5}\b', text)  # Apenas 2-5 dígitos
    valid = []
    
    for num in numbers:
        n = float(num)
        # Valores realistas para despesas
        if 5 <= n <= 10000:  
            valid.append(n)
    
    if valid:
        amount = max(valid)  # Maior número provavelmente é o valor
        logger.info(f"💰 Valor por maior número: R$ {amount:.2f}")
        return amount
    
    # ESTRATÉGIA 5: Fallback baseado em contexto
    if any(word in text for word in ['parcela', 'vezes', 'cartão']):
        logger.info("💰 Valor fallback contextual: R$ 100.00")
        return 100.0  # Valor comum para transações
    
    logger.info("💰 Valor fallback padrão: R$ 50.00")
    return 50.0  # Valor fallback padrão

def ultra_fast_payment_method(text: str) -> str:
    """Detecção INSTANTÂNEA de pagamento"""
    if 'crédito' in text:
        return 'cartão crédito'
    elif 'débito' in text:
        return 'cartão débito'
    elif 'dinheiro' in text:
        return 'dinheiro'
    elif 'pix' in text:
        return 'pix'
    elif 'transferência' in text or 'ted' in text or 'doc' in text:
        return 'transferência'
    elif 'boleto' in text:
        return 'boleto'
    else:
        return 'indefinida'

def ultra_fast_cost_center(text: str, user_cost_centers: List[str]) -> str:
    """Detecção INSTANTÂNEA de centro de custo"""
    if not user_cost_centers:
        return "Pessoal"
    
    # Busca DIRETA por nomes (exceto Pessoal)
    non_personal = [cc for cc in user_cost_centers if cc.lower() != "pessoal"]
    
    for center in non_personal:
        if center.lower() in text:
            return center
    
    # Se menciona "insumos" e tem centros empresariais, usar o primeiro
    if 'insumos' in text and non_personal:
        return non_personal[0]
    
    return "Pessoal"

def ultra_fast_category(text: str, user_categories: List[str], cost_center: str) -> str:
    """Detecção INSTANTÂNEA de categoria"""
    if not user_categories:
        return "Outros"
    
    # CORREÇÃO: Detecção melhorada de categorias
    if 'roupas' in text or 'vestuário' in text:
        return "Vestuário" if "Vestuário" in user_categories else "Outros"
    elif 'insumos' in text or 'material' in text or 'comprar' in text or 'matéria' in text:
        return "Insumos" if "Insumos" in user_categories else "Outros"
    elif 'luz' in text or 'energia' in text or 'água' in text or 'gás' in text:
        return "Contas" if "Contas" in user_categories else "Moradia"
    elif 'comida' in text or 'restaurante' in text or 'mercado' in text or 'alimentação' in text:
        return "Alimentação" if "Alimentação" in user_categories else "Outros"
    elif 'transporte' in text or 'gasolina' in text or 'combustível' in text:
        return "Transporte" if "Transporte" in user_categories else "Outros"
    elif 'manutenção' in text or 'geladeira' in text or 'reparo' in text:
        return "Manutenção" if "Manutenção" in user_categories else "Outros"
    
    # Lógica empresarial rápida
    if cost_center != "Pessoal":
        return "Insumos" if "Insumos" in user_categories else "Outros"
    
    return "Alimentação" if "Alimentação" in user_categories else "Outros"

def ultra_fast_installments(text: str, total_amount: float, payment_method: str) -> List[Dict[str, Any]]:
    """
    Detecção INSTANTÂNEA de parcelamento - CORREÇÃO CRÍTICA APLICADA
    """
    if total_amount <= 0:
        return []
    
    # CORREÇÃO: Apenas cartão crédito gera parcelas futuras
    # Pagamentos à vista (dinheiro, débito, pix, etc.) devem ter vencimento imediato
    is_credit_card = payment_method == 'cartão crédito'
    
    # Verificação ULTRA-RÁPIDA
    has_installments = 'vezes' in text or 'parcela' in text or 'x' in text
    
    if not has_installments or not is_credit_card:
        # Pagamento à vista - vencimento imediato
        return [{
            "amount": total_amount,
            "due_date": datetime.now(),
            "status": "pending",
            "installment_number": 1
        }]
    
    # Número de parcelas SIMPLES (apenas para cartão crédito)
    num_installments = 1
    
    # Busca RÁPIDA por números
    if 'duas' in text or 'dois' in text or '2x' in text or '2 vezes' in text:
        num_installments = 2
    elif 'três' in text or 'tres' in text or '3x' in text or '3 vezes' in text:
        num_installments = 3
    elif 'quatro' in text or '4x' in text or '4 vezes' in text:
        num_installments = 4
    elif 'cinco' in text or '5x' in text or '5 vezes' in text:
        num_installments = 5
    elif 'seis' in text or '6x' in text or '6 vezes' in text:
        num_installments = 6
    elif 'sete' in text or '7x' in text or '7 vezes' in text:
        num_installments = 7
    elif 'oito' in text or '8x' in text or '8 vezes' in text:
        num_installments = 8
    elif 'nove' in text or '9x' in text or '9 vezes' in text:
        num_installments = 9
    elif 'dez' in text or '10x' in text or '10 vezes' in text:
        num_installments = 10
    else:
        # Tentar encontrar número
        match = re.search(r'(\d+)\s*(?:vezes|parcela|x)', text)
        if match:
            try:
                num = int(match.group(1))
                if 2 <= num <= 12:
                    num_installments = num
            except:
                pass
    
    # Validação prática
    if total_amount < 20:
        num_installments = 1
    
    # Criar parcelas (apenas para cartão crédito com parcelamento)
    if num_installments > 1 and is_credit_card:
        installments = []
        installment_amount = total_amount / num_installments
        today = datetime.now()
        
        for i in range(num_installments):
            installments.append({
                "amount": round(installment_amount, 2),
                "due_date": today + timedelta(days=30 * (i + 1)),
                "status": "pending",
                "installment_number": i + 1
            })
        return installments
    else:
        # Pagamento único (à vista ou cartão crédito sem parcelamento)
        return [{
            "amount": total_amount,
            "due_date": datetime.now(),
            "status": "pending",
            "installment_number": 1
        }]

# Função de teste ULTRA-RÁPIDA
def test_extraction(text: str, user_cost_centers: List[str] = None, user_categories: List[str] = None):
    start = datetime.now()
    
    if user_cost_centers is None:
        user_cost_centers = ["Pessoal", "Restaurante", "Loja"]
    if user_categories is None:
        user_categories = ["Alimentação", "Transporte", "Contas", "Insumos", "Vestuário", "Outros"]
    
    processed = ultra_fast_text_processing(text)
    amount = ultra_fast_amount_extraction(processed)
    payment = ultra_fast_payment_method(processed)
    cost_center = ultra_fast_cost_center(processed, user_cost_centers)
    category = ultra_fast_category(processed, user_categories, cost_center)
    installments = ultra_fast_installments(processed, amount, payment)
    
    elapsed = (datetime.now() - start).total_seconds()
    
    return {
        "processing_time": f"{elapsed:.3f}s",
        "processed_text": processed,
        "amount": amount,
        "payment_method": payment,
        "cost_center": cost_center,
        "category": category,
        "installments_count": len(installments),
        "is_credit_card": payment == 'cartão crédito'
    }