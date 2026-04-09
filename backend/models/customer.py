from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional


class CustomerCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=20)
    email: Optional[EmailStr] = None
    limite_credito: float = Field(default=0, ge=0)
    notas: Optional[str] = Field(default=None, max_length=500)


class CustomerUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=20)
    email: Optional[EmailStr] = None
    limite_credito: Optional[float] = Field(default=None, ge=0)
    notas: Optional[str] = Field(default=None, max_length=500)


class CustomerResponse(BaseModel):
    id: str
    nombre: str
    telefono: Optional[str]
    email: Optional[str]
    limite_credito: float
    saldo_pendiente: float
    notas: Optional[str]
    fecha_creacion: datetime


class CustomerPaymentCreate(BaseModel):
    monto: float = Field(gt=0)
    notas: Optional[str] = Field(default=None, max_length=500)
