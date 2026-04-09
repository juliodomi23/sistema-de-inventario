import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timezone, timedelta
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from database import db
from dependencies import require_admin

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/sales")
async def get_sales_report(
    start_date: Optional[str] = Query(None, description="Fecha inicio YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Fecha fin YYYY-MM-DD"),
    status: Optional[str] = Query(None, description="Estado: completada, anulada, todas"),
    user: dict = Depends(require_admin)
):
    """Obtiene ventas filtradas por fecha y estado"""

    query = {}

    # Date filters
    if start_date or end_date:
        date_filter = {}
        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            date_filter["$gte"] = start
        if end_date:
            end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            date_filter["$lte"] = end
        if date_filter:
            query["fecha_venta"] = date_filter

    # Status filter
    if status and status != "todas":
        query["estado"] = status

    sales = await db.sales.find(query).sort("fecha_venta", -1).to_list(1000)

    # Calculate totals
    total_completadas = sum(s["monto_total"] for s in sales if s.get("estado") != "anulada")
    total_anuladas = sum(s["monto_total"] for s in sales if s.get("estado") == "anulada")

    return {
        "sales": [
            {
                "id": str(s["_id"]),
                "fecha_venta": s["fecha_venta"].isoformat(),
                "metodo_pago": s["metodo_pago"],
                "monto_total": s["monto_total"],
                "cambio": s.get("cambio"),
                "estado": s.get("estado", "completada"),
                "items": s.get("items", [])
            }
            for s in sales
        ],
        "summary": {
            "total_ventas": len(sales),
            "ventas_completadas": len([s for s in sales if s.get("estado") != "anulada"]),
            "ventas_anuladas": len([s for s in sales if s.get("estado") == "anulada"]),
            "monto_completadas": round(total_completadas, 2),
            "monto_anuladas": round(total_anuladas, 2)
        }
    }


@router.get("/sales/export/csv")
async def export_sales_csv(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user: dict = Depends(require_admin)
):
    """Exporta ventas a CSV"""

    query = {}
    if start_date or end_date:
        date_filter = {}
        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            date_filter["$gte"] = start
        if end_date:
            end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            date_filter["$lte"] = end
        if date_filter:
            query["fecha_venta"] = date_filter

    if status and status != "todas":
        query["estado"] = status

    sales = await db.sales.find(query).sort("fecha_venta", -1).to_list(1000)

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(["ID", "Fecha", "Hora", "Método Pago", "Total (MXN)", "Cambio", "Estado", "Productos"])

    # Data rows
    for sale in sales:
        fecha = sale["fecha_venta"]
        productos = ", ".join([f"{item['producto_nombre']} x{item['cantidad_vendida']}" for item in sale.get("items", [])])
        writer.writerow([
            str(sale["_id"]),
            fecha.strftime("%Y-%m-%d"),
            fecha.strftime("%H:%M:%S"),
            sale["metodo_pago"],
            sale["monto_total"],
            sale.get("cambio", ""),
            sale.get("estado", "completada"),
            productos
        ])

    output.seek(0)

    filename = f"ventas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/sales/export/pdf")
