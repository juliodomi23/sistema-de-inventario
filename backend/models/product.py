from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from models.enums import UnitType


class ProductCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=200)
    precio_unitario: float = Field(gt=0)
    costo: Optional[float] = Field(default=None, ge=0)
    unidad_medida: UnitType
    cantidad_stock: float = Field(ge=0)
    cantidad_minima: float = Field(ge=0)
    categoria_id: Optional[str] = None
    codigo_barras: Optional[str] = Field(default=None, max_length=100)


class ProductUpdate(BaseModel):
    nombre: Optional[str] = None
    precio_unitario: Optional[float] = Field(default=None, gt=0)
    costo: Optional[float] = Field(default=None, ge=0)
    unidad_medida: Optional[UnitType] = None
    cantidad_stock: Optional[float] = Field(default=None, ge=0)
    cantidad_minima: Optional[float] = Field(default=None, ge=0)
    categoria_id: Optional[str] = None
    codigo_barras: Optional[str] = Field(default=None, max_length=100)


class ProductResponse(BaseModel):
    id: str
    nombre: str
    precio_unitario: float
    costo: Optional[float] = None
    unidad_medida: str
    cantidad_stock: float
    cantidad_minima: float
    fecha_creacion: datetime
    stock_status: str
    categoria_id: Optional[str] = None
    categoria_nombre: Optional[str] = None
    codigo_barras: Optional[str] = None
    imagen_url: Optional[str] = None
