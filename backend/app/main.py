from fastapi import FastAPI, HTTPException, Depends, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, func, extract
from datetime import datetime, timedelta
from typing import Optional, List
import logging
from dateutil.relativedelta import relativedelta
import io
import csv
from fastapi.responses import StreamingResponse

from app.models import User, Expense, CostCenter, Category, Installment, PaymentStatus, UserType
from app.db import get_session, init_db as create_db_and_tables
from app.nlu.transcribe import transcribe_and_extract

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VoiceExpense API", version="1.0.0")

# CORS CONFIGURADO CORRETAMENTE
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite todas as origens em desenvolvimento
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    """Inicialização robusta com fallbacks"""
    try:
        # Verificar conexão primeiro
        from app.db import check_database_connection
        if check_database_connection():
            init_db()
        else:
            logger.warning("Banco não disponível, mas app continuará rodando")
    except Exception as e:
        logger.error(f"Erro na inicialização: {e}")
        # App continua rodando mesmo com erro no banco

# ===== UTILITÁRIOS =====

def get_date_filters(start_date: Optional[str], end_date: Optional[str]):
    """Converte strings de data para objetos datetime"""
    start_dt = None
    end_dt = None
    
    try:
        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    except ValueError as e:
        logger.warning(f"Erro ao converter datas: {e}")
    
    return start_dt, end_dt

# ===== ENDPOINTS DE USUÁRIO =====

@app.post("/api/users")
async def create_or_update_user(user_data: dict, session: Session = Depends(get_session)):
    """Cria ou atualiza usuário baseado no email"""
    try:
        email = user_data.get("email")
        existing_user = session.exec(select(User).where(User.email == email)).first()
        
        if existing_user:
            # Atualizar usuário existente
            if "name" in user_data:
                existing_user.name = user_data["name"]
            if "google_id" in user_data:
                existing_user.google_id = user_data["google_id"]
            session.add(existing_user)
            session.commit()
            session.refresh(existing_user)
            return existing_user
        else:
            # Criar novo usuário
            new_user = User(
                email=email,
                name=user_data.get("name", "Usuário"),
                google_id=user_data.get("google_id")
            )
            session.add(new_user)
            session.commit()
            session.refresh(new_user)
            return new_user
    except Exception as e:
        session.rollback()
        logger.exception("Erro ao criar/atualizar usuário")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/email/{email}")
async def get_user_by_email(email: str, session: Session = Depends(get_session)):
    """Busca usuário por email"""
    try:
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        return user
    except Exception as e:
        logger.exception("Erro ao buscar usuário por email")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/{user_id}")
async def get_user_info(user_id: int, session: Session = Depends(get_session)):
    """Retorna informações completas do usuário incluindo cost centers e categorias"""
    try:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        # Buscar cost centers do usuário
        cost_centers = session.exec(
            select(CostCenter).where(CostCenter.user_id == user_id)
        ).all()
        
        # Buscar categorias do usuário
        categories = session.exec(
            select(Category).where(Category.user_id == user_id)
        ).all()
        
        return {
            **user.dict(),
            "cost_centers": [cc.dict() for cc in cost_centers],
            "categories": [cat.dict() for cat in categories]
        }
    except Exception as e:
        logger.exception("Erro ao buscar informações do usuário")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ENDPOINTS DE ONBOARDING =====

