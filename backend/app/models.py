# backend/app/models.py - VERSÃO SIMPLIFICADA
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class UserType(str, Enum):
    PERSONAL = "pessoal"
    BUSINESS = "empresarial" 
    MIXED = "pessoal_empresarial"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid" 
    OVERDUE = "overdue"

# Modelos básicos SEM relacionamentos complexos
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str
    google_id: Optional[str] = Field(default=None, unique=True, index=True)
    picture: Optional[str] = None
    user_type: UserType = Field(default=UserType.PERSONAL)
    onboarding_completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CostCenter(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_id: int = Field(foreign_key="user.id")
    is_personal: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SharedAccount(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    owner_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    description: str
    total_amount: float = Field(default=0.0, ge=0.0)
    payment_method: str
    user_id: int = Field(foreign_key="user.id")
    cost_center_id: int = Field(foreign_key="costcenter.id")
    category_id: int = Field(foreign_key="category.id")
    transaction_date: datetime = Field(default_factory=datetime.utcnow)
    is_installment: bool = False
    shared_account_id: Optional[int] = Field(default=None, foreign_key="sharedaccount.id")

class Installment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    expense_id: int = Field(foreign_key="expense.id")
    amount: float = Field(ge=0.0)
    due_date: datetime
    status: PaymentStatus = Field(default=PaymentStatus.PENDING)
    installment_number: int = Field(ge=1)
    month_reference: str
    paid_at: Optional[datetime] = None

class AccountMember(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="sharedaccount.id")
    user_id: int = Field(foreign_key="user.id")
    role: str = Field(default="member")
    joined_at: datetime = Field(default_factory=datetime.utcnow)

class AccountInvite(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="sharedaccount.id")
    email: str
    token: str = Field(unique=True, index=True)
    role: str = Field(default="member")
    created_by: int = Field(foreign_key="user.id")
    status: str = Field(default="pending")
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
    accepted_at: Optional[datetime] = None