from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from datetime import datetime, timezone

from database import db
from dependencies import hash_password, verify_password
from config import IS_PRODUCTION

from routers.auth import router as auth_router
from routers.admin import router as admin_router
from routers.products import router as products_router
from routers.sales import router as sales_router
from routers.categories import router as categories_router
from routers.stock_entries import router as stock_entries_router
from routers.cash_register import router as cash_register_router
from routers.customers import router as customers_router
from routers.reports import router as reports_router
from routers.dashboard import router as dashboard_router

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Sistema de Inventario MVP")

# Static files for product images
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include all routers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(products_router)
app.include_router(categories_router)
app.include_router(sales_router)
app.include_router(stock_entries_router)
app.include_router(cash_register_router)
app.include_router(customers_router)
app.include_router(reports_router)
app.include_router(dashboard_router)

# CORS
origins_str = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [o.strip() for o in origins_str.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Cookie"],
)


@app.get("/api/health")
async def health_check():
    try:
        await db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Database unavailable")


@app.get("/api/")
async def root():
    return {"message": "Sistema de Inventario MVP API"}


@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.products.create_index("nombre")
    await db.sales.create_index("fecha_venta")
    await db.categories.create_index("nombre")
    await db.products.create_index("codigo_barras", sparse=True)
    await db.stock_entries.create_index("producto_id")
    await db.stock_entries.create_index("fecha")
    await db.cash_registers.create_index("estado")
    await db.cash_registers.create_index("fecha_apertura")
    await db.customers.create_index("nombre")
    await db.customer_payments.create_index("cliente_id")
    # Compound index: covers dashboard + reports + historial queries (fecha_venta + estado)
    await db.sales.create_index([("fecha_venta", -1), ("estado", 1)])
    await db.sales.create_index("cliente_id")
    # TTL index: auto-delete expired login attempt records
    await db.login_attempts.create_index("lockout_until", expireAfterSeconds=0)

    # Seed admin user
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@inventario.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")

    if IS_PRODUCTION and (not admin_password or admin_password == "admin123"):
        raise RuntimeError("ADMIN_PASSWORD debe ser una contraseña segura en producción")

    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Administrador",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info(f"Admin password updated: {admin_email}")

    # Seed vendedor user
    vendedor_email = os.environ.get("VENDEDOR_EMAIL", "vendedor@inventario.com")
    vendedor_password = os.environ.get("VENDEDOR_PASSWORD", "vendedor123")

    existing_vendedor = await db.users.find_one({"email": vendedor_email})
    if existing_vendedor is None:
        hashed = hash_password(vendedor_password)
        await db.users.insert_one({
            "email": vendedor_email,
            "password_hash": hashed,
            "name": "Vendedor",
            "role": "vendedor",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Vendedor user created: {vendedor_email}")


@app.on_event("shutdown")
async def shutdown_db_client():
    from database import client
    client.close()
