from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import secrets
import csv
import io
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta, date
from enum import Enum
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
    GRAMOS = "gramos"
    BOLSAS = "bolsas"

class PaymentMethod(str, Enum):
    EFECTIVO = "efectivo"
    TRANSFERENCIA = "transferencia"
    TARJETA = "tarjeta"

# Auth Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    name: str = Field(min_length=1, max_length=100)

class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    role: str = Field(default="vendedor")

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
    nombre: str = Field(min_length=1, max_length=200)
    precio_unitario: float = Field(gt=0)
    unidad_medida: UnitType
    cantidad_stock: float = Field(ge=0)
    cantidad_minima: float = Field(ge=0)

class ProductUpdate(BaseModel):
    nombre: Optional[str] = None
    precio_unitario: Optional[float] = Field(default=None, gt=0)
    unidad_medida: Optional[UnitType] = None
    cantidad_stock: Optional[float] = Field(default=None, ge=0)
    cantidad_minima: Optional[float] = Field(default=None, ge=0)

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
    estado: str = "completada"

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

IS_PRODUCTION = os.environ.get("ENVIRONMENT", "development") == "production"

from bson.errors import InvalidId
def parse_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except InvalidId:
        raise HTTPException(status_code=400, detail=f"ID inválido: {id_str}")

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Se requiere rol de administrador")
    return user

async def require_seller_or_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user["role"] not in ("admin", "vendedor"):
        raise HTTPException(status_code=403, detail="Acceso no autorizado")
    return user

# ==================== AUTH ENDPOINTS ====================

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
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=IS_PRODUCTION, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=IS_PRODUCTION, samesite="lax", max_age=604800, path="/")

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
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=IS_PRODUCTION, samesite="lax", max_age=3600, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ==================== ADMIN USER ENDPOINTS ====================

@api_router.get("/admin/users")
async def list_users(user: dict = Depends(require_admin)):
    users = await db.users.find({}, {"password_hash": 0}).sort("created_at", -1).to_list(500)
    return [
        {
            "id": str(u["_id"]),
            "email": u["email"],
            "name": u["name"],
            "role": u.get("role", "vendedor"),
            "created_at": u.get("created_at", datetime.now(timezone.utc)).isoformat()
        }
        for u in users
    ]

@api_router.post("/admin/users", status_code=201)
async def create_user(user_data: AdminUserCreate, current_user: dict = Depends(require_admin)):
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    if user_data.role not in ("admin", "vendedor"):
        raise HTTPException(status_code=400, detail="Rol inválido. Use 'admin' o 'vendedor'")

    user_doc = {
        "email": email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    return {
        "id": str(result.inserted_id),
        "email": email,
        "name": user_data.name,
        "role": user_data.role,
        "created_at": user_doc["created_at"].isoformat()
    }

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    oid = parse_object_id(user_id)
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
    result = await db.users.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": "Usuario eliminado"}

@api_router.put("/admin/users/{user_id}/password")
async def update_user_password(user_id: str, data: dict, current_user: dict = Depends(require_admin)):
    oid = parse_object_id(user_id)
    new_password = data.get("password", "")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    await db.users.update_one(
        {"_id": oid},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    return {"message": "Contraseña actualizada"}

# ==================== PRODUCT ENDPOINTS ====================

@api_router.post("/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, user: dict = Depends(require_admin)):
    
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
async def list_products(user: dict = Depends(require_admin)):
    
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
async def get_product(product_id: str, user: dict = Depends(require_admin)):
    product = await db.products.find_one({"_id": parse_object_id(product_id)})
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
async def update_product(product_id: str, product: ProductUpdate, user: dict = Depends(require_admin)):
    oid = parse_object_id(product_id)
    existing = await db.products.find_one({"_id": oid})
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

    await db.products.update_one({"_id": oid}, {"$set": update_data})

    updated = await db.products.find_one({"_id": oid})
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
async def delete_product(product_id: str, user: dict = Depends(require_admin)):
    result = await db.products.delete_one({"_id": parse_object_id(product_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    return {"message": "Producto eliminado exitosamente"}

# ==================== SALES ENDPOINTS ====================

@api_router.post("/sales", response_model=SaleResponse)
async def create_sale(sale: SaleCreate, user: dict = Depends(require_seller_or_admin)):
    items_response = []
    monto_total = 0
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
            "nombre": product["nombre"],
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
    
    return SaleResponse(
        id=str(result.inserted_id),
        fecha_venta=sale_doc["fecha_venta"],
        metodo_pago=sale_doc["metodo_pago"],
        monto_total=sale_doc["monto_total"],
        cambio=sale_doc["cambio"],
        items=items_response,
        estado="completada"
    )

@api_router.get("/sales", response_model=List[SaleResponse])
async def list_sales(limit: int = 50, user: dict = Depends(require_admin)):
    
    sales = await db.sales.find({}).sort("fecha_venta", -1).limit(limit).to_list(limit)
    return [
        SaleResponse(
            id=str(s["_id"]),
            fecha_venta=s["fecha_venta"],
            metodo_pago=s["metodo_pago"],
            monto_total=s["monto_total"],
            cambio=s.get("cambio"),
            items=[SaleItemResponse(**item) for item in s.get("items", [])],
            estado=s.get("estado", "completada")
        )
        for s in sales
    ]

@api_router.post("/sales/{sale_id}/cancel")
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

# ==================== REPORTS ENDPOINTS ====================

@api_router.get("/reports/sales")
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

@api_router.get("/reports/sales/export/csv")
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

@api_router.get("/reports/sales/export/pdf")
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

@api_router.get("/reports/statistics")
async def get_statistics(
    days: int = Query(7, description="Número de días para estadísticas"),
    user: dict = Depends(require_admin)
):
    """Obtiene estadísticas de ventas para gráficas"""
    
    end_date = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59)
    start_date = (end_date - timedelta(days=days-1)).replace(hour=0, minute=0, second=0)
    
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

@api_router.get("/sales/today-summary")
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

@api_router.get("/dashboard/summary")
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

# ==================== ROOT ENDPOINT ====================

@api_router.get("/health")
async def health_check():
    try:
        await db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

@api_router.get("/")
async def root():
    return {"message": "Sistema de Inventario MVP API"}

# Include the router in the main app
app.include_router(api_router)

# CORS Configuration
origins_str = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [o.strip() for o in origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Cookie"],
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
    client.close()
