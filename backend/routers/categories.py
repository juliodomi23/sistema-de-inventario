from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone

from database import db
from dependencies import require_admin, require_seller_or_admin, parse_object_id
from models.category import CategoryCreate, CategoryResponse

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=List[CategoryResponse])
async def list_categories(user: dict = Depends(require_seller_or_admin)):
    cats = await db.categories.find({}).sort("nombre", 1).to_list(500)
    return [
        CategoryResponse(
            id=str(c["_id"]),
            nombre=c["nombre"],
            descripcion=c.get("descripcion"),
            fecha_creacion=c.get("fecha_creacion", datetime.now(timezone.utc))
        )
        for c in cats
    ]


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(cat: CategoryCreate, user: dict = Depends(require_admin)):
    existing = await db.categories.find_one({"nombre": {"$regex": f"^{cat.nombre}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
    doc = {"nombre": cat.nombre, "descripcion": cat.descripcion, "fecha_creacion": datetime.now(timezone.utc)}
    result = await db.categories.insert_one(doc)
    return CategoryResponse(id=str(result.inserted_id), nombre=cat.nombre, descripcion=cat.descripcion, fecha_creacion=doc["fecha_creacion"])


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, cat: CategoryCreate, user: dict = Depends(require_admin)):
    oid = parse_object_id(category_id)
    existing = await db.categories.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    await db.categories.update_one({"_id": oid}, {"$set": {"nombre": cat.nombre, "descripcion": cat.descripcion}})
    updated = await db.categories.find_one({"_id": oid})
    return CategoryResponse(
        id=str(updated["_id"]),
        nombre=updated["nombre"],
        descripcion=updated.get("descripcion"),
        fecha_creacion=updated.get("fecha_creacion", datetime.now(timezone.utc))
    )


@router.delete("/{category_id}")
async def delete_category(category_id: str, user: dict = Depends(require_admin)):
    oid = parse_object_id(category_id)
    in_use = await db.products.count_documents({"categoria_id": category_id})
    if in_use > 0:
        raise HTTPException(status_code=400, detail=f"No se puede eliminar: {in_use} producto(s) usan esta categoría")
    result = await db.categories.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return {"message": "Categoría eliminada"}
