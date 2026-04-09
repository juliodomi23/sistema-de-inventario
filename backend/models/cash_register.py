from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class CashRegisterOpen(BaseModel):
    monto_inicial: float = Field(ge=0)
    notas: Optional[str] = Field(default=None, max_length=500)


class CashRegisterClose(BaseModel):
    monto_contado: float = Field(ge=0)
    notas: Optional[str] = Field(default=None, max_length=500)


class CashRegisterResponse(BaseModel):
    id: str
    estado: str  # "abierto" | "cerrado"
    monto_inicial: float
    monto_contado: Optional[float]
    monto_esperado: Optional[float]
    diferencia: Optional[float]
    ventas_efectivo: float
    ventas_total: float
    notas_apertura: Optional[str]
    notas_cierre: Optional[str]
    usuario_id: str
    usuario_nombre: str
    fecha_apertura: datetime
    fecha_cierre: Optional[datetime]
