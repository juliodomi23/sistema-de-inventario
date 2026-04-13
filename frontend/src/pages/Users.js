import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Trash2, Users as UsersIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

const initialFormState = {
  name: '',
  email: '',
  password: '',
  role: 'vendedor',
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data);
    } catch (error) {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value) => {
    setFormData((prev) => ({ ...prev, role: value }));
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('El nombre es requerido');
      return;
    }
    if (!formData.email.trim()) {
      setFormError('El correo es requerido');
      return;
    }
    if (formData.password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/admin/users', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      toast.success('Usuario creado exitosamente');
      fetchUsers();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      setFormError(error.response?.data?.detail || 'Error al crear usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/admin/users/${userToDelete.id}`);
      toast.success('Usuario eliminado');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar usuario');
    } finally {
      setIsDeleting(false);
      setUserToDelete(null);
    }
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-zinc-900 text-white',
      vendedor: 'bg-zinc-200 text-zinc-700',
    };
    const labels = {
      admin: 'Admin',
      vendedor: 'Vendedor',
    };
    return (
      <span className={`status-badge ${styles[role] || 'bg-zinc-100 text-zinc-600'}`}>
        {labels[role] || role}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Mexico_City',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading text-zinc-900">Usuarios</h1>
          <p className="text-zinc-500 text-sm mt-1">Gestiona los usuarios del sistema</p>
        </div>
        <Button className="btn-primary" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      <Card className="card-swiss">
        <CardContent className="p-0">
          {users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="table-header">Nombre</TableHead>
                  <TableHead className="table-header">Correo</TableHead>
                  <TableHead className="table-header">Rol</TableHead>
                  <TableHead className="table-header">Creado</TableHead>
                  <TableHead className="table-header text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-zinc-900">{row.name}</TableCell>
                    <TableCell className="text-zinc-600">{row.email}</TableCell>
                    <TableCell>{getRoleBadge(row.role)}</TableCell>
                    <TableCell className="text-sm text-zinc-500">{formatDate(row.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUserToDelete(row)}
                        disabled={currentUser?.id === row.id}
                        className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`Eliminar ${row.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="empty-state py-16">
              <UsersIcon className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium text-zinc-600">No hay usuarios</p>
              <p className="text-sm text-zinc-400 mt-1">Crea el primer usuario para comenzar</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="form-group">
              <Label htmlFor="name" className="form-label">Nombre *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Nombre completo"
                className="input-swiss"
              />
            </div>

            <div className="form-group">
              <Label htmlFor="email" className="form-label">Correo electrónico *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="correo@ejemplo.com"
                className="input-swiss"
              />
            </div>

            <div className="form-group">
              <Label htmlFor="password" className="form-label">Contraseña *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Mínimo 8 caracteres"
                className="input-swiss"
              />
            </div>

            <div className="form-group">
              <Label htmlFor="role" className="form-label">Rol *</Label>
              <Select value={formData.role} onValueChange={handleRoleChange}>
                <SelectTrigger className="input-swiss">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-sm">
                <AlertCircle className="h-4 w-4" />
                {formError}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-sm"
                onClick={() => { setIsDialogOpen(false); resetForm(); }}
              >
                Cancelar
              </Button>
              <Button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creando...' : 'Crear Usuario'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">¿Eliminar este usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente a <strong>{userToDelete?.name}</strong> ({userToDelete?.email}). Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