@app.post("/api/onboarding")
async def complete_onboarding(onboarding_data: dict, session: Session = Depends(get_session)):
    """Completa o onboarding do usuário criando cost centers e categorias"""
    try:
        user_id = onboarding_data.get("user_id")
        user_type = onboarding_data.get("user_type", "pessoal")
        cost_centers = onboarding_data.get("cost_centers", [])
        categories = onboarding_data.get("categories", [])
        
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        # Atualizar tipo de usuário
        user.user_type = UserType(user_type)
        user.onboarding_completed = True
        
        # Criar cost centers
        for cc_name in cost_centers:
            # Verificar se já existe
            existing_cc = session.exec(
                select(CostCenter).where(
                    CostCenter.user_id == user_id,
                    CostCenter.name == cc_name
                )
            ).first()
            
            if not existing_cc:
                cost_center = CostCenter(
                    name=cc_name,
                    user_id=user_id,
                    is_personal=cc_name.lower() == "pessoal"
                )
                session.add(cost_center)
        
        # Criar categorias
        for cat_name in categories:
            # Verificar se já existe
            existing_cat = session.exec(
                select(Category).where(
                    Category.user_id == user_id,
                    Category.name == cat_name
                )
            ).first()
            
            if not existing_cat:
                category = Category(name=cat_name, user_id=user_id)
                session.add(category)
        
        session.commit()
        
        return {"status": "success", "message": "Onboarding completado com sucesso"}
        
    except Exception as e:
        session.rollback()
        logger.exception("Erro ao completar onboarding")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ENDPOINTS DE ÁUDIO E PROCESSAMENTO =====

@app.post("/api/audio")
async def process_audio(
    file: UploadFile = File(...),
    user_id: int = Query(...),
    session: Session = Depends(get_session)
):
    """Processa áudio e extrai informações da despesa"""
    try:
        # Salvar arquivo temporariamente
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
            content = await file.read()
            temp_audio.write(content)
            temp_path = temp_audio.name
        
        try:
            # Buscar configurações do usuário para NLP
            user = session.get(User, user_id)
            if not user:
                raise HTTPException(status_code=404, detail="Usuário não encontrado")
            
            cost_centers = session.exec(
                select(CostCenter).where(CostCenter.user_id == user_id)
            ).all()
            categories = session.exec(
                select(Category).where(Category.user_id == user_id)
            ).all()
            
            cost_center_names = [cc.name for cc in cost_centers]
            category_names = [cat.name for cat in categories]
            
            # Processar áudio
            result = transcribe_and_extract(
                temp_path, 
                cost_center_names, 
                category_names
            )
            
            logger.info(f"Processamento concluído para usuário {user_id}: {result}")
            
            return result
            
        finally:
            # Limpar arquivo temporário
            os.unlink(temp_path)
            
    except Exception as e:
        logger.exception("Erro ao processar áudio")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/audio/test")
async def test_audio_processing(request: dict, session: Session = Depends(get_session)):
    """Endpoint para testar processamento de texto (debug)"""
    try:
        text = request.get("text", "")
        user_id = request.get("user_id")
        
        if user_id:
            user = session.get(User, user_id)
            if user:
                cost_centers = session.exec(
                    select(CostCenter).where(CostCenter.user_id == user_id)
                ).all()
                categories = session.exec(
                    select(Category).where(Category.user_id == user_id)
                ).all()
                
                cost_center_names = [cc.name for cc in cost_centers]
                category_names = [cat.name for cat in categories]
                
                from app.nlu.transcribe import test_extraction
                result = test_extraction(text, cost_center_names, category_names)
                return result
        
        # Fallback sem informações do usuário
        from app.nlu.transcribe import test_extraction
        return test_extraction(text)
        
    except Exception as e:
        logger.exception("Erro no teste de processamento")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ENDPOINTS DE DESPESAS =====

@app.get("/api/expenses")
async def get_expenses(user_id: int = Query(...), session: Session = Depends(get_session)):
    """Retorna todas as despesas do usuário"""
    try:
        expenses = session.exec(
            select(Expense)
            .where(Expense.user_id == user_id)
            .order_by(Expense.transaction_date.desc())
        ).all()
        
        result = []
        for expense in expenses:
            cost_center = session.get(CostCenter, expense.cost_center_id)
            category = session.get(Category, expense.category_id)
            installments = session.exec(
                select(Installment).where(Installment.expense_id == expense.id)
            ).all()
            
            result.append({
                "id": expense.id,
                "description": expense.description,
                "total_amount": expense.total_amount,
                "payment_method": expense.payment_method,
                "cost_center": cost_center.name if cost_center else "N/A",
                "category": category.name if category else "N/A",
                "installments": len(installments),
                "created_at": expense.transaction_date.isoformat(),
                "text": expense.description,
                "cost_center_id": expense.cost_center_id,
                "category_id": expense.category_id
            })
        
        return result
        
    except Exception as e:
        logger.exception("Erro ao buscar despesas")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/expenses")
