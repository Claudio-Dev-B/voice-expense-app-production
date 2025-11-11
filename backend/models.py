from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime

class Installment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    expense_id: Optional[int] = Field(default=None, foreign_key="expense.id")
    due_date: datetime
    amount: float

    # Relação reversa com Expense
    expense: Optional["Expense"] = Relationship(back_populates="installments")


class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    description: str
    total_amount: float
    payment_method: str
    category: str
    created_at: datetime

    # Relacionamento com parcelas
    installments: List[Installment] = Relationship(back_populates="expense")

