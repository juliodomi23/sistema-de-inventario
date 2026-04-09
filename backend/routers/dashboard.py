from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta

from database import db
from dependencies import require_admin, get_stock_status

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_dashboard_summary(user: dict = Depends(require_admin)):
    # Get product counts by status
    products = await db.products.find({}).to_list(1000)

    stock_counts = {"green": 0, "yellow": 0, "red": 0}
    for p in products:
        status = get_stock_status(p["cantidad_stock"], p["cantidad_minima"])
        stock_counts[status] += 1

    # Get today's sales
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    sales_pipeline = [
        {"$match": {"fecha_venta": {"$gte": today_start, "$lt": today_end}}},
        {"$group": {
            "_id": None,
            "total_ventas": {"$sum": "$monto_total"},
            "cantidad_ventas": {"$sum": 1}
        }}
    ]
    sales_result = await db.sales.aggregate(sales_pipeline).to_list(1)

    # Get recent sales
    recent_sales = await db.sales.find({}).sort("fecha_venta", -1).limit(5).to_list(5)

    return {
        "productos_total": len(products),
        "stock_verde": stock_counts["green"],
        "stock_amarillo": stock_counts["yellow"],
        "stock_rojo": stock_counts["red"],
        "ventas_hoy": sales_result[0]["total_ventas"] if sales_result else 0,
        "cantidad_ventas_hoy": sales_result[0]["cantidad_ventas"] if sales_result else 0,
        "ultimas_ventas": [
            {
                "id": str(s["_id"]),
                "fecha": s["fecha_venta"].isoformat(),
                "total": s["monto_total"],
                "metodo_pago": s["metodo_pago"]
            }
            for s in recent_sales
        ]
    }