async def create_expense(expense_data: dict, session: Session = Depends(get_session)):
    """Cria uma nova despesa"""
    try:
        # CORREÇÃO FLEXÍVEL: Aceitar tanto cost_center_id quanto cost_center
        cost_center_id = None
        cost_center_name = None
        
        if "cost_center_id" in expense_data:
            cost_center_id = expense_data["cost_center_id"]
        elif "cost_center" in expense_data:
            cost_center_name = expense_data["cost_center"]
            # Buscar ID pelo nome
            cost_center = session.exec(
                select(CostCenter).where(
                    CostCenter.user_id == expense_data["user_id"],
                    CostCenter.name == cost_center_name
                )
            ).first()
            if cost_center:
                cost_center_id = cost_center.id
            else:
                raise HTTPException(status_code=400, detail="Centro de custo não encontrado")
        else:
            raise HTTPException(status_code=400, detail="Centro de custo não especificado")
        
        # CORREÇÃO FLEXÍVEL: Aceitar tanto category_id quanto category
        category_id = None
        category_name = None
        
        if "category_id" in expense_data:
            category_id = expense_data["category_id"]
        elif "category" in expense_data:
            category_name = expense_data["category"]
            # Buscar ID pelo nome
            category = session.exec(
                select(Category).where(
                    Category.user_id == expense_data["user_id"], 
                    Category.name == category_name
                )
            ).first()
            if category:
                category_id = category.id
            else:
                raise HTTPException(status_code=400, detail="Categoria não encontrada")
        else:
            raise HTTPException(status_code=400, detail="Categoria não especificada")
        
        if not cost_center_id or not category_id:
            raise HTTPException(status_code=400, detail="Centro de custo ou categoria inválidos")
        
        # CORREÇÃO CRÍTICA: Verificar se installments é uma lista e obter o número correto
        installments_data = expense_data.get("installments", [])
        num_installments = 1
        
        if isinstance(installments_data, list):
            num_installments = len(installments_data) if installments_data else 1
        elif isinstance(installments_data, int):
            num_installments = installments_data
        else:
            num_installments = 1
        
        # Criar despesa
        expense = Expense(
            description=expense_data["description"],
            total_amount=expense_data["total_amount"],
            payment_method=expense_data["payment_method"],
            user_id=expense_data["user_id"],
            cost_center_id=cost_center_id,
            category_id=category_id,
            transaction_date=expense_data.get("transaction_date", datetime.utcnow()),
            is_installment=num_installments > 1  # CORREÇÃO: Usar num_installments
        )
        
        session.add(expense)
        session.commit()
        session.refresh(expense)
        
        # Criar parcelas se necessário
        if installments_data and isinstance(installments_data, list):
            for installment_data in installments_data:
                # CORREÇÃO: Converter string para datetime se necessário
                due_date = installment_data["due_date"]
                if isinstance(due_date, str):
                    due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
                
                installment = Installment(
                    expense_id=expense.id,
                    amount=installment_data["amount"],
                    due_date=due_date,
                    status=PaymentStatus.PENDING,
                    installment_number=installment_data["installment_number"],
                    month_reference=due_date.strftime("%Y-%m")
                )
                session.add(installment)
        else:
            # Criar parcela única
            installment = Installment(
                expense_id=expense.id,
                amount=expense.total_amount,
                due_date=expense.transaction_date,
                status=PaymentStatus.PENDING,
                installment_number=1,
                month_reference=expense.transaction_date.strftime("%Y-%m")
            )
            session.add(installment)
        
        session.commit()
        
        return expense
        
    except Exception as e:
        session.rollback()
        logger.exception("Erro ao criar despesa")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/expenses/{expense_id}")
