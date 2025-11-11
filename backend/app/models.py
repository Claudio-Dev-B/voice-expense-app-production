from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
from enum import Enum

class UserType(str, Enum):
    PERSONAL = "pessoal"
    BUSINESS = "empresarial" 
    MIXED = "pessoal_empresarial"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    SCHEDULED = "scheduled"

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str
    user_type: UserType = Field(default=UserType.PERSONAL)
    google_id: Optional[str] = Field(default=None, unique=True, nullable=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    onboarding_completed: bool = False

    # CORREÇÃO: Relationships corretas
    cost_centers: List["CostCenter"] = Relationship(back_populates="user")
    categories: List["Category"] = Relationship(back_populates="user")
    expenses: List["Expense"] = Relationship(back_populates="user")

class CostCenter(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_id: int = Field(foreign_key="user.id")
    is_personal: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # CORREÇÃO: Relationships corretas
    user: User = Relationship(back_populates="cost_centers")
    expenses: List["Expense"] = Relationship(back_populates="cost_center")

class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # CORREÇÃO: Relationships corretas
    user: User = Relationship(back_populates="categories")
    expenses: List["Expense"] = Relationship(back_populates="category")

class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    description: str
    total_amount: float = Field(default=0.0, ge=0.0)  # CORREÇÃO: Validação de valor
    payment_method: str
    user_id: int = Field(foreign_key="user.id")
    cost_center_id: int = Field(foreign_key="costcenter.id")
    category_id: int = Field(foreign_key="category.id")
    transaction_date: datetime = Field(default_factory=datetime.utcnow)  # Data da transação
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_installment: bool = False  # Se é uma compra parcelada

    # CORREÇÃO: Relationships corretas
    user: User = Relationship(back_populates="expenses")
    cost_center: CostCenter = Relationship(back_populates="expenses")
    category: Category = Relationship(back_populates="expenses")
    installments: List["Installment"] = Relationship(back_populates="expense")

class Installment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    expense_id: int = Field(foreign_key="expense.id")  # CORREÇÃO: Removido Optional
    amount: float = Field(ge=0.0)  # CORREÇÃO: Validação de valor
    due_date: datetime  # Data de vencimento real
    payment_date: Optional[datetime] = None  # Data real do pagamento
    status: PaymentStatus = Field(default=PaymentStatus.PENDING)
    installment_number: int = Field(ge=1)  # CORREÇÃO: Número mínimo 1
    month_reference: str  # Mês de referência YYYY-MM para agrupamento

    # CORREÇÃO: Relationship correta
    expense: Expense = Relationship(back_populates="installments")
