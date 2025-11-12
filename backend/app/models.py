# backend/app/models.py
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

    # Relationships
    cost_centers: List["CostCenter"] = Relationship(back_populates="user")
    categories: List["Category"] = Relationship(back_populates="user")
    expenses: List["Expense"] = Relationship(back_populates="user")
    owned_accounts: List["SharedAccount"] = Relationship(back_populates="owner")
    account_memberships: List["AccountMember"] = Relationship(back_populates="user")
    sent_invites: List["AccountInvite"] = Relationship(back_populates="inviter")

class CostCenter(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_id: int = Field(foreign_key="user.id")
    is_personal: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: User = Relationship(back_populates="cost_centers")
    expenses: List["Expense"] = Relationship(back_populates="cost_center")

class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: User = Relationship(back_populates="categories")
    expenses: List["Expense"] = Relationship(back_populates="category")

class SharedAccount(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str  # "Conta Família Silva", "Empresa XYZ"
    owner_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)

    # Relationships
    owner: User = Relationship(back_populates="owned_accounts")
    members: List["AccountMember"] = Relationship(back_populates="account")
    invites: List["AccountInvite"] = Relationship(back_populates="account")
    expenses: List["Expense"] = Relationship(back_populates="shared_account")

class AccountMember(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="sharedaccount.id")
    user_id: int = Field(foreign_key="user.id")
    role: str = Field(default="member")  # owner, admin, member, viewer
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)

    # Relationships
    account: SharedAccount = Relationship(back_populates="members")
    user: User = Relationship(back_populates="account_memberships")

class AccountInvite(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="sharedaccount.id")
    email: str
    token: str = Field(unique=True, index=True)
    role: str = Field(default="member")  # owner, admin, member, viewer
    expires_at: datetime
    created_by: int = Field(foreign_key="user.id")
    status: str = Field(default="pending")  # pending, accepted, expired, cancelled
    accepted_by: Optional[int] = Field(foreign_key="user.id", default=None)
    accepted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    account: SharedAccount = Relationship(back_populates="invites")
    inviter: User = Relationship(back_populates="sent_invites")

class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    description: str
    total_amount: float = Field(default=0.0, ge=0.0)
    payment_method: str
    user_id: int = Field(foreign_key="user.id")
    cost_center_id: int = Field(foreign_key="costcenter.id")
    category_id: int = Field(foreign_key="category.id")
    transaction_date: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_installment: bool = False
    
    # Novo campo para identificar se é despesa compartilhada
    shared_account_id: Optional[int] = Field(foreign_key="sharedaccount.id", default=None)
    
    # Relationships
    user: User = Relationship(back_populates="expenses")
    cost_center: CostCenter = Relationship(back_populates="expenses")
    category: Category = Relationship(back_populates="expenses")
    installments: List["Installment"] = Relationship(back_populates="expense")
    shared_account: Optional[SharedAccount] = Relationship(back_populates="expenses")

class Installment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    expense_id: int = Field(foreign_key="expense.id")
    amount: float = Field(ge=0.0)
    due_date: datetime
    payment_date: Optional[datetime] = None
    status: PaymentStatus = Field(default=PaymentStatus.PENDING)
    installment_number: int = Field(ge=1)
    month_reference: str

    # Relationship
    expense: Expense = Relationship(back_populates="installments")