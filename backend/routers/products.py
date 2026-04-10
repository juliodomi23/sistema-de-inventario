from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import List
from datetime import datetime, timezone
from pathlib import Path
import uuid

from database import db
from dependencies import require_admin, require_seller_or_admin, parse_object_id, get_stock_status
from models.product import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter(prefix="/api/products", tags=["products"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
UPLOADS_DIR = Path("uploads/products")


def _build_response(p: dict, cat_map: dict = None, categoria_nombre: str = None) -> ProductResponse:
    """Helper to build ProductResponse from a MongoDB document."""
    cat_name = categoria_nombre
    if cat_name is None and cat_map and p.get("categoria_id"):
        cat_name = cat_map.get(p["categoria_id"])
    return ProductResponse(
        id=str(p["_id"]),
        nombre=p["nombre"],
        precio_unitario=p["precio_unitario"],
        costo=p.get("costo"),
        unidad_medida=p["unidad_medida"],
        cantidad_stock=p["cantidad_stock"],
        cantidad_minima=p["cantidad_minima"],
        fecha_creacion=p.get("fecha_creacion", datetime.now(timezone.utc)),
        stock_status=get_stock_status(p["cantidad_stock"], p["cantidad_minima"]),
        categoria_id=p.get("categoria_id"),
        categoria_nombre=cat_name,
        codigo_barras=p.get("codigo_barras"),
        imagen_url=p.get("imagen_url"),
    )


@router.post("", response_model=ProductResponse)
async def create_product(product: ProductCreate, user: dict = Depends(require_admin)):
    if product.codigo_barras:
        existing_barcode = await db.products.find_one({"codigo_barras": product.codigo_barras})
        if existing_barcode:
            raise HTTPException(status_code=400, detail="Ya existe un producto con ese código de barras")

    product_doc = {
        "nombre": product.nombre,
        "precio_unitario": product.precio_unitario,
        "costo": product.costo,
        "unidad_medida": product.unidad_medida.value,
        "cantidad_stock": product.cantidad_stock,
        "cantidad_minima": product.cantidad_minima,
        "categoria_id": product.categoria_id,
        "codigo_barras": product.codigo_barras,
        "imagen_url": None,
        "fecha_creacion": datetime.now(timezone.utc),
    }
    result = await db.products.insert_one(product_doc)

    categoria_nombre = None
    if product.categoria_id:
        cat = await db.categories.find_one({"_id": parse_object_id(product.categoria_id)})
        if cat:
            categoria_nombre = cat["nombre"]

    await db.stock_logs.insert_one({
        "producto_id": str(result.inserted_id),
        "cantidad_anterior": 0,
        "cantidad_nueva": product.cantidad_stock,
        "tipo": "creacion",
        "fecha": datetime.now(timezone.utc),
    })

    product_doc["_id"] = result.inserted_id
    return _build_response(product_doc, categoria_nombre=categoria_nombre)


@router.get("", response_model=List[ProductResponse])
async def list_products(user: dict = Depends(require_seller_or_admin)):
    products = await db.products.find({}).to_list(1000)

    cat_ids = list({p["categoria_id"] for p in products if p.get("categoria_id")})
    cat_map = {}
    if cat_ids:
        cats = await db.categories.find({"_id": {"$in": [parse_object_id(cid) for cid in cat_ids]}}).to_list(500)
        cat_map = {str(c["_id"]): c["nombre"] for c in cats}

    return [_build_response(p, cat_map=cat_map) for p in products]


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
    return _build_response(product, categoria_nombre=categoria_nombre)


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
    return _build_response(product, categoria_nombre=categoria_nombre)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, product: ProductUpdate, user: dict = Depends(require_admin)):
    oid = parse_object_id(product_id)
    existing = await db.products.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

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
            "fecha": datetime.now(timezone.utc),
        })

    await db.products.update_one({"_id": oid}, {"$set": update_data})
    updated = await db.products.find_one({"_id": oid})

    categoria_nombre = None
    if updated.get("categoria_id"):
        cat = await db.categories.find_one({"_id": parse_object_id(updated["categoria_id"])})
        if cat:
            categoria_nombre = cat["nombre"]

    return _build_response(updated, categoria_nombre=categoria_nombre)


@router.post("/{product_id}/image")
async def upload_product_image(
    product_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes JPG, PNG o WebP")

    oid = parse_object_id(product_id)
    existing = await db.products.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    # Delete old image file if exists
    if existing.get("imagen_url"):
        old_file = Path("." + existing["imagen_url"])
        if old_file.exists():
            old_file.unlink()

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    ext = (file.filename or "image.jpg").rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp"}:
        ext = "jpg"
    filename = f"{product_id}_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = UPLOADS_DIR / filename

    content = await file.read()
    file_path.write_bytes(content)

    imagen_url = f"/uploads/products/{filename}"
    await db.products.update_one({"_id": oid}, {"$set": {"imagen_url": imagen_url}})

    return {"imagen_url": imagen_url}


@router.delete("/{product_id}/image")
async def delete_product_image(product_id: str, user: dict = Depends(require_admin)):
    oid = parse_object_id(product_id)
    existing = await db.products.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if existing.get("imagen_url"):
        old_file = Path("." + existing["imagen_url"])
        if old_file.exists():
            old_file.unlink()

    await db.products.update_one({"_id": oid}, {"$set": {"imagen_url": None}})
    return {"message": "Imagen eliminada"}


@router.delete("/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(require_admin)):
    existing = await db.products.find_one({"_id": parse_object_id(product_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    # Clean up image file
    if existing.get("imagen_url"):
        old_file = Path("." + existing["imagen_url"])
        if old_file.exists():
            old_file.unlink()

    result = await db.products.delete_one({"_id": parse_object_id(product_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    return {"message": "Producto eliminado exitosamente"}
