from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone

from database import db
from dependencies import require_admin, require_seller_or_admin, parse_object_id, get_stock_status
from models.product import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter(prefix="/api/products", tags=["products"])


@router.post("", response_model=ProductResponse)
async def create_product(product: ProductCreate, user: dict = Depends(require_admin)):
    # Check duplicate barcode
    if product.codigo_barras:
        existing_barcode = await db.products.find_one({"codigo_barras": product.codigo_barras})
        if existing_barcode:
            raise HTTPException(status_code=400, detail="Ya existe un producto con ese código de barras")

    product_doc = {
        "nombre": product.nombre,
        "precio_unitario": product.precio_unitario,
        "unidad_medida": product.unidad_medida.value,
        "cantidad_stock": product.cantidad_stock,
        "cantidad_minima": product.cantidad_minima,
        "categoria_id": product.categoria_id,
        "codigo_barras": product.codigo_barras,
        "fecha_creacion": datetime.now(timezone.utc)
    }
    result = await db.products.insert_one(product_doc)

    # Look up category name
    categoria_nombre = None
    if product.categoria_id:
        cat = await db.categories.find_one({"_id": parse_object_id(product.categoria_id)})
        if cat:
            categoria_nombre = cat["nombre"]

    # Log stock change
    await db.stock_logs.insert_one({
        "producto_id": str(result.inserted_id),
        "cantidad_anterior": 0,
        "cantidad_nueva": product.cantidad_stock,
        "tipo": "creacion",
        "fecha": datetime.now(timezone.utc)
    })

    return ProductResponse(
        id=str(result.inserted_id),
        nombre=product.nombre,
        precio_unitario=product.precio_unitario,
        unidad_medida=product.unidad_medida.value,
        cantidad_stock=product.cantidad_stock,
        cantidad_minima=product.cantidad_minima,
        fecha_creacion=product_doc["fecha_creacion"],
        stock_status=get_stock_status(product.cantidad_stock, product.cantidad_minima),
        categoria_id=product.categoria_id,
        categoria_nombre=categoria_nombre,
        codigo_barras=product.codigo_barras
    )


@router.get("", response_model=List[ProductResponse])
async def list_products(user: dict = Depends(require_seller_or_admin)):
    products = await db.products.find({}).to_list(1000)

    # Fetch all categories in one query for efficiency
    cat_ids = list({p["categoria_id"] for p in products if p.get("categoria_id")})
    cat_map = {}
    if cat_ids:
        cats = await db.categories.find({"_id": {"$in": [parse_object_id(cid) for cid in cat_ids]}}).to_list(500)
        cat_map = {str(c["_id"]): c["nombre"] for c in cats}

    return [
        ProductResponse(
            id=str(p["_id"]),
            nombre=p["nombre"],
            precio_unitario=p["precio_unitario"],
            unidad_medida=p["unidad_medida"],
            cantidad_stock=p["cantidad_stock"],
            cantidad_minima=p["cantidad_minima"],
            fecha_creacion=p.get("fecha_creacion", datetime.now(timezone.utc)),
            stock_status=get_stock_status(p["cantidad_stock"], p["cantidad_minima"]),
            categoria_id=p.get("categoria_id"),
            categoria_nombre=cat_map.get(p["categoria_id"]) if p.get("categoria_id") else None,
            codigo_barras=p.get("codigo_barras")
        )
        for p in products
    ]


# NOTE: barcode route MUST be before /{product_id} to avoid route shadowing
@router.get("/barcode/{codigo}", response_model=ProductResponse)
async def get_product_by_barcode(codigo: str, user: dict = Depends(require_seller_or_admin)):
    product = await db.products.find_one({"codigo_barras": codigo})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado para ese código de barras")
    categoria_nombre = None
    if product.get("categoria_id"):
        cat = await db.categories.find_one({"_id": parse_object_id(product["categoria_id"])})
        if cat:
            categoria_nombre = cat["nombre"]
    return ProductResponse(
        id=str(product["_id"]), nombre=product["nombre"], precio_unitario=product["precio_unitario"],
        unidad_medida=product["unidad_medida"], cantidad_stock=product["cantidad_stock"],
        cantidad_minima=product["cantidad_minima"],
        fecha_creacion=product.get("fecha_creacion", datetime.now(timezone.utc)),
        stock_status=get_stock_status(product["cantidad_stock"], product["cantidad_minima"]),
        categoria_id=product.get("categoria_id"), categoria_nombre=categoria_nombre,
        codigo_barras=product.get("codigo_barras")
    )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str, user: dict = Depends(require_seller_or_admin)):
    product = await db.products.find_one({"_id": parse_object_id(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    categoria_nombre = None
    if product.get("categoria_id"):
        cat = await db.categories.find_one({"_id": parse_object_id(product["categoria_id"])})
        if cat:
            categoria_nombre = cat["nombre"]

    return ProductResponse(
        id=str(product["_id"]),
        nombre=product["nombre"],
        precio_unitario=product["precio_unitario"],
        unidad_medida=product["unidad_medida"],
        cantidad_stock=product["cantidad_stock"],
        cantidad_minima=product["cantidad_minima"],
        fecha_creacion=product.get("fecha_creacion", datetime.now(timezone.utc)),
        stock_status=get_stock_status(product["cantidad_stock"], product["cantidad_minima"]),
        categoria_id=product.get("categoria_id"),
        categoria_nombre=categoria_nombre,
        codigo_barras=product.get("codigo_barras")
    )


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, product: ProductUpdate, user: dict = Depends(require_admin)):
    oid = parse_object_id(product_id)
    existing = await db.products.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    # Check duplicate barcode (exclude current product)
    if product.codigo_barras:
        dup = await db.products.find_one({"codigo_barras": product.codigo_barras, "_id": {"$ne": oid}})
        if dup:
            raise HTTPException(status_code=400, detail="Ya existe un producto con ese código de barras")

    update_data = {k: v for k, v in product.model_dump().items() if v is not None}
    if "unidad_medida" in update_data:
        update_data["unidad_medida"] = update_data["unidad_medida"].value

    if "cantidad_stock" in update_data and update_data["cantidad_stock"] != existing["cantidad_stock"]:
        await db.stock_logs.insert_one({
            "producto_id": product_id,
            "cantidad_anterior": existing["cantidad_stock"],
            "cantidad_nueva": update_data["cantidad_stock"],
            "tipo": "actualizacion",
            "fecha": datetime.now(timezone.utc)
        })

    await db.products.update_one({"_id": oid}, {"$set": update_data})

    updated = await db.products.find_one({"_id": oid})

    categoria_nombre = None
    if updated.get("categoria_id"):
        cat = await db.categories.find_one({"_id": parse_object_id(updated["categoria_id"])})
        if cat:
            categoria_nombre = cat["nombre"]

    return ProductResponse(
        id=str(updated["_id"]),
        nombre=updated["nombre"],
        precio_unitario=updated["precio_unitario"],
        unidad_medida=updated["unidad_medida"],
        cantidad_stock=updated["cantidad_stock"],
        cantidad_minima=updated["cantidad_minima"],
        fecha_creacion=updated.get("fecha_creacion", datetime.now(timezone.utc)),
        stock_status=get_stock_status(updated["cantidad_stock"], updated["cantidad_minima"]),
        categoria_id=updated.get("categoria_id"),
        categoria_nombre=categoria_nombre,
        codigo_barras=updated.get("codigo_barras")
    )


@router.delete("/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(require_admin)):
    result = await db.products.delete_one({"_id": parse_object_id(product_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    return {"message": "Producto eliminado exitosamente"}
