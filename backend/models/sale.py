from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
from models.enums import PaymentMethod


class SaleItemCreate(BaseModel):
    producto_id: str
    cantidad: float


class SaleCreate(BaseModel):
    items: List[SaleItemCreate]
    metodo_pago: PaymentMethod
    monto_recibido: Optional[float] = None
    cliente_id: Optional[str] = None
    descuento_tipo: Optional[str] = None  # "porcentaje" | "monto_fijo"
    descuento_valor: Optional[float] = Field(default=None, ge=0)


class SaleItemResponse(BaseModel):
    producto_id: str
    producto_nombre: str
    cantidad_vendida: float
    precio_unitario: float
    subtotal: float


class SaleResponse(BaseModel):
    id: str
    fecha_venta: datetime
    metodo_pago: str
    monto_subtotal: float
    descuento_tipo: Optional[str] = None
    descuento_valor: Optional[float] = None
    monto_descuento: Optional[float] = None
    monto_total: float
    cambio: Optional[float]
    items: List[SaleItemResponse]
    estado: str = "completada"
    cliente_id: Optional[str] = None
    cliente_nombre: Optional[str] = None
