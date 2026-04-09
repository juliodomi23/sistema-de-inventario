from enum import Enum


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
    FIADO = "fiado"
