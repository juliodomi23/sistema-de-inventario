from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone

from database import db
from dependencies import require_admin, parse_object_id
from models.stock_entry import StockEntryCreate, StockEntryResponse

router = APIRouter(prefix="/api/stock-entries", tags=["stock_entries"])


@router.post("", response_model=StockEntryResponse, status_code=201)
async def create_stock_entry(entry: StockEntryCreate, user: dict = Depends(require_admin)):
    product = await db.products.find_one({"_id": parse_object_id(entry.producto_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    old_stock = product["cantidad_stock"]
    new_stock = old_stock + entry.cantidad
    await db.products.update_one({"_id": parse_object_id(entry.producto_id)}, {"$inc": {"cantidad_stock": entry.cantidad}})

    doc = {
        "producto_id": entry.producto_id,
        "producto_nombre": product["nombre"],
        "cantidad": entry.cantidad,
        "costo_unitario": entry.costo_unitario,
        "notas": entry.notas,
        "usuario_id": user["id"],
        "usuario_nombre": user["name"],
        "fecha": datetime.now(timezone.utc)
    }
    result = await db.stock_entries.insert_one(doc)

    await db.stock_logs.insert_one({
        "producto_id": entry.producto_id,
        "cantidad_anterior": old_stock,
        "cantidad_nueva": new_stock,
        "tipo": "entrada",
        "fecha": datetime.now(timezone.utc)
    })

    return StockEntryResponse(id=str(result.inserted_id), **{k: doc[k] for k in doc if k != "_id"})


@router.get("", response_model=List[StockEntryResponse])
async def list_stock_entries(limit: int = 100, user: dict = Depends(require_admin)):
    entries = await db.stock_entries.find({}).sort("fecha", -1).limit(limit).to_list(limit)
    return [
        StockEntryResponse(
            id=str(e["_id"]),
            producto_id=e["producto_id"],
            producto_nombre=e["producto_nombre"],
            cantidad=e["cantidad"],
            costo_unitario=e.get("costo_unitario"),
            notas=e.get("notas"),
            usuario_id=e["usuario_id"],
            usuario_nombre=e["usuario_nombre"],
            fecha=e["fecha"]
        )
        for e in entries
    ]


@router.get("/product/{product_id}", response_model=List[StockEntryResponse])
async def list_stock_entries_by_product(product_id: str, user: dict = Depends(require_admin)):
    entries = await db.stock_entries.find({"producto_id": product_id}).sort("fecha", -1).to_list(200)
    return [
        StockEntryResponse(
            id=str(e["_id"]),
            producto_id=e["producto_id"],
            producto_nombre=e["producto_nombre"],
            cantidad=e["cantidad"],
            costo_unitario=e.get("costo_unitario"),
            notas=e.get("notas"),
            usuario_id=e["usuario_id"],
            usuario_nombre=e["usuario_nombre"],
            fecha=e["fecha"]
        )
        for e in entries
    ]
