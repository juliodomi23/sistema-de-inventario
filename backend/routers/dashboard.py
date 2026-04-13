from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

MEXICO_TZ = ZoneInfo("America/Mexico_City")
from bson import ObjectId

from database import db
from dependencies import require_admin, get_stock_status

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_dashboard_summary(user: dict = Depends(require_admin)):
    # Products
    products = await db.products.find({}).to_list(1000)

    stock_counts = {"green": 0, "yellow": 0, "red": 0}
    valor_inventario = 0.0
    for p in products:
        status = get_stock_status(p["cantidad_stock"], p["cantidad_minima"])
        stock_counts[status] += 1
        valor_inventario += p["cantidad_stock"] * p["precio_unitario"]

    # Build a cost map for profit calculations
    cost_map = {str(p["_id"]): p.get("costo") for p in products}

    # Today boundaries (Mexico City timezone)
    now_mx = datetime.now(MEXICO_TZ)
    today_start = now_mx.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    today_end = today_start + timedelta(days=1)
    yesterday_start = today_start - timedelta(days=1)

    # Today's sales
    today_sales = await db.sales.find({
        "fecha_venta": {"$gte": today_start, "$lt": today_end},
        "estado": {"$ne": "anulada"}
    }).to_list(1000)

    ventas_hoy = sum(s["monto_total"] for s in today_sales)
    cantidad_ventas_hoy = len(today_sales)

    # Today's estimated profit
    ganancia_hoy = 0.0
    items_con_costo = 0
    items_total = 0
    for sale in today_sales:
        for item in sale.get("items", []):
            items_total += 1
            costo = cost_map.get(item.get("producto_id"))
            if costo is not None:
                ganancia_hoy += item["subtotal"] - (costo * item["cantidad_vendida"])
                items_con_costo += 1

    # Yesterday's sales total
    yesterday_sales = await db.sales.aggregate([
        {"$match": {
            "fecha_venta": {"$gte": yesterday_start, "$lt": today_start},
            "estado": {"$ne": "anulada"}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$monto_total"}}}
    ]).to_list(1)
    ventas_ayer = yesterday_sales[0]["total"] if yesterday_sales else 0

    # % change vs yesterday
    if ventas_ayer > 0:
        cambio_pct = round(((ventas_hoy - ventas_ayer) / ventas_ayer) * 100, 1)
    elif ventas_hoy > 0:
        cambio_pct = 100.0
    else:
        cambio_pct = 0.0

    # Recent sales
    recent_sales = await db.sales.find({}).sort("fecha_venta", -1).limit(5).to_list(5)

    return {
        "productos_total": len(products),
        "stock_verde": stock_counts["green"],
        "stock_amarillo": stock_counts["yellow"],
        "stock_rojo": stock_counts["red"],
        "ventas_hoy": round(ventas_hoy, 2),
        "cantidad_ventas_hoy": cantidad_ventas_hoy,
        "ganancia_hoy": round(ganancia_hoy, 2),
        "ganancia_tiene_datos": items_con_costo > 0,
        "valor_inventario": round(valor_inventario, 2),
        "ventas_ayer": round(ventas_ayer, 2),
        "cambio_vs_ayer": cambio_pct,
        "ultimas_ventas": [
            {
                "id": str(s["_id"]),
                "fecha": s["fecha_venta"].isoformat(),
                "total": s["monto_total"],
                "metodo_pago": s["metodo_pago"],
                "estado": s.get("estado", "completada"),
            }
            for s in recent_sales
        ]
    }
