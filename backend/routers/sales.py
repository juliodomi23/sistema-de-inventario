from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone, timedelta

from database import db
from dependencies import require_admin, require_seller_or_admin, parse_object_id
from models.sale import SaleCreate, SaleResponse, SaleItemResponse
from models.enums import PaymentMethod

router = APIRouter(prefix="/api/sales", tags=["sales"])


@router.post("", response_model=SaleResponse)
async def create_sale(sale: SaleCreate, user: dict = Depends(require_seller_or_admin)):
    items_response = []
    monto_subtotal = 0.0
    stock_updates = []

    # Validate all items first
    for item in sale.items:
        product = await db.products.find_one({"_id": parse_object_id(item.producto_id)})
        if not product:
            raise HTTPException(status_code=404, detail=f"Producto {item.producto_id} no encontrado")
        if product["cantidad_stock"] < item.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para {product['nombre']}. Disponible: {product['cantidad_stock']}"
            )

        subtotal = product["precio_unitario"] * item.cantidad
        monto_subtotal += subtotal

        items_response.append(SaleItemResponse(
            producto_id=item.producto_id,
            producto_nombre=product["nombre"],
            cantidad_vendida=item.cantidad,
            precio_unitario=product["precio_unitario"],
            subtotal=subtotal
        ))

        stock_updates.append({
            "producto_id": item.producto_id,
            "nombre": product["nombre"],
            "cantidad": item.cantidad,
            "stock_anterior": product["cantidad_stock"]
        })

    monto_subtotal = round(monto_subtotal, 2)

    # Apply discount
    monto_descuento = 0.0
    if sale.descuento_tipo and sale.descuento_valor and sale.descuento_valor > 0:
        if sale.descuento_tipo == "porcentaje":
            monto_descuento = round(monto_subtotal * (sale.descuento_valor / 100), 2)
        elif sale.descuento_tipo == "monto_fijo":
            monto_descuento = min(sale.descuento_valor, monto_subtotal)
        monto_descuento = round(monto_descuento, 2)
    monto_total_final = round(monto_subtotal - monto_descuento, 2)

    # Validate fiado payment
    cliente_nombre = None
    if sale.metodo_pago == PaymentMethod.FIADO:
        if not sale.cliente_id:
            raise HTTPException(status_code=400, detail="Se requiere cliente_id para pago fiado")
        customer = await db.customers.find_one({"_id": parse_object_id(sale.cliente_id)})
        if not customer:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
        cliente_nombre = customer["nombre"]
        limite = customer.get("limite_credito", 0)
        saldo_actual = customer.get("saldo_pendiente", 0)
        if limite > 0 and (saldo_actual + monto_total_final) > limite:
            raise HTTPException(
                status_code=400,
                detail=f"El cliente supera su límite de crédito (${limite:.2f}). Saldo actual: ${saldo_actual:.2f}"
            )

    # Validate cash payment
    cambio = None
    if sale.metodo_pago == PaymentMethod.EFECTIVO:
        if sale.monto_recibido is None:
            raise HTTPException(status_code=400, detail="Monto recibido es requerido para pago en efectivo")
        if sale.monto_recibido < monto_total_final:
            raise HTTPException(status_code=400, detail="El monto recibido es menor al total")
        cambio = round(sale.monto_recibido - monto_total_final, 2)

    # Create sale document
    sale_doc = {
        "fecha_venta": datetime.now(timezone.utc),
        "metodo_pago": sale.metodo_pago.value,
        "monto_subtotal": monto_subtotal,
        "descuento_tipo": sale.descuento_tipo,
        "descuento_valor": sale.descuento_valor,
        "monto_descuento": monto_descuento if monto_descuento > 0 else None,
        "monto_total": monto_total_final,
        "cambio": cambio,
        "monto_recibido": sale.monto_recibido,
        "cliente_id": sale.cliente_id,
        "cliente_nombre": cliente_nombre,
        "items": [item.model_dump() for item in items_response],
        "estado": "completada"
    }
    result = await db.sales.insert_one(sale_doc)

    # Update stock atomically
    for update in stock_updates:
        atomic_result = await db.products.update_one(
            {
                "_id": parse_object_id(update["producto_id"]),
                "cantidad_stock": {"$gte": update["cantidad"]}
            },
            {"$inc": {"cantidad_stock": -update["cantidad"]}}
        )
        if atomic_result.matched_count == 0:
            raise HTTPException(status_code=409, detail=f"Stock insuficiente en {update.get('nombre', update['producto_id'])} (conflicto concurrente)")

        new_stock = update["stock_anterior"] - update["cantidad"]
        await db.stock_logs.insert_one({
            "producto_id": update["producto_id"],
            "cantidad_anterior": update["stock_anterior"],
            "cantidad_nueva": new_stock,
            "tipo": "venta",
            "venta_id": str(result.inserted_id),
            "fecha": datetime.now(timezone.utc)
        })

    # Update customer pending balance for fiado
    if sale.metodo_pago == PaymentMethod.FIADO and sale.cliente_id:
        await db.customers.update_one(
            {"_id": parse_object_id(sale.cliente_id)},
            {"$inc": {"saldo_pendiente": monto_total_final}}
        )

    return SaleResponse(
        id=str(result.inserted_id),
        fecha_venta=sale_doc["fecha_venta"],
        metodo_pago=sale_doc["metodo_pago"],
        monto_subtotal=monto_subtotal,
        descuento_tipo=sale.descuento_tipo,
        descuento_valor=sale.descuento_valor,
        monto_descuento=sale_doc["monto_descuento"],
        monto_total=monto_total_final,
        cambio=sale_doc["cambio"],
        items=items_response,
        estado="completada",
        cliente_id=sale.cliente_id,
        cliente_nombre=cliente_nombre
    )


