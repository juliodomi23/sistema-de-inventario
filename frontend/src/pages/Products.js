import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Pencil, Trash2, Package, AlertCircle, ImagePlus, X, TrendingUp, Camera, Images } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const UNIT_OPTIONS = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'gramos', label: 'Gramos (g)' },
  { value: 'L', label: 'Litros (L)' },
  { value: 'piezas', label: 'Piezas' },
  { value: 'bolsas', label: 'Bolsas' },
  { value: 'cajas', label: 'Cajas' },
  { value: 'metros', label: 'Metros' },
];

const initialFormState = {
  nombre: '',
  precio_unitario: '',
  costo: '',
  unidad_medida: 'piezas',
  cantidad_stock: '',
  cantidad_minima: '',
  codigo_barras: '',
  categoria_id: '',
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

function getMargen(costo, precio) {
  if (!costo || !precio || precio <= 0) return null;
  return ((precio - costo) / precio) * 100;
}

function MargenBadge({ costo, precio }) {
  const margen = getMargen(costo, precio);
  if (margen === null) return <span className="text-zinc-400 text-xs">—</span>;
  const color = margen >= 30 ? 'text-emerald-600' : margen >= 15 ? 'text-amber-600' : 'text-rose-600';
  return (
    <span className={`text-xs font-medium ${color}`}>
      {margen.toFixed(1)}%
    </span>
  );
}

function StockBadge({ status }) {
  const styles = {
    green: 'bg-emerald-100 text-emerald-700',
    yellow: 'bg-amber-100 text-amber-700',
    red: 'bg-rose-100 text-rose-700',
  };
  const labels = { green: 'Óptimo', yellow: 'Medio', red: 'Bajo' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ProductImage({ url, nombre, size = 'sm' }) {
  const sizes = { sm: 'h-10 w-10', md: 'h-16 w-16', lg: 'h-24 w-24' };
  if (!url) {
    return (
      <div className={`${sizes[size]} bg-zinc-100 rounded-md flex items-center justify-center shrink-0`}>
        <Package className="h-4 w-4 text-zinc-400" />
      </div>
    );
  }
  return (
    <img
      src={`${API_URL}${url}`}
      alt={nombre}
      className={`${sizes[size]} rounded-md object-cover shrink-0`}
      onError={e => { e.target.style.display = 'none'; }}
    />
  );
}

function ImageUploadArea({ preview, onSelect, onRemove }) {
  const fileInputRef = useRef();
  const cameraInputRef = useRef();

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) onSelect(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-zinc-700">Foto del producto</Label>

      {preview ? (
        <div className="flex items-start gap-3">
          <div className="relative inline-block">
            <img
              src={preview}
              alt="preview"
              className="h-28 w-28 object-cover rounded-lg border border-zinc-200"
            />
            <button
              type="button"
              onClick={onRemove}
              className="absolute -top-2 -right-2 bg-zinc-900 text-white rounded-full p-0.5 hover:bg-zinc-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Botones para cambiar foto */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-900 px-2 py-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 transition-colors"
            >
              <Camera className="h-3.5 w-3.5" />
              Tomar foto
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-900 px-2 py-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 transition-colors"
            >
              <Images className="h-3.5 w-3.5" />
              Cambiar imagen
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Botones de selección */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1.5 py-4 border-2 border-dashed border-zinc-300 rounded-lg text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <Camera className="h-5 w-5" />
              <span className="text-xs font-medium">Tomar foto</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1.5 py-4 border-2 border-dashed border-zinc-300 rounded-lg text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <Images className="h-5 w-5" />
              <span className="text-xs font-medium">Galería / Archivo</span>
            </button>
          </div>
          <p className="text-xs text-zinc-400 text-center">JPG, PNG o WebP</p>
        </div>
      )}

      {/* Input para cámara (abre cámara trasera en móvil) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      {/* Input para galería / explorador de archivos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products');
      setProducts(response.data);
    } catch {
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/categories');
      setCategories(response.data);
    } catch {}
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageSelect = (file) => {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageRemove = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingId(null);
    setCurrentImageUrl(null);
    setImageFile(null);
    setImagePreview(null);
    setError('');
  };

  const openEditDialog = (product) => {
    setFormData({
      nombre: product.nombre,
      precio_unitario: product.precio_unitario.toString(),
      costo: product.costo != null ? product.costo.toString() : '',
      unidad_medida: product.unidad_medida,
      cantidad_stock: product.cantidad_stock.toString(),
      cantidad_minima: product.cantidad_minima.toString(),
      codigo_barras: product.codigo_barras || '',
      categoria_id: product.categoria_id || '',
    });
    setEditingId(product.id);
    setCurrentImageUrl(product.imagen_url || null);
    setImageFile(null);
    setImagePreview(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!formData.nombre.trim()) {
      setError('El nombre es requerido');
      setIsSubmitting(false);
      return;
    }

    const precio = parseFloat(formData.precio_unitario);
    const costo = formData.costo !== '' ? parseFloat(formData.costo) : null;
    const stock = parseFloat(formData.cantidad_stock);
    const minimo = parseFloat(formData.cantidad_minima);

    if (isNaN(precio) || precio <= 0) {
      setError('El precio debe ser mayor a 0');
      setIsSubmitting(false);
      return;
    }
    if (isNaN(stock) || stock < 0) {
      setError('La cantidad en stock no puede ser negativa');
      setIsSubmitting(false);
      return;
    }
    if (isNaN(minimo) || minimo < 0) {
      setError('La cantidad mínima no puede ser negativa');
      setIsSubmitting(false);
      return;
    }

    const payload = {
      nombre: formData.nombre,
      precio_unitario: precio,
      costo: costo,
      unidad_medida: formData.unidad_medida,
      cantidad_stock: stock,
      cantidad_minima: minimo,
      codigo_barras: formData.codigo_barras || null,
      categoria_id: formData.categoria_id || null,
    };

    try {
      let productId = editingId;
      if (editingId) {
        await api.put(`/api/products/${editingId}`, payload);
        toast.success('Producto actualizado');
      } else {
        const res = await api.post('/api/products', payload);
        productId = res.data.id;
        toast.success('Producto creado');
      }

      // Upload image if selected
      if (imageFile && productId) {
        const fd = new FormData();
        fd.append('file', imageFile);
        await api.post(`/api/products/${productId}/image`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      fetchProducts();
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      await api.delete(`/api/products/${productToDelete.id}`);
      toast.success('Producto eliminado');
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar producto');
    } finally {
      setProductToDelete(null);
    }
  };

  const margenLive = getMargen(
    formData.costo !== '' ? parseFloat(formData.costo) : null,
    parseFloat(formData.precio_unitario)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  const productForm = (
    <form onSubmit={handleSubmit} className="space-y-5 mt-2">
      {/* Imagen */}
      <ImageUploadArea
        preview={imagePreview || (currentImageUrl ? `${API_URL}${currentImageUrl}` : null)}
        onSelect={handleImageSelect}
        onRemove={handleImageRemove}
      />

      {/* Nombre */}
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre *</Label>
        <Input
          id="nombre"
          name="nombre"
          value={formData.nombre}
          onChange={handleInputChange}
          placeholder="Nombre del producto"
        />
      </div>

      {/* Costo y Precio */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="costo">Costo (MXN)</Label>
          <Input
            id="costo"
            name="costo"
            type="number"
            step="0.01"
            min="0"
            value={formData.costo}
            onChange={handleInputChange}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="precio_unitario">Precio venta (MXN) *</Label>
          <Input
            id="precio_unitario"
            name="precio_unitario"
            type="number"
            step="0.01"
            min="0"
            value={formData.precio_unitario}
            onChange={handleInputChange}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Margen en tiempo real */}
      {margenLive !== null && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md ${
          margenLive >= 30 ? 'bg-emerald-50 text-emerald-700' :
          margenLive >= 15 ? 'bg-amber-50 text-amber-700' :
          'bg-rose-50 text-rose-700'
        }`}>
          <TrendingUp className="h-4 w-4 shrink-0" />
          <span>Margen de ganancia: <strong>{margenLive.toFixed(1)}%</strong></span>
          {margenLive < 15 && <span className="ml-auto text-xs">⚠ Margen bajo</span>}
        </div>
      )}

      {/* Categoría y Unidad */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <Select
            value={formData.categoria_id || '_none'}
            onValueChange={v => setFormData(p => ({ ...p, categoria_id: v === '_none' ? '' : v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Sin categoría</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Unidad *</Label>
          <Select
            value={formData.unidad_medida}
            onValueChange={v => setFormData(p => ({ ...p, unidad_medida: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stock */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cantidad_stock">Stock actual *</Label>
          <Input
            id="cantidad_stock"
            name="cantidad_stock"
            type="number"
            step="0.01"
            min="0"
            value={formData.cantidad_stock}
            onChange={handleInputChange}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cantidad_minima">Stock mínimo *</Label>
          <Input
            id="cantidad_minima"
            name="cantidad_minima"
            type="number"
            step="0.01"
            min="0"
            value={formData.cantidad_minima}
            onChange={handleInputChange}
            placeholder="0"
          />
        </div>
      </div>

      {/* Código de barras */}
      <div className="space-y-1.5">
        <Label htmlFor="codigo_barras">Código de barras</Label>
        <Input
          id="codigo_barras"
          name="codigo_barras"
          value={formData.codigo_barras}
          onChange={handleInputChange}
          placeholder="Opcional"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancelar</Button>
        </DialogClose>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear producto')}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Productos</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Gestiona tu inventario</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={open => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="add-product-button">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Nuevo producto</span>
              <span className="sm:hidden">Nuevo</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
            </DialogHeader>
            {productForm}
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-zinc-300 mb-4" />
            <p className="text-zinc-600 font-medium">No hay productos</p>
            <p className="text-zinc-400 text-sm mt-1">Agrega tu primer producto para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: tarjetas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
            {products.map(product => (
              <Card key={product.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    <ProductImage url={product.imagen_url} nombre={product.nombre} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-medium text-zinc-900 text-sm leading-tight truncate">{product.nombre}</p>
                        <StockBadge status={product.stock_status} />
                      </div>
                      {product.categoria_nombre && (
                        <p className="text-xs text-zinc-400 mt-0.5">{product.categoria_nombre}</p>
                      )}
                      <div className="mt-2 space-y-0.5">
                        {product.costo != null && (
                          <p className="text-xs text-zinc-500">Costo: {formatCurrency(product.costo)}</p>
                        )}
                        <p className="text-sm font-semibold text-zinc-900">{formatCurrency(product.precio_unitario)}</p>
                        <div className="flex items-center gap-1">
                          <MargenBadge costo={product.costo} precio={product.precio_unitario} />
                          <span className="text-zinc-300 text-xs">·</span>
                          <span className="text-xs text-zinc-500">Stock: {product.cantidad_stock} {product.unidad_medida}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-1 mt-3 pt-3 border-t border-zinc-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(product)}
                      className="h-8 px-2 text-xs"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setProductToDelete(product)}
                      className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: tabla */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Margen</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map(product => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <ProductImage url={product.imagen_url} nombre={product.nombre} size="sm" />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-zinc-900">{product.nombre}</p>
                        <p className="text-xs text-zinc-400">{product.unidad_medida}
                          {product.codigo_barras && ` · ${product.codigo_barras}`}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-zinc-600">
                          {product.categoria_nombre || <span className="text-zinc-400">—</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        {product.costo != null
                          ? <span className="text-sm text-zinc-600">{formatCurrency(product.costo)}</span>
                          : <span className="text-zinc-400">—</span>
                        }
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{formatCurrency(product.precio_unitario)}</span>
                      </TableCell>
                      <TableCell>
                        <MargenBadge costo={product.costo} precio={product.precio_unitario} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{product.cantidad_stock}</span>
                        <span className="text-xs text-zinc-400"> / {product.cantidad_minima} mín</span>
                      </TableCell>
                      <TableCell>
                        <StockBadge status={product.stock_status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(product)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setProductToDelete(product)}
                            className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={!!productToDelete} onOpenChange={open => !open && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente <strong>{productToDelete?.nombre}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 text-white">
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
