from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone

from database import db
from dependencies import require_admin, require_seller_or_admin, parse_object_id
from models.customer import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerPaymentCreate

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("", response_model=List[CustomerResponse])
async def list_customers(user: dict = Depends(require_seller_or_admin)):
    customers = await db.customers.find({}).sort("nombre", 1).to_list(1000)
    return [
        CustomerResponse(
            id=str(c["_id"]),
            nombre=c["nombre"],
            telefono=c.get("telefono"),
            email=c.get("email"),
            limite_credito=c.get("limite_credito", 0),
            saldo_pendiente=c.get("saldo_pendiente", 0),
            notas=c.get("notas"),
            fecha_creacion=c.get("fecha_creacion", datetime.now(timezone.utc))
        )
        for c in customers
    ]


@router.post("", response_model=CustomerResponse, status_code=201)
async def create_customer(customer: CustomerCreate, user: dict = Depends(require_admin)):
    doc = {
        "nombre": customer.nombre,
        "telefono": customer.telefono,
        "email": customer.email,
        "limite_credito": customer.limite_credito,
        "saldo_pendiente": 0.0,
        "notas": customer.notas,
        "fecha_creacion": datetime.now(timezone.utc)
    }
    result = await db.customers.insert_one(doc)
    return CustomerResponse(
        id=str(result.inserted_id),
        nombre=doc["nombre"],
        telefono=doc["telefono"],
        email=doc["email"],
        limite_credito=doc["limite_credito"],
        saldo_pendiente=0.0,
        notas=doc["notas"],
        fecha_creacion=doc["fecha_creacion"]
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str, user: dict = Depends(require_seller_or_admin)):
    c = await db.customers.find_one({"_id": parse_object_id(customer_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return CustomerResponse(
        id=str(c["_id"]),
        nombre=c["nombre"],
        telefono=c.get("telefono"),
        email=c.get("email"),
        limite_credito=c.get("limite_credito", 0),
        saldo_pendiente=c.get("saldo_pendiente", 0),
        notas=c.get("notas"),
        fecha_creacion=c.get("fecha_creacion", datetime.now(timezone.utc))
    )


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: str, data: CustomerUpdate, user: dict = Depends(require_admin)):
    oid = parse_object_id(customer_id)
    existing = await db.customers.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.customers.update_one({"_id": oid}, {"$set": update_data})
    updated = await db.customers.find_one({"_id": oid})
    return CustomerResponse(
        id=str(updated["_id"]),
        nombre=updated["nombre"],
        telefono=updated.get("telefono"),
        email=updated.get("email"),
        limite_credito=updated.get("limite_credito", 0),
        saldo_pendiente=updated.get("saldo_pendiente", 0),
        notas=updated.get("notas"),
        fecha_creacion=updated.get("fecha_creacion", datetime.now(timezone.utc))
    )


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str, user: dict = Depends(require_admin)):
    oid = parse_object_id(customer_id)
    c = await db.customers.find_one({"_id": oid})
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if c.get("saldo_pendiente", 0) > 0:
        raise HTTPException(status_code=400, detail=f"El cliente tiene saldo pendiente de ${c['saldo_pendiente']:.2f}")
    await db.customers.delete_one({"_id": oid})
    return {"message": "Cliente eliminado"}


@router.get("/{customer_id}/sales")
async def get_customer_sales(customer_id: str, user: dict = Depends(require_admin)):
    sales = await db.sales.find({"cliente_id": customer_id}).sort("fecha_venta", -1).to_list(200)
    return [
        {
            "id": str(s["_id"]),
            "fecha_venta": s["fecha_venta"].isoformat(),
            "monto_total": s["monto_total"],
            "metodo_pago": s["metodo_pago"],
            "estado": s.get("estado", "completada")
        }
        for s in sales
    ]


@router.post("/{customer_id}/payments")
async def register_customer_payment(customer_id: str, payment: CustomerPaymentCreate, user: dict = Depends(require_admin)):
    oid = parse_object_id(customer_id)
    customer = await db.customers.find_one({"_id": oid})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    saldo_actual = customer.get("saldo_pendiente", 0)
    if payment.monto > saldo_actual:
        raise HTTPException(status_code=400, detail=f"El monto ${payment.monto:.2f} supera el saldo pendiente ${saldo_actual:.2f}")

    new_saldo = round(saldo_actual - payment.monto, 2)
    await db.customers.update_one({"_id": oid}, {"$set": {"saldo_pendiente": new_saldo}})

    payment_doc = {
        "cliente_id": customer_id,
        "cliente_nombre": customer["nombre"],
        "monto": payment.monto,
        "notas": payment.notas,
        "usuario_id": user["id"],
        "usuario_nombre": user["name"],
        "fecha": datetime.now(timezone.utc)
    }
    await db.customer_payments.insert_one(payment_doc)

    return {
        "message": "Pago registrado",
        "saldo_anterior": saldo_actual,
        "monto_pagado": payment.monto,
        "saldo_nuevo": new_saldo
    }


@router.get("/{customer_id}/payments")
async def list_customer_payments(customer_id: str, user: dict = Depends(require_admin)):
    payments = await db.customer_payments.find({"cliente_id": customer_id}).sort("fecha", -1).to_list(200)
    return [
        {
            "id": str(p["_id"]),
            "monto": p["monto"],
            "notas": p.get("notas"),
            "usuario_nombre": p["usuario_nombre"],
            "fecha": p["fecha"].isoformat()
        }
        for p in payments
    ]