async def update_expense(expense_id: int, expense_data: dict, session: Session = Depends(get_session)):
    """Atualiza uma despesa existente"""
    try:
        expense = session.get(Expense, expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="Despesa não encontrada")
        
        # CORREÇÃO FLEXÍVEL: Buscar IDs se nomes foram fornecidos
        if "cost_center" in expense_data:
            cost_center = session.exec(
                select(CostCenter).where(
                    CostCenter.user_id == expense.user_id,
                    CostCenter.name == expense_data["cost_center"]
                )
            ).first()
            if cost_center:
                expense.cost_center_id = cost_center.id
        
        if "category" in expense_data:
            category = session.exec(
                select(Category).where(
                    Category.user_id == expense.user_id,
                    Category.name == expense_data["category"]
                )
            ).first()
            if category:
                expense.category_id = category.id
        
        # Atualizar outros campos
        if "description" in expense_data:
            expense.description = expense_data["description"]
        if "total_amount" in expense_data:
            expense.total_amount = expense_data["total_amount"]
        if "payment_method" in expense_data:
            expense.payment_method = expense_data["payment_method"]
        
        session.add(expense)
        session.commit()
        session.refresh(expense)
        
        return expense
        
    except Exception as e:
        session.rollback()
        logger.exception("Erro ao atualizar despesa")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/expenses/{expense_id}")
async def delete_expense(expense_id: int, session: Session = Depends(get_session)):
    """Exclui uma despesa"""
    try:
        expense = session.get(Expense, expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="Despesa não encontrada")
        
        # Excluir parcelas primeiro
        installments = session.exec(
            select(Installment).where(Installment.expense_id == expense_id)
        ).all()
        for installment in installments:
            session.delete(installment)
        
        session.delete(expense)
        session.commit()
        
        return {"status": "success", "message": "Despesa excluída com sucesso"}
        
    except Exception as e:
        session.rollback()
        logger.exception("Erro ao excluir despesa")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ENDPOINTS DE DASHBOARD AVANÇADO =====

@app.get("/api/dashboard/financial-overview/{user_id}")
async def get_financial_overview(
    user_id: int,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    session: Session = Depends(get_session)
):
    """Retorna visão financeira completa com projeção futura"""
    start_dt, end_dt = get_date_filters(start_date, end_date)
    
    if not start_dt or not end_dt:
        start_dt = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_dt = (start_dt + relativedelta(months=1)) - timedelta(days=1)
    
    try:
        # Gastos do período (transações)
        expenses_query = select(Expense).where(
            Expense.user_id == user_id,
            Expense.transaction_date >= start_dt,
            Expense.transaction_date <= end_dt
        )
        expenses = session.exec(expenses_query).all()
        
        total_expenses = sum(exp.total_amount for exp in expenses)
        
        # Saída de caixa (parcelas vencidas no período)
        cash_outflow_query = select(Installment).join(Expense).where(
            Expense.user_id == user_id,
            Installment.due_date >= start_dt,
            Installment.due_date <= end_dt,
            Installment.status == PaymentStatus.PENDING
        )
        cash_outflow_installments = session.exec(cash_outflow_query).all()
        
        total_cash_outflow = sum(inst.amount for inst in cash_outflow_installments)
        
        # Projeção futura (próximos 3 meses)
        future_projection = []
        for i in range(1, 4):
            month_start = (start_dt.replace(day=1) + relativedelta(months=i))
            month_end = (month_start + relativedelta(months=1)) - timedelta(days=1)
            
            future_installments = session.exec(
                select(Installment).join(Expense).where(
                    Expense.user_id == user_id,
                    Installment.due_date >= month_start,
                    Installment.due_date <= month_end,
                    Installment.status == PaymentStatus.PENDING
                )
            ).all()
            
            future_amount = sum(inst.amount for inst in future_installments)
            future_projection.append({
                "month": month_start.strftime("%Y-%m"),
                "amount": future_amount,
                "installments_count": len(future_installments)
            })
        
        # Centros de custo
        cost_centers_data = []
        cost_centers = session.exec(
            select(CostCenter).where(CostCenter.user_id == user_id)
        ).all()
        
        for cc in cost_centers:
            cc_expenses = session.exec(
                select(Expense).where(
                    Expense.user_id == user_id,
                    Expense.cost_center_id == cc.id,
                    Expense.transaction_date >= start_dt,
                    Expense.transaction_date <= end_dt
                )
            ).all()
            
            cc_total = sum(exp.total_amount for exp in cc_expenses)
            if cc_total > 0:
                cost_centers_data.append({
                    "cost_center": cc.name,
                    "amount": cc_total
                })
        
        return {
            "period": {
                "start_date": start_dt.isoformat(),
                "end_date": end_dt.isoformat()
            },
            "monthly_expenses": {
                "total": total_expenses,
                "transactions_count": len(expenses)
            },
            "cash_outflow": {
                "total": total_cash_outflow,
                "installments_count": len(cash_outflow_installments)
            },
            "future_projection": future_projection,
            "cost_centers": cost_centers_data
        }
        
    except Exception as e:
        logger.exception("Erro ao buscar visão financeira")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard/cost-center-detail/{user_id}/{cost_center_name}")