async def export_sales_pdf(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user: dict = Depends(require_admin)
):
    """Exporta ventas a PDF"""

    query = {}
    if start_date or end_date:
        date_filter = {}
        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            date_filter["$gte"] = start
        if end_date:
            end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            date_filter["$lte"] = end
        if date_filter:
            query["fecha_venta"] = date_filter

    if status and status != "todas":
        query["estado"] = status

    sales = await db.sales.find(query).sort("fecha_venta", -1).to_list(1000)

    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)

    elements = []
    styles = getSampleStyleSheet()

    # Title
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=18, spaceAfter=20)
    elements.append(Paragraph("Reporte de Ventas", title_style))

    # Date range
    date_range = ""
    if start_date and end_date:
        date_range = f"Del {start_date} al {end_date}"
    elif start_date:
        date_range = f"Desde {start_date}"
    elif end_date:
        date_range = f"Hasta {end_date}"
    else:
        date_range = "Todas las ventas"

    elements.append(Paragraph(f"Período: {date_range}", styles['Normal']))
    elements.append(Paragraph(f"Generado: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 20))

    # Summary
    total_completadas = sum(s["monto_total"] for s in sales if s.get("estado") != "anulada")
    total_anuladas = sum(s["monto_total"] for s in sales if s.get("estado") == "anulada")

    summary_data = [
        ["Total de Ventas", str(len(sales))],
        ["Ventas Completadas", str(len([s for s in sales if s.get("estado") != "anulada"]))],
        ["Ventas Anuladas", str(len([s for s in sales if s.get("estado") == "anulada"]))],
        ["Monto Completadas", f"${total_completadas:,.2f} MXN"],
        ["Monto Anuladas", f"${total_anuladas:,.2f} MXN"],
    ]

    summary_table = Table(summary_data, colWidths=[200, 150])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 20))

    # Sales table
    elements.append(Paragraph("Detalle de Ventas", styles['Heading2']))
    elements.append(Spacer(1, 10))

    if sales:
        table_data = [["Fecha", "Hora", "Método", "Total", "Estado"]]
        for sale in sales[:100]:  # Limit to 100 rows
            fecha = sale["fecha_venta"]
            table_data.append([
                fecha.strftime("%Y-%m-%d"),
                fecha.strftime("%H:%M"),
                sale["metodo_pago"].capitalize(),
                f"${sale['monto_total']:,.2f}",
                sale.get("estado", "completada").capitalize()
            ])

        sales_table = Table(table_data, colWidths=[80, 60, 80, 80, 80])
        sales_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
        ]))
        elements.append(sales_table)
    else:
        elements.append(Paragraph("No hay ventas en el período seleccionado.", styles['Normal']))

    doc.build(elements)
    buffer.seek(0)

    filename = f"ventas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/statistics")
async def get_statistics(
    days: int = Query(7, description="Número de días para estadísticas"),
    user: dict = Depends(require_admin)
):
    """Obtiene estadísticas de ventas para gráficas"""

    end_date = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59)
    start_date = (end_date - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0)

    # Daily sales aggregation
    pipeline = [
        {
            "$match": {
                "fecha_venta": {"$gte": start_date, "$lte": end_date},
                "estado": {"$ne": "anulada"}
            }
        },
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$fecha_venta"},
                    "month": {"$month": "$fecha_venta"},
                    "day": {"$dayOfMonth": "$fecha_venta"}
                },
                "total": {"$sum": "$monto_total"},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1}}
    ]

    daily_sales = await db.sales.aggregate(pipeline).to_list(100)

    # Payment method breakdown
    payment_pipeline = [
        {
            "$match": {
                "fecha_venta": {"$gte": start_date, "$lte": end_date},
                "estado": {"$ne": "anulada"}
            }
        },
        {
            "$group": {
                "_id": "$metodo_pago",
                "total": {"$sum": "$monto_total"},
                "count": {"$sum": 1}
            }
        }
    ]

    payment_breakdown = await db.sales.aggregate(payment_pipeline).to_list(10)

    # Top selling products
    top_products_pipeline = [
        {
            "$match": {
                "fecha_venta": {"$gte": start_date, "$lte": end_date},
                "estado": {"$ne": "anulada"}
            }
        },
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.producto_nombre",
                "cantidad_total": {"$sum": "$items.cantidad_vendida"},
                "ingresos": {"$sum": "$items.subtotal"}
            }
        },
        {"$sort": {"ingresos": -1}},
        {"$limit": 5}
    ]

    top_products = await db.sales.aggregate(top_products_pipeline).to_list(5)

    # Format daily data for chart
    daily_data = []
    current = start_date
    while current <= end_date:
        day_data = next(
            (d for d in daily_sales if
             d["_id"]["year"] == current.year and
             d["_id"]["month"] == current.month and
             d["_id"]["day"] == current.day),
            None
        )
        daily_data.append({
            "date": current.strftime("%Y-%m-%d"),
            "label": current.strftime("%d %b"),
            "total": day_data["total"] if day_data else 0,
            "count": day_data["count"] if day_data else 0
        })
        current += timedelta(days=1)

    return {
        "daily_sales": daily_data,
        "payment_breakdown": [
            {"method": p["_id"], "total": round(p["total"], 2), "count": p["count"]}
            for p in payment_breakdown
        ],
        "top_products": [
            {"name": p["_id"], "cantidad": p["cantidad_total"], "ingresos": round(p["ingresos"], 2)}
            for p in top_products
        ],
        "period": {
            "start": start_date.strftime("%Y-%m-%d"),
            "end": end_date.strftime("%Y-%m-%d"),
            "days": days
        }
    }
