from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone

from database import db
from dependencies import require_admin, require_seller_or_admin, parse_object_id
from models.cash_register import CashRegisterOpen, CashRegisterClose, CashRegisterResponse

router = APIRouter(prefix="/api/cash-register", tags=["cash_register"])


@router.post("/open", response_model=CashRegisterResponse, status_code=201)
async def open_cash_register(data: CashRegisterOpen, user: dict = Depends(require_seller_or_admin)):
    existing = await db.cash_registers.find_one({"estado": "abierto"})
    if existing:
        raise HTTPException(status_code=400, detail="Ya hay un corte de caja abierto")

    doc = {
        "estado": "abierto",
        "monto_inicial": data.monto_inicial,
        "monto_contado": None,
        "monto_esperado": None,
        "diferencia": None,
        "ventas_efectivo": 0.0,
        "ventas_total": 0.0,
        "notas_apertura": data.notas,
        "notas_cierre": None,
        "usuario_id": user["id"],
        "usuario_nombre": user["name"],
        "fecha_apertura": datetime.now(timezone.utc),
        "fecha_cierre": None
    }
    result = await db.cash_registers.insert_one(doc)
    return CashRegisterResponse(id=str(result.inserted_id), **{k: doc[k] for k in doc if k != "_id"})


@router.post("/close", response_model=CashRegisterResponse)
async def close_cash_register(data: CashRegisterClose, user: dict = Depends(require_seller_or_admin)):
    register = await db.cash_registers.find_one({"estado": "abierto"})
    if not register:
        raise HTTPException(status_code=404, detail="No hay un corte de caja abierto")

    apertura = register["fecha_apertura"]
    now = datetime.now(timezone.utc)

    # Sum cash sales since opening
    cash_pipeline = [
        {"$match": {"fecha_venta": {"$gte": apertura, "$lte": now}, "metodo_pago": "efectivo", "estado": {"$ne": "anulada"}}},
        {"$group": {"_id": None, "total": {"$sum": "$monto_total"}}}
    ]
    cash_result = await db.sales.aggregate(cash_pipeline).to_list(1)
    ventas_efectivo = cash_result[0]["total"] if cash_result else 0.0

    # Sum all sales since opening
    total_pipeline = [
        {"$match": {"fecha_venta": {"$gte": apertura, "$lte": now}, "estado": {"$ne": "anulada"}}},
        {"$group": {"_id": None, "total": {"$sum": "$monto_total"}}}
    ]
    total_result = await db.sales.aggregate(total_pipeline).to_list(1)
    ventas_total = total_result[0]["total"] if total_result else 0.0

    monto_esperado = round(register["monto_inicial"] + ventas_efectivo, 2)
    diferencia = round(data.monto_contado - monto_esperado, 2)

    await db.cash_registers.update_one(
        {"_id": register["_id"]},
        {"$set": {
            "estado": "cerrado",
            "monto_contado": data.monto_contado,
            "monto_esperado": monto_esperado,
            "diferencia": diferencia,
            "ventas_efectivo": round(ventas_efectivo, 2),
            "ventas_total": round(ventas_total, 2),
            "notas_cierre": data.notas,
            "fecha_cierre": now
        }}
    )

    updated = await db.cash_registers.find_one({"_id": register["_id"]})
    return CashRegisterResponse(
        id=str(updated["_id"]), estado=updated["estado"], monto_inicial=updated["monto_inicial"],
        monto_contado=updated.get("monto_contado"), monto_esperado=updated.get("monto_esperado"),
        diferencia=updated.get("diferencia"), ventas_efectivo=updated["ventas_efectivo"],
        ventas_total=updated["ventas_total"], notas_apertura=updated.get("notas_apertura"),
        notas_cierre=updated.get("notas_cierre"), usuario_id=updated["usuario_id"],
        usuario_nombre=updated["usuario_nombre"], fecha_apertura=updated["fecha_apertura"],
        fecha_cierre=updated.get("fecha_cierre")
    )