async def get_cost_center_detail(
    user_id: int,
    cost_center_name: str,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    session: Session = Depends(get_session)
):
    """Retorna detalhes de um centro de custo específico"""
    start_dt, end_dt = get_date_filters(start_date, end_date)
    
    if not start_dt or not end_dt:
        start_dt = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_dt = (start_dt + relativedelta(months=1)) - timedelta(days=1)
    
    try:
        # Buscar centro de custo
        cost_center = session.exec(
            select(CostCenter).where(
                CostCenter.user_id == user_id,
                CostCenter.name == cost_center_name
            )
        ).first()
        
        if not cost_center:
            raise HTTPException(status_code=404, detail="Centro de custo não encontrado")
        
        # Buscar despesas do centro de custo no período
        expenses = session.exec(
            select(Expense, Category)
            .join(Category, Expense.category_id == Category.id)
            .where(
                Expense.user_id == user_id,
                Expense.cost_center_id == cost_center.id,
                Expense.transaction_date >= start_dt,
                Expense.transaction_date <= end_dt
            )
        ).all()
        
        # Agrupar por categoria
        categories_data = {}
        for expense, category in expenses:
            cat_name = category.name
            if cat_name not in categories_data:
                categories_data[cat_name] = 0.0
            categories_data[cat_name] += expense.total_amount
        
        categories_list = [{"category": cat, "amount": amount} for cat, amount in categories_data.items()]
        
        # Formatar despesas para retorno
        expenses_list = []
        for expense, category in expenses:
            expenses_list.append({
                "id": expense.id,
                "description": expense.description,
                "amount": expense.total_amount,
                "category": category.name,
                "payment_method": expense.payment_method,
                "transaction_date": expense.transaction_date.isoformat()
            })
        
        return {
            "cost_center": cost_center_name,
            "period": {
                "start_date": start_dt.isoformat(),
                "end_date": end_dt.isoformat()
            },
            "total_amount": sum(exp.total_amount for exp, _ in expenses),
            "expenses_count": len(expenses),
            "categories": categories_list,
            "expenses": expenses_list
        }
        
    except Exception as e:
        logger.exception("Erro ao buscar detalhes do centro de custo")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard/monthly-expenses/{user_id}")
