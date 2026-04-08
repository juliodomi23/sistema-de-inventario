from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import secrets
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from enum import Enum

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="Sistema de Inventario MVP")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class UnitType(str, Enum):
    KG = "kg"
    L = "L"
    PIEZAS = "piezas"
    METROS = "metros"
    CAJAS = "cajas"

class PaymentMethod(str, Enum):
    EFECTIVO = "efectivo"
    TRANSFERENCIA = "transferencia"
    TARJETA = "tarjeta"

# Auth Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: datetime

# Product Models
class ProductCreate(BaseModel):
    nombre: str
    precio_unitario: float
    unidad_medida: UnitType
    cantidad_stock: float
    cantidad_minima: float

class ProductUpdate(BaseModel):
    nombre: Optional[str] = None
    precio_unitario: Optional[float] = None
    unidad_medida: Optional[UnitType] = None
    cantidad_stock: Optional[float] = None
    cantidad_minima: Optional[float] = None

class ProductResponse(BaseModel):
    id: str
    nombre: str
    precio_unitario: float
    unidad_medida: str
    cantidad_stock: float
    cantidad_minima: float
    fecha_creacion: datetime
    stock_status: str

# Sale Models
class SaleItemCreate(BaseModel):
    producto_id: str
    cantidad: float

class SaleCreate(BaseModel):
    items: List[SaleItemCreate]
    metodo_pago: PaymentMethod
    monto_recibido: Optional[float] = None

class SaleItemResponse(BaseModel):
    producto_id: str
    producto_nombre: str
    cantidad_vendida: float
    precio_unitario: float
    subtotal: float

class SaleResponse(BaseModel):
    id: str
    fecha_venta: datetime
    metodo_pago: str
    monto_total: float
    cambio: Optional[float]
    items: List[SaleItemResponse]

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def get_jwt_secret() -> str:
    return JWT_SECRET

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipo de token inválido")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "user"),
            "created_at": user.get("created_at", datetime.now(timezone.utc))
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

def get_stock_status(cantidad_stock: float, cantidad_minima: float) -> str:
    if cantidad_stock <= cantidad_minima:
        return "red"
    elif cantidad_stock <= cantidad_minima + 2:
        return "yellow"
    else:
        return "green"

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate, response: Response):
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    hashed = hash_password(user_data.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": user_data.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return UserResponse(
        id=user_id,
        email=email,
        name=user_data.name,
        role="user",
        created_at=user_doc["created_at"]
    )

@api_router.post("/auth/login", response_model=UserResponse)
async def login(credentials: UserLogin, request: Request, response: Response):
    email = credentials.email.lower()
    identifier = f"{request.client.host}:{email}"
    
    # Check brute force
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("failed_attempts", 0) >= 5:
        lockout_until = attempt.get("lockout_until")
        if lockout_until and datetime.now(timezone.utc) < lockout_until:
            raise HTTPException(status_code=429, detail="Demasiados intentos. Intente más tarde.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})
    
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        # Increment failed attempts
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {
                "$inc": {"failed_attempts": 1},
                "$set": {"lockout_until": datetime.now(timezone.utc) + timedelta(minutes=15)}
            },
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    # Clear failed attempts on success
    await db.login_attempts.delete_one({"identifier": identifier})
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return UserResponse(
        id=user_id,
        email=user["email"],
        name=user["name"],
        role=user.get("role", "user"),
        created_at=user.get("created_at", datetime.now(timezone.utc))
    )

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "Sesión cerrada exitosamente"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(request: Request):
    user = await get_current_user(request)
    return UserResponse(**user)

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ==================== PRODUCT ENDPOINTS ====================

@api_router.post("/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, request: Request):
    await get_current_user(request)
    
    product_doc = {
        "nombre": product.nombre,
        "precio_unitario": product.precio_unitario,
        "unidad_medida": product.unidad_medida.value,
        "cantidad_stock": product.cantidad_stock,
        "cantidad_minima": product.cantidad_minima,
        "fecha_creacion": datetime.now(timezone.utc)
    }
    result = await db.products.insert_one(product_doc)
    
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
        stock_status=get_stock_status(product.cantidad_stock, product.cantidad_minima)
    )

@api_router.get("/products", response_model=List[ProductResponse])
async def list_products(request: Request):
    await get_current_user(request)
    
    products = await db.products.find({}).to_list(1000)
    return [
        ProductResponse(
            id=str(p["_id"]),
            nombre=p["nombre"],
            precio_unitario=p["precio_unitario"],
            unidad_medida=p["unidad_medida"],
            cantidad_stock=p["cantidad_stock"],
            cantidad_minima=p["cantidad_minima"],
            fecha_creacion=p.get("fecha_creacion", datetime.now(timezone.utc)),
            stock_status=get_stock_status(p["cantidad_stock"], p["cantidad_minima"])
        )
        for p in products
    ]

@api_router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str, request: Request):
    await get_current_user(request)
    
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    return ProductResponse(
        id=str(product["_id"]),
        nombre=product["nombre"],
        precio_unitario=product["precio_unitario"],
        unidad_medida=product["unidad_medida"],
        cantidad_stock=product["cantidad_stock"],
        cantidad_minima=product["cantidad_minima"],
        fecha_creacion=product.get("fecha_creacion", datetime.now(timezone.utc)),
        stock_status=get_stock_status(product["cantidad_stock"], product["cantidad_minima"])
    )

