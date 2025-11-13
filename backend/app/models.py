# backend/app/models.py
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from enum import Enum

if TYPE_CHECKING:
    from .models import AccountInvite, AccountMember

class UserType(str, Enum):
    PERSONAL = "pessoal"
    BUSINESS = "empresarial" 
    MIXED = "pessoal_empresarial"

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str
    google_id: Optional[str] = Field(default=None, unique=True, index=True)
    picture: Optional[str] = None
    user_type: UserType = Field(default=UserType.PERSONAL)
    onboarding_completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relacionamentos - CORREÇÃO: especificar foreign_keys
    cost_centers: List["CostCenter"] = Relationship(back_populates="user")
    categories: List["Category"] = Relationship(back_populates="user") 
    expenses: List["Expense"] = Relationship(back_populates="user")
    
    # Convites enviados - CORREÇÃO: especificar foreign_key
    sent_invites: List["AccountInvite"] = Relationship(
        back_populates="inviter",
        sa_relationship_kwargs={"foreign_keys": "AccountInvite.created_by"}
    )
    
    # Contas onde é membro
    account_memberships: List["AccountMember"] = Relationship(back_populates="user")

class CostCenter(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_id: int = Field(foreign_key="user.id")
    is_personal: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: User = Relationship(back_populates="cost_centers")
    expenses: List["Expense"] = Relationship(back_populates="cost_center")

class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: User = Relationship(back_populates="categories")
    expenses: List["Expense"] = Relationship(back_populates="category")

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
    
    user: User = Relationship(back_populates="expenses")
    cost_center: "CostCenter" = Relationship(back_populates="expenses")
    category: "Category" = Relationship(back_populates="expenses")
    installments: List["Installment"] = Relationship(back_populates="expense")
    shared_account: Optional["SharedAccount"] = Relationship(back_populates="expenses")

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"

class Installment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    expense_id: int = Field(foreign_key="expense.id")
    amount: float = Field(ge=0.0)
    due_date: datetime
    status: PaymentStatus = Field(default=PaymentStatus.PENDING)
    installment_number: int = Field(ge=1)
    month_reference: str  # Formato YYYY-MM
    paid_at: Optional[datetime] = None
    
    expense: Expense = Relationship(back_populates="installments")

class SharedAccount(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    owner_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    owner: User = Relationship()  # Dono da conta
    members: List["AccountMember"] = Relationship(back_populates="account")
    invites: List["AccountInvite"] = Relationship(back_populates="account")
    expenses: List["Expense"] = Relationship(back_populates="shared_account")

class AccountMember(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="sharedaccount.id")
    user_id: int = Field(foreign_key="user.id")
    role: str = Field(default="member")  # owner, admin, member, viewer
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    
    account: SharedAccount = Relationship(back_populates="members")
    user: User = Relationship(back_populates="account_memberships")

class AccountInvite(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="sharedaccount.id")
    email: str
    token: str = Field(unique=True, index=True)
    role: str = Field(default="member")
    created_by: int = Field(foreign_key="user.id")  # CORREÇÃO: foreign_key explícita
    status: str = Field(default="pending")  # pending, accepted, cancelled, expired
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
    accepted_at: Optional[datetime] = None
    
    account: SharedAccount = Relationship(back_populates="invites")
    inviter: User = Relationship(
        back_populates="sent_invites",
        sa_relationship_kwargs={"foreign_keys": [created_by]}
    )