async def get_monthly_expenses(
    user_id: int,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    session: Session = Depends(get_session)
):
    """Retorna todas as despesas do período"""
    start_dt, end_dt = get_date_filters(start_date, end_date)
    
    if not start_dt or not end_dt:
        start_dt = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_dt = (start_dt + relativedelta(months=1)) - timedelta(days=1)
    
    try:
        expenses = session.exec(
            select(Expense, CostCenter, Category)
            .join(CostCenter, Expense.cost_center_id == CostCenter.id)
            .join(Category, Expense.category_id == Category.id)
            .where(
                Expense.user_id == user_id,
                Expense.transaction_date >= start_dt,
                Expense.transaction_date <= end_dt
            )
            .order_by(Expense.transaction_date.desc())
        ).all()
        
        result = []
        for expense, cost_center, category in expenses:
            result.append({
                "id": expense.id,
                "description": expense.description,
                "amount": expense.total_amount,
                "cost_center": cost_center.name,
                "category": category.name,
                "payment_method": expense.payment_method,
                "transaction_date": expense.transaction_date.isoformat(),
                "installments": len(expense.installments)
            })
        
        total_amount = sum(exp["amount"] for exp in result)
        
        return {
            "period": {
                "start_date": start_dt.isoformat(),
                "end_date": end_dt.isoformat()
            },
            "expenses": result,
            "total_count": len(result),
            "total_amount": total_amount
        }
        
    except Exception as e:
        logger.exception("Erro ao buscar despesas mensais")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ENDPOINTS DE EXPORTAÇÃO =====

@app.get("/api/export/expenses/{user_id}")
async def export_expenses_to_excel(
    user_id: int,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    cost_center: Optional[str] = Query(None),
    session: Session = Depends(get_session)
):
    """Exporta despesas para CSV/Excel"""
    start_dt, end_dt = get_date_filters(start_date, end_date)
    
    if not start_dt or not end_dt:
        # Últimos 90 dias por padrão
        end_dt = datetime.now()
        start_dt = end_dt - timedelta(days=90)
    
    try:
        # Construir query base
        query = select(Expense, CostCenter, Category).join(
            CostCenter, Expense.cost_center_id == CostCenter.id
        ).join(
            Category, Expense.category_id == Category.id
        ).where(
            Expense.user_id == user_id,
            Expense.transaction_date >= start_dt,
            Expense.transaction_date <= end_dt
        )
        
        # Aplicar filtro de centro de custo se fornecido
        if cost_center:
            query = query.where(CostCenter.name == cost_center)
        
        expenses = session.exec(query.order_by(Expense.transaction_date.desc())).all()
        
        # Criar CSV em memória
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Cabeçalho
        writer.writerow([
            'Data', 'Centro de Custo', 'Categoria', 'Descrição', 
            'Valor (R$)', 'Forma de Pagamento', 'Parcelas'
        ])
        
        # Dados
        for expense, cost_center_obj, category in expenses:
            writer.writerow([
                expense.transaction_date.strftime('%d/%m/%Y'),
                cost_center_obj.name,
                category.name,
                expense.description,
                f"R$ {expense.total_amount:.2f}",
                expense.payment_method,
                f"{len(expense.installments)}x" if expense.installments else "À vista"
            ])
        
        output.seek(0)
        
        filename = f"despesas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.exception("Erro ao exportar despesas")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ENDPOINTS DE DESPESAS RECENTES (COMPATIBILIDADE) =====

@app.get("/api/expenses/recent/{user_id}")
async def get_recent_expenses(user_id: int, session: Session = Depends(get_session)):
    """Retorna as últimas 5 despesas do usuário (para compatibilidade)"""
    try:
        expenses = session.exec(
            select(Expense)
            .where(Expense.user_id == user_id)
            .order_by(Expense.transaction_date.desc())
            .limit(5)
        ).all()
        
        result = []
        for expense in expenses:
            cost_center = session.get(CostCenter, expense.cost_center_id)
            category = session.get(Category, expense.category_id)
            
            result.append({
                "id": expense.id,
                "description": expense.description,
                "total_amount": expense.total_amount,
                "payment_method": expense.payment_method,
                "cost_center": cost_center.name if cost_center else "N/A",
                "category": category.name if category else "N/A",
                "installments": len(expense.installments),
                "created_at": expense.transaction_date.isoformat(),
                "text": expense.description
            })
        
        return result
        
    except Exception as e:
        logger.exception("Erro ao buscar despesas recentes")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ENDPOINTS DE DASHBOARD LEGADO (COMPATIBILIDADE) =====

