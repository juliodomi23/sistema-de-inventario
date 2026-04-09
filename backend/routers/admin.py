from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

from database import db
from dependencies import hash_password, require_admin, parse_object_id
from models.user import AdminUserCreate

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
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


@router.post("/users", status_code=201)
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


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    oid = parse_object_id(user_id)
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
    result = await db.users.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": "Usuario eliminado"}


@router.put("/users/{user_id}/password")
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