@router.get("/current", response_model=Optional[CashRegisterResponse])
async def get_current_cash_register(user: dict = Depends(require_seller_or_admin)):
    register = await db.cash_registers.find_one({"estado": "abierto"})
    if not register:
        return None

    # Calculate live sales since opening
    apertura = register["fecha_apertura"]
    now = datetime.now(timezone.utc)

    cash_pipeline = [
        {"$match": {"fecha_venta": {"$gte": apertura, "$lte": now}, "metodo_pago": "efectivo", "estado": {"$ne": "anulada"}}},
        {"$group": {"_id": None, "total": {"$sum": "$monto_total"}}}
    ]
    cash_result = await db.sales.aggregate(cash_pipeline).to_list(1)
    ventas_efectivo = round(cash_result[0]["total"] if cash_result else 0.0, 2)

    total_pipeline = [
        {"$match": {"fecha_venta": {"$gte": apertura, "$lte": now}, "estado": {"$ne": "anulada"}}},
        {"$group": {"_id": None, "total": {"$sum": "$monto_total"}}}
    ]
    total_result = await db.sales.aggregate(total_pipeline).to_list(1)
    ventas_total = round(total_result[0]["total"] if total_result else 0.0, 2)

    return CashRegisterResponse(
        id=str(register["_id"]), estado=register["estado"], monto_inicial=register["monto_inicial"],
        monto_contado=register.get("monto_contado"), monto_esperado=register.get("monto_esperado"),
        diferencia=register.get("diferencia"), ventas_efectivo=ventas_efectivo,
        ventas_total=ventas_total, notas_apertura=register.get("notas_apertura"),
        notas_cierre=register.get("notas_cierre"), usuario_id=register["usuario_id"],
        usuario_nombre=register["usuario_nombre"], fecha_apertura=register["fecha_apertura"],
        fecha_cierre=register.get("fecha_cierre")
    )


@router.get("", response_model=List[CashRegisterResponse])
async def list_cash_registers(limit: int = 30, user: dict = Depends(require_seller_or_admin)):
    registers = await db.cash_registers.find({}).sort("fecha_apertura", -1).limit(limit).to_list(limit)
    return [
        CashRegisterResponse(
            id=str(r["_id"]), estado=r["estado"], monto_inicial=r["monto_inicial"],
            monto_contado=r.get("monto_contado"), monto_esperado=r.get("monto_esperado"),
            diferencia=r.get("diferencia"), ventas_efectivo=r.get("ventas_efectivo", 0.0),
            ventas_total=r.get("ventas_total", 0.0), notas_apertura=r.get("notas_apertura"),
            notas_cierre=r.get("notas_cierre"), usuario_id=r["usuario_id"],
            usuario_nombre=r["usuario_nombre"], fecha_apertura=r["fecha_apertura"],
            fecha_cierre=r.get("fecha_cierre")
        )
        for r in registers
    ]


@router.get("/{register_id}", response_model=CashRegisterResponse)
async def get_cash_register(register_id: str, user: dict = Depends(require_admin)):
    r = await db.cash_registers.find_one({"_id": parse_object_id(register_id)})
    if not r:
        raise HTTPException(status_code=404, detail="Corte no encontrado")
    return CashRegisterResponse(
        id=str(r["_id"]), estado=r["estado"], monto_inicial=r["monto_inicial"],
        monto_contado=r.get("monto_contado"), monto_esperado=r.get("monto_esperado"),
        diferencia=r.get("diferencia"), ventas_efectivo=r.get("ventas_efectivo", 0.0),
        ventas_total=r.get("ventas_total", 0.0), notas_apertura=r.get("notas_apertura"),
        notas_cierre=r.get("notas_cierre"), usuario_id=r["usuario_id"],
        usuario_nombre=r["usuario_nombre"], fecha_apertura=r["fecha_apertura"],
        fecha_cierre=r.get("fecha_cierre")
    )
