import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Textarea } from '../components/ui/textarea';
import { Wallet, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '../utils/format';

export default function CashRegister() {
  const [currentRegister, setCurrentRegister] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulario abrir turno
  const [montoInicial, setMontoInicial] = useState('');
  const [notasApertura, setNotasApertura] = useState('');

  // Dialog cerrar turno
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [montoCierre, setMontoCierre] = useState('');
  const [notasCierre, setNotasCierre] = useState('');
  const [closeError, setCloseError] = useState('');

  useEffect(() => {
    fetchCurrentRegister();
    fetchHistory();
  }, []);

  const fetchCurrentRegister = async () => {
    try {
      const response = await api.get('/api/cash-register/current');
      setCurrentRegister(response.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setCurrentRegister(null);
      } else {
        toast.error('Error al cargar estado de caja');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await api.get('/api/cash-register');
      setHistory(response.data);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const handleOpenRegister = async (e) => {
    e.preventDefault();
    setError('');

    const monto = parseFloat(montoInicial);
    if (isNaN(monto) || monto < 0) {
      setError('El monto inicial debe ser un número válido');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/cash-register/open', {
        monto_inicial: monto,
        notas: notasApertura.trim() || null,
      });
      toast.success('Turno abierto correctamente');
      setMontoInicial('');
      setNotasApertura('');
      fetchCurrentRegister();
      fetchHistory();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al abrir turno');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseRegister = async () => {
    setCloseError('');

    const monto = parseFloat(montoCierre);
    if (isNaN(monto) || monto < 0) {
      setCloseError('El monto contado debe ser un número válido');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/cash-register/close', {
        monto_contado: monto,
        notas: notasCierre.trim() || null,
      });
      toast.success('Turno cerrado correctamente');
      setShowCloseDialog(false);
      setMontoCierre('');
      setNotasCierre('');
      fetchCurrentRegister();
      fetchHistory();
    } catch (err) {
      setCloseError(err.response?.data?.detail || 'Error al cerrar turno');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDiferenciaStyle = (diferencia) => {
    if (diferencia > 0) return 'text-emerald-600 font-medium';
    if (diferencia < 0) return 'text-rose-600 font-medium';
    return 'text-zinc-600';
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
      <div>
        <h1 className="text-2xl font-heading text-zinc-900">Corte de Caja</h1>
        <p className="text-zinc-500 text-sm mt-1">Gestiona los turnos y cortes de caja</p>
      </div>

      {/* Estado actual */}
      {currentRegister ? (
        <Card className="card-swiss">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Turno Actual
            </CardTitle>
            <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">ABIERTO</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-xs text-zinc-500">Monto inicial</p>
                <p className="text-lg font-bold text-zinc-900">{formatCurrency(currentRegister.monto_inicial)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Ventas en efectivo</p>
                <p className="text-lg font-bold text-zinc-900">{formatCurrency(currentRegister.ventas_efectivo || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Monto esperado</p>
                <p className="text-lg font-bold text-zinc-900">
                  {formatCurrency((currentRegister.monto_inicial || 0) + (currentRegister.ventas_efectivo || 0))}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Apertura</p>
                <p className="text-sm text-zinc-700">{formatDate(currentRegister.fecha_apertura)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Usuario</p>
                <p className="text-sm text-zinc-700">{currentRegister.usuario_nombre || '—'}</p>
              </div>
            </div>
            <Button
              onClick={() => setShowCloseDialog(true)}
              variant="outline"
              className="border-rose-200 text-rose-600 hover:bg-rose-50"
            >
              Cerrar Turno
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="card-swiss">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Abrir Turno
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleOpenRegister} className="space-y-4 max-w-sm">
              <div className="form-group">
                <Label htmlFor="montoInicial" className="form-label">Monto inicial en caja *</Label>
                <Input
                  id="montoInicial"
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  placeholder="0.00"
                  className="input-swiss"
                />
              </div>

              <div className="form-group">
                <Label htmlFor="notasApertura" className="form-label">Notas</Label>
                <Textarea
                  id="notasApertura"
                  value={notasApertura}
                  onChange={(e) => setNotasApertura(e.target.value)}
                  placeholder="Notas opcionales"
                  className="input-swiss resize-none"
                  rows={2}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Abriendo...' : 'Abrir Turno'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Historial */}
      <Card className="card-swiss">
        <CardHeader>
          <CardTitle className="font-heading text-base">Historial de cortes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="table-header">Apertura</TableHead>
                    <TableHead className="table-header">Cierre</TableHead>
                    <TableHead className="table-header">M. inicial</TableHead>
                    <TableHead className="table-header">Ventas ef.</TableHead>
                    <TableHead className="table-header">M. esperado</TableHead>
                    <TableHead className="table-header">M. contado</TableHead>
                    <TableHead className="table-header">Diferencia</TableHead>
                    <TableHead className="table-header">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => {
                    const montoEsperado = (item.monto_inicial || 0) + (item.ventas_efectivo || 0);
                    const diferencia = item.monto_contado != null
                      ? item.monto_contado - montoEsperado
                      : null;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm text-zinc-600">{formatDate(item.fecha_apertura)}</TableCell>
                        <TableCell className="text-sm text-zinc-600">
                          {item.fecha_cierre ? formatDate(item.fecha_cierre) : <span className="text-zinc-300">—</span>}
                        </TableCell>
                        <TableCell>{formatCurrency(item.monto_inicial)}</TableCell>
                        <TableCell>{formatCurrency(item.ventas_efectivo || 0)}</TableCell>
                        <TableCell>{formatCurrency(montoEsperado)}</TableCell>
                        <TableCell>
                          {item.monto_contado != null
                            ? formatCurrency(item.monto_contado)
                            : <span className="text-zinc-300">—</span>}
                        </TableCell>
                        <TableCell>
                          {diferencia != null ? (
                            <span className={getDiferenciaStyle(diferencia)}>
                              {diferencia >= 0 ? '+' : ''}{formatCurrency(diferencia)}
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={item.estado === 'abierto'
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                              : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'}
                          >
                            {item.estado === 'abierto' ? 'ABIERTO' : 'CERRADO'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="empty-state py-16">
              <Wallet className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium text-zinc-600">Sin historial de cortes</p>
              <p className="text-sm text-zinc-400 mt-1">Los cortes de caja aparecerán aquí</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog cerrar turno */}
      <Dialog open={showCloseDialog} onOpenChange={(open) => { setShowCloseDialog(open); if (!open) { setMontoCierre(''); setNotasCierre(''); setCloseError(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Cerrar Turno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {currentRegister && (
              <div className="p-3 bg-zinc-50 rounded-sm text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Monto esperado:</span>
                  <span className="font-medium">
                    {formatCurrency((currentRegister.monto_inicial || 0) + (currentRegister.ventas_efectivo || 0))}
                  </span>
                </div>
              </div>
            )}

            <div className="form-group">
              <Label htmlFor="montoCierre" className="form-label">Monto contado *</Label>
              <Input
                id="montoCierre"
                type="number"
                step="0.01"
                min="0"
                value={montoCierre}
                onChange={(e) => setMontoCierre(e.target.value)}
                placeholder="0.00"
                className="input-swiss"
                autoFocus
              />
              {montoCierre && currentRegister && (
                <p className="text-xs mt-1">
                  {(() => {
                    const esperado = (currentRegister.monto_inicial || 0) + (currentRegister.ventas_efectivo || 0);
                    const contado = parseFloat(montoCierre) || 0;
                    const diff = contado - esperado;
                    return (
                      <span className={diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        Diferencia: {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                      </span>
                    );
                  })()}
                </p>
              )}
            </div>

            <div className="form-group">
              <Label htmlFor="notasCierre" className="form-label">Notas</Label>
              <Textarea
                id="notasCierre"
                value={notasCierre}
                onChange={(e) => setNotasCierre(e.target.value)}
                placeholder="Notas opcionales"
                className="input-swiss resize-none"
                rows={2}
              />
            </div>

            {closeError && (
              <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-sm">
                <AlertCircle className="h-4 w-4" />
                {closeError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCloseDialog(false)}
                className="rounded-sm"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCloseRegister}
                disabled={isSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-sm"
              >
                {isSubmitting ? 'Cerrando...' : 'Confirmar cierre'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