@app.get("/api/dashboard/summary/{user_id}")
async def get_dashboard_summary(user_id: int, session: Session = Depends(get_session)):
    """Retorna resumo para o dashboard (legado)"""
    try:
        # Total de despesas
        total_expenses = session.exec(
            select(func.sum(Expense.total_amount)).where(Expense.user_id == user_id)
        ).first() or 0.0

        # Total do mês atual
        current_month = datetime.now().month
        current_year = datetime.now().year
        monthly_expenses = session.exec(
            select(func.sum(Expense.total_amount)).where(
                Expense.user_id == user_id,
                extract('month', Expense.transaction_date) == current_month,
                extract('year', Expense.transaction_date) == current_year
            )
        ).first() or 0.0

        # Total de despesas cadastradas
        expenses_count = session.exec(
            select(func.count(Expense.id)).where(Expense.user_id == user_id)
        ).first() or 0

        # Últimas despesas
        recent_expenses = session.exec(
            select(Expense)
            .where(Expense.user_id == user_id)
            .order_by(Expense.transaction_date.desc())
            .limit(5)
        ).all()

        recent_expenses_data = []
        for expense in recent_expenses:
            cost_center = session.get(CostCenter, expense.cost_center_id)
            category = session.get(Category, expense.category_id)
            
            recent_expenses_data.append({
                "id": expense.id,
                "description": expense.description,
                "amount": expense.total_amount,
                "cost_center": cost_center.name if cost_center else "N/A",
                "category": category.name if category else "N/A",
                "payment_method": expense.payment_method,
                "created_at": expense.transaction_date.isoformat()
            })

        return {
            "total_expenses": float(total_expenses),
            "monthly_expenses": float(monthly_expenses),
            "expenses_count": expenses_count,
            "recent_expenses": recent_expenses_data
        }

    except Exception as e:
        logger.exception("Erro ao buscar resumo do dashboard")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard/expenses-by-category/{user_id}")
async def get_expenses_by_category(user_id: int, session: Session = Depends(get_session)):
    """Retorna despesas agrupadas por categoria (legado)"""
    try:
        # Buscar despesas com informações de categoria
        expenses = session.exec(
            select(Expense, Category)
            .join(Category, Expense.category_id == Category.id)
            .where(Expense.user_id == user_id)
        ).all()

        category_totals = {}
        for expense, category in expenses:
            category_name = category.name
            if category_name not in category_totals:
                category_totals[category_name] = 0.0
            category_totals[category_name] += expense.total_amount

        # Formatar para o gráfico
        result = [{"category": cat, "amount": amount} for cat, amount in category_totals.items()]
        
        return result

    except Exception as e:
        logger.exception("Erro ao buscar despesas por categoria")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard/expenses-by-cost-center/{user_id}")
async def get_expenses_by_cost_center(user_id: int, session: Session = Depends(get_session)):
    """Retorna despesas agrupadas por centro de custo (legado)"""
    try:
        # Buscar despesas com informações de centro de custo
        expenses = session.exec(
            select(Expense, CostCenter)
            .join(CostCenter, Expense.cost_center_id == CostCenter.id)
            .where(Expense.user_id == user_id)
        ).all()

        cost_center_totals = {}
        for expense, cost_center in expenses:
            center_name = cost_center.name
            if center_name not in cost_center_totals:
                cost_center_totals[center_name] = 0.0
            cost_center_totals[center_name] += expense.total_amount

        # Formatar para o gráfico
        result = [{"cost_center": center, "amount": amount} for center, amount in cost_center_totals.items()]
        
        return result

    except Exception as e:
        logger.exception("Erro ao buscar despesas por centro de custo")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard/monthly-trend/{user_id}")
async def get_monthly_trend(user_id: int, session: Session = Depends(get_session)):
    """Retorna tendência mensal dos últimos 6 meses (legado)"""
    try:
        # Calcular data de 6 meses atrás
        six_months_ago = datetime.now() - timedelta(days=180)
        
        expenses = session.exec(
            select(Expense)
            .where(
                Expense.user_id == user_id,
                Expense.transaction_date >= six_months_ago
            )
        ).all()

        # Agrupar por mês
        monthly_totals = {}
        for expense in expenses:
            month_key = expense.transaction_date.strftime("%Y-%m")
            if month_key not in monthly_totals:
                monthly_totals[month_key] = 0.0
            monthly_totals[month_key] += expense.total_amount

        # Ordenar por mês
        sorted_months = sorted(monthly_totals.items())
        
        result = [{"month": month, "amount": amount} for month, amount in sorted_months[-6:]]  # Últimos 6 meses
        
        return result

    except Exception as e:
        logger.exception("Erro ao buscar tendência mensal")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ENDPOINTS DE DEBUG E DIAGNÓSTICO =====

