from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class StockEntryCreate(BaseModel):
    producto_id: str
    cantidad: float = Field(gt=0)
    costo_unitario: Optional[float] = Field(default=None, ge=0)
    notas: Optional[str] = Field(default=None, max_length=500)


class StockEntryResponse(BaseModel):
    id: str
    producto_id: str
    producto_nombre: str
    cantidad: float
    costo_unitario: Optional[float]
    notas: Optional[str]
    usuario_id: str
    usuario_nombre: str
    fecha: datetime
