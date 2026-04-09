from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class CategoryCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=300)


class CategoryResponse(BaseModel):
    id: str
    nombre: str
    descripcion: Optional[str]
    fecha_creacion: datetime