@router.get("", response_model=List[SaleResponse])
async def list_sales(limit: int = 50, user: dict = Depends(require_admin)):
    sales = await db.sales.find({}).sort("fecha_venta", -1).limit(limit).to_list(limit)
    return [
        SaleResponse(
            id=str(s["_id"]),
            fecha_venta=s["fecha_venta"],
            metodo_pago=s["metodo_pago"],
            monto_subtotal=s.get("monto_subtotal", s["monto_total"]),
            descuento_tipo=s.get("descuento_tipo"),
            descuento_valor=s.get("descuento_valor"),
            monto_descuento=s.get("monto_descuento"),
            monto_total=s["monto_total"],
            cambio=s.get("cambio"),
            items=[SaleItemResponse(**item) for item in s.get("items", [])],
            estado=s.get("estado", "completada"),
            cliente_id=s.get("cliente_id"),
            cliente_nombre=s.get("cliente_nombre")
        )
        for s in sales
    ]


@router.get("/today-summary")
async def get_today_summary(user: dict = Depends(require_admin)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    pipeline = [
        {"$match": {"fecha_venta": {"$gte": today_start, "$lt": today_end}}},
        {"$group": {
            "_id": None,
            "total_ventas": {"$sum": "$monto_total"},
            "cantidad_ventas": {"$sum": 1}
        }}
    ]

    result = await db.sales.aggregate(pipeline).to_list(1)

    if result:
        return {
            "total_ventas": round(result[0]["total_ventas"], 2),
            "cantidad_ventas": result[0]["cantidad_ventas"]
        }
    return {"total_ventas": 0, "cantidad_ventas": 0}


@router.post("/{sale_id}/cancel")
async def cancel_sale(sale_id: str, user: dict = Depends(require_admin)):
    """Anula una venta y restaura el stock de los productos"""
    sale = await db.sales.find_one({"_id": parse_object_id(sale_id)})
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if sale.get("estado") == "anulada":
        raise HTTPException(status_code=400, detail="Esta venta ya fue anulada")

    # Restore stock for each item
    for item in sale.get("items", []):
        product = await db.products.find_one({"_id": parse_object_id(item["producto_id"])})
        if product:
            new_stock = product["cantidad_stock"] + item["cantidad_vendida"]
            await db.products.update_one(
                {"_id": parse_object_id(item["producto_id"])},
                {"$set": {"cantidad_stock": new_stock}}
            )
            await db.stock_logs.insert_one({
                "producto_id": item["producto_id"],
                "cantidad_anterior": product["cantidad_stock"],
                "cantidad_nueva": new_stock,
                "tipo": "anulacion_venta",
                "venta_id": sale_id,
                "fecha": datetime.now(timezone.utc)
            })

    # Update sale status
    await db.sales.update_one(
        {"_id": parse_object_id(sale_id)},
        {
            "$set": {
                "estado": "anulada",
                "fecha_anulacion": datetime.now(timezone.utc),
                "anulada_por": user["id"]
            }
        }
    )

    return {
        "message": "Venta anulada exitosamente",
        "sale_id": sale_id,
        "stock_restored": True
    }