@app.get("/api/debug/user/{user_id}/setup")
async def debug_user_setup(user_id: int, session: Session = Depends(get_session)):
    """Endpoint de debug para ver setup do usuário"""
    try:
        user = session.get(User, user_id)
        if not user:
            return {"error": "Usuário não encontrado"}
        
        cost_centers = session.exec(
            select(CostCenter).where(CostCenter.user_id == user_id)
        ).all()
        
        categories = session.exec(
            select(Category).where(Category.user_id == user_id)
        ).all()
        
        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "user_type": user.user_type,
                "onboarding_completed": user.onboarding_completed
            },
            "cost_centers": [{"id": cc.id, "name": cc.name} for cc in cost_centers],
            "categories": [{"id": cat.id, "name": cat.name} for cat in categories]
        }
        
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/debug/database")
async def debug_database(session: Session = Depends(get_session)):
    """Endpoint para debug do banco de dados"""
    try:
        # Contar registros em cada tabela
        users_count = session.exec(select(func.count(User.id))).first()
        cost_centers_count = session.exec(select(func.count(CostCenter.id))).first()
        categories_count = session.exec(select(func.count(Category.id))).first()
        expenses_count = session.exec(select(func.count(Expense.id))).first()
        installments_count = session.exec(select(func.count(Installment.id))).first()
        
        # Listar algumas despesas
        expenses = session.exec(select(Expense).limit(5)).all()
        expenses_data = []
        for expense in expenses:
            cost_center = session.get(CostCenter, expense.cost_center_id)
            category = session.get(Category, expense.category_id)
            expenses_data.append({
                "id": expense.id,
                "description": expense.description,
                "amount": expense.total_amount,
                "cost_center": cost_center.name if cost_center else "N/A",
                "category": category.name if category else "N/A",
                "transaction_date": expense.transaction_date
            })
        
        return {
            "database_file": "voiceexpense.db",
            "counts": {
                "users": users_count,
                "cost_centers": cost_centers_count,
                "categories": categories_count,
                "expenses": expenses_count,
                "installments": installments_count
            },
            "recent_expenses": expenses_data
        }
        
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/test/save-expense")
async def test_save_expense(session: Session = Depends(get_session)):
    """Endpoint para testar salvamento manual"""
    try:
        # Criar usuário de teste se não existir
        user = session.exec(select(User).where(User.email == "teste@email.com")).first()
        if not user:
            user = User(
                email="teste@email.com",
                name="Usuário Teste",
                user_type=UserType.PERSONAL,
                onboarding_completed=True
            )
            session.add(user)
            session.commit()
            session.refresh(user)
        
        # Criar centro de custo
        cost_center = CostCenter(name="Teste", user_id=user.id, is_personal=True)
        session.add(cost_center)
        
        # Criar categoria  
        category = Category(name="Teste", user_id=user.id)
        session.add(category)
        
        session.commit()
        session.refresh(cost_center)
        session.refresh(category)
        
        # Criar despesa
        expense = Expense(
            description="Despesa de teste",
            total_amount=100.50,
            payment_method="cartão crédito",
            user_id=user.id,
            cost_center_id=cost_center.id,
            category_id=category.id,
            transaction_date=datetime.utcnow()
        )
        session.add(expense)
        session.commit()
        session.refresh(expense)
        
        return {
            "status": "success",
            "message": "Despesa salva com sucesso",
            "expense_id": expense.id
        }

        
    except Exception as e:
        session.rollback()
        return {"status": "error", "message": str(e)}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "VoiceExpense API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)