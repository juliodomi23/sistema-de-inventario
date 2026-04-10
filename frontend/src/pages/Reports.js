import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { FileText, Download, TrendingUp, ShoppingBag, CreditCard, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

const formatCurrencyTooltip = (amount) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(amount);

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-zinc-200 rounded-sm shadow-lg">
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        <p className="text-sm text-emerald-600">{formatCurrencyTooltip(payload[0].value)}</p>
        {payload[0].payload.count && (
          <p className="text-xs text-zinc-500">{payload[0].payload.count} ventas</p>
        )}
      </div>
    );
  }
  return null;
}

export default function Reports() {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('7');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchStatistics();
  }, [days]);

  const fetchStatistics = async () => {
    try {
      const response = await api.get(`/api/reports/statistics?days=${days}`);
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (statusFilter !== 'todas') params.append('status', statusFilter);

      const response = await api.get(
        `/api/reports/sales/export/${format}?${params.toString()}`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ventas_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Reporte ${format.toUpperCase()} descargado`);
    } catch (error) {
      toast.error(`Error al exportar ${format.toUpperCase()}`);
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="reports-loading">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  const totalVentas = statistics?.daily_sales.reduce((sum, d) => sum + d.total, 0) || 0;
  const totalTransacciones = statistics?.daily_sales.reduce((sum, d) => sum + d.count, 0) || 0;

  return (
    <div className="space-y-6" data-testid="reports-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading text-zinc-900">Reportes y Estadísticas</h1>
          <p className="text-zinc-500 text-sm mt-1">Analiza el rendimiento de tu negocio</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[140px] input-swiss" data-testid="days-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="14">Últimos 14 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-swiss">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-zinc-900" data-testid="total-revenue">
                  {formatCurrency(totalVentas)}
                </p>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Ingresos Totales</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-swiss">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-zinc-900">{totalTransacciones}</p>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Transacciones</p>
              </div>
              <ShoppingBag className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-swiss">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-zinc-900">
                  {totalTransacciones > 0 ? formatCurrency(totalVentas / totalTransacciones) : '$0'}
                </p>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Ticket Promedio</p>
              </div>
              <CreditCard className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Chart */}
        <Card className="card-swiss">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Ventas Diarias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]" data-testid="daily-sales-chart">
              {statistics?.daily_sales && statistics.daily_sales.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statistics.daily_sales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#71717a" />
                    <YAxis tickFormatter={(v) => `$${v/1000}k`} tick={{ fontSize: 12 }} stroke="#71717a" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-400">
                  No hay datos para mostrar
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods Chart */}
        <Card className="card-swiss">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Métodos de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]" data-testid="payment-methods-chart">
              {statistics?.payment_breakdown && statistics.payment_breakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statistics.payment_breakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="total"
                      nameKey="method"
                      label={({ method, percent }) => `${method} ${(percent * 100).toFixed(0)}%`}
                    >
                      {statistics.payment_breakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-400">
                  No hay datos para mostrar
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products and Export */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card className="card-swiss">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Productos Más Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {statistics?.top_products && statistics.top_products.length > 0 ? (
              <div className="space-y-4" data-testid="top-products-list">
                {statistics.top_products.map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-medium text-zinc-600">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{product.name}</p>
                        <p className="text-xs text-zinc-500">{product.cantidad} unidades vendidas</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-emerald-600">{formatCurrency(product.ingresos)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-zinc-400">
                No hay productos vendidos en este período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card className="card-swiss">
          <CardHeader>
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Exportar Reportes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <Label className="form-label">Fecha Inicio</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-swiss"
                  data-testid="export-start-date"
                />
              </div>
              <div className="form-group">
                <Label className="form-label">Fecha Fin</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-swiss"
                  data-testid="export-end-date"
                />
              </div>
            </div>

            <div className="form-group">
              <Label className="form-label">Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="input-swiss" data-testid="export-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las ventas</SelectItem>
                  <SelectItem value="completada">Solo completadas</SelectItem>
                  <SelectItem value="anulada">Solo anuladas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => exportReport('csv')}
                disabled={exporting}
                variant="outline"
                className="flex-1 rounded-sm"
                data-testid="export-csv-button"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                onClick={() => exportReport('pdf')}
                disabled={exporting}
                className="flex-1 btn-primary"
                data-testid="export-pdf-button"
              >
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>

            <p className="text-xs text-zinc-500 text-center">
              {!startDate && !endDate ? 'Se exportarán todas las ventas' : 'Se aplicarán los filtros seleccionados'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Line Chart */}
      <Card className="card-swiss">
        <CardHeader>
          <CardTitle className="text-lg font-heading">Tendencia de Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]" data-testid="trend-chart">
            {statistics?.daily_sales && statistics.daily_sales.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={statistics.daily_sales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#71717a" />
                  <YAxis tickFormatter={(v) => `$${v/1000}k`} tick={{ fontSize: 12 }} stroke="#71717a" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    dot={{ fill: '#10B981', r: 4 }}
                    name="Ventas (MXN)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-400">
                No hay datos para mostrar
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