@api_router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, product: ProductUpdate, request: Request):
    await get_current_user(request)
    
    existing = await db.products.find_one({"_id": ObjectId(product_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
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
    
    await db.products.update_one({"_id": ObjectId(product_id)}, {"$set": update_data})
    
    updated = await db.products.find_one({"_id": ObjectId(product_id)})
    return ProductResponse(
        id=str(updated["_id"]),
        nombre=updated["nombre"],
        precio_unitario=updated["precio_unitario"],
        unidad_medida=updated["unidad_medida"],
        cantidad_stock=updated["cantidad_stock"],
        cantidad_minima=updated["cantidad_minima"],
        fecha_creacion=updated.get("fecha_creacion", datetime.now(timezone.utc)),
        stock_status=get_stock_status(updated["cantidad_stock"], updated["cantidad_minima"])
    )

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, request: Request):
    await get_current_user(request)
    
    result = await db.products.delete_one({"_id": ObjectId(product_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    return {"message": "Producto eliminado exitosamente"}

# ==================== SALES ENDPOINTS ====================

@api_router.post("/sales", response_model=SaleResponse)
async def create_sale(sale: SaleCreate, request: Request):
    await get_current_user(request)
    
    items_response = []
    monto_total = 0
    stock_updates = []
    
    # Validate all items first
    for item in sale.items:
        product = await db.products.find_one({"_id": ObjectId(item.producto_id)})
        if not product:
            raise HTTPException(status_code=404, detail=f"Producto {item.producto_id} no encontrado")
        if product["cantidad_stock"] < item.cantidad:
            raise HTTPException(
                status_code=400, 
                detail=f"Stock insuficiente para {product['nombre']}. Disponible: {product['cantidad_stock']}"
            )
        
        subtotal = product["precio_unitario"] * item.cantidad
        monto_total += subtotal
        
        items_response.append(SaleItemResponse(
            producto_id=item.producto_id,
            producto_nombre=product["nombre"],
            cantidad_vendida=item.cantidad,
            precio_unitario=product["precio_unitario"],
            subtotal=subtotal
        ))
        
        stock_updates.append({
            "producto_id": item.producto_id,
            "cantidad": item.cantidad,
            "stock_anterior": product["cantidad_stock"]
        })
    
    # Validate cash payment
    cambio = None
    if sale.metodo_pago == PaymentMethod.EFECTIVO:
        if sale.monto_recibido is None:
            raise HTTPException(status_code=400, detail="Monto recibido es requerido para pago en efectivo")
        if sale.monto_recibido < monto_total:
            raise HTTPException(status_code=400, detail="El monto recibido es menor al total")
        cambio = round(sale.monto_recibido - monto_total, 2)
    
    # Create sale document
    sale_doc = {
        "fecha_venta": datetime.now(timezone.utc),
        "metodo_pago": sale.metodo_pago.value,
        "monto_total": round(monto_total, 2),
        "cambio": cambio,
        "monto_recibido": sale.monto_recibido,
        "items": [item.model_dump() for item in items_response],
        "estado": "completada"
    }
    result = await db.sales.insert_one(sale_doc)
    
    # Update stock for all products
    for update in stock_updates:
        new_stock = update["stock_anterior"] - update["cantidad"]
        await db.products.update_one(
            {"_id": ObjectId(update["producto_id"])},
            {"$set": {"cantidad_stock": new_stock}}
        )
        await db.stock_logs.insert_one({
            "producto_id": update["producto_id"],
            "cantidad_anterior": update["stock_anterior"],
            "cantidad_nueva": new_stock,
            "tipo": "venta",
            "venta_id": str(result.inserted_id),
            "fecha": datetime.now(timezone.utc)
        })
    
    return SaleResponse(
        id=str(result.inserted_id),
        fecha_venta=sale_doc["fecha_venta"],
        metodo_pago=sale_doc["metodo_pago"],
        monto_total=sale_doc["monto_total"],
        cambio=sale_doc["cambio"],
        items=items_response
    )

@api_router.get("/sales", response_model=List[SaleResponse])
async def list_sales(request: Request, limit: int = 50):
    await get_current_user(request)
    
    sales = await db.sales.find({}).sort("fecha_venta", -1).limit(limit).to_list(limit)
    return [
        SaleResponse(
            id=str(s["_id"]),
            fecha_venta=s["fecha_venta"],
            metodo_pago=s["metodo_pago"],
            monto_total=s["monto_total"],
            cambio=s.get("cambio"),
            items=[SaleItemResponse(**item) for item in s.get("items", [])]
        )
        for s in sales
    ]

@api_router.get("/sales/today-summary")
async def get_today_summary(request: Request):
    await get_current_user(request)
    
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

@api_router.get("/dashboard/summary")
async def get_dashboard_summary(request: Request):
    await get_current_user(request)
    
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

# ==================== ROOT ENDPOINT ====================

@api_router.get("/")
async def root():
    return {"message": "Sistema de Inventario MVP API"}

# Include the router in the main app
app.include_router(api_router)

# CORS Configuration
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[frontend_url, "http://localhost:3000", "https://stock-mvp-1.preview.emergentagent.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== STARTUP EVENTS ====================

@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.products.create_index("nombre")
    await db.sales.create_index("fecha_venta")
    
    # Seed admin user
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@inventario.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
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
    
    # Write test credentials
    memory_dir = Path("/app/memory")
    memory_dir.mkdir(exist_ok=True)
    with open(memory_dir / "test_credentials.md", "w") as f:
        f.write(f"""# Test Credentials

## Admin User
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh

## Product Endpoints
- GET /api/products
- POST /api/products
- GET /api/products/:id
- PUT /api/products/:id
- DELETE /api/products/:id

## Sales Endpoints
- GET /api/sales
- POST /api/sales
- GET /api/sales/today-summary
- GET /api/dashboard/summary
""")
    logger.info("Test credentials written to /app/memory/test_credentials.md")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
