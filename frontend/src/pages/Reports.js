import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { FileText, Download, TrendingUp, ShoppingBag, CreditCard, Info } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

const fmtCurrency = (v) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(v);

const fmtCurrencyFull = (v) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

function SalesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-3 border border-zinc-200 rounded-lg shadow-lg text-sm">
      <p className="font-medium text-zinc-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmtCurrency(p.value)}</p>
      ))}
    </div>
  );
}

function ProfitTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-3 border border-zinc-200 rounded-lg shadow-lg text-sm">
      <p className="font-medium text-zinc-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmtCurrency(p.value)}</p>
      ))}
    </div>
  );
}

const DAY_OPTIONS = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '14', label: 'Últimos 14 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
];

export default function Reports() {
  const [statistics, setStatistics] = useState(null);
  const [profitability, setProfitability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('7');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/api/reports/statistics?days=${days}`),
      api.get(`/api/reports/profitability?days=${days}`),
    ])
      .then(([statsRes, profitRes]) => {
        setStatistics(statsRes.data);
        setProfitability(profitRes.data);
      })
      .catch(() => toast.error('Error al cargar estadísticas'))
      .finally(() => setLoading(false));
  }, [days]);

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
    } catch {
      toast.error(`Error al exportar ${format.toUpperCase()}`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  const totalVentas = statistics?.daily_sales.reduce((s, d) => s + d.total, 0) || 0;
  const totalTx = statistics?.daily_sales.reduce((s, d) => s + d.count, 0) || 0;
  const p = profitability?.summary || {};
  const hasCostData = (p.cobertura_costo ?? 0) > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Reportes y estadísticas</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Analiza el rendimiento de tu negocio</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ─── VENTAS ─── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Ventas</h2>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Ingresos totales', value: fmtCurrencyFull(totalVentas), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Transacciones', value: totalTx, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Ticket promedio', value: totalTx > 0 ? fmtCurrencyFull(totalVentas / totalTx) : '$0', icon: CreditCard, color: 'text-violet-600', bg: 'bg-violet-50' },
          ].map(card => (
            <Card key={card.label}>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-zinc-900">{card.value}</p>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mt-0.5">{card.label}</p>
                  </div>
                  <div className={`p-2 rounded-md ${card.bg}`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Ventas diarias</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                {statistics?.daily_sales?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statistics.daily_sales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                      <YAxis tickFormatter={v => `$${v / 1000}k`} tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                      <Tooltip content={<SalesTooltip />} />
                      <Bar dataKey="total" name="Ventas" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Métodos de pago</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                {statistics?.payment_breakdown?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statistics.payment_breakdown}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={90}
                        paddingAngle={4}
                        dataKey="total" nameKey="method"
                        label={({ method, percent }) => `${method} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {statistics.payment_breakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => fmtCurrencyFull(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top products + Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Productos más vendidos</CardTitle></CardHeader>
            <CardContent>
              {statistics?.top_products?.length > 0 ? (
                <div className="space-y-3">
                  {statistics.top_products.map((product, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-medium text-zinc-600 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{product.name}</p>
                        <p className="text-xs text-zinc-400">{product.cantidad} uds vendidas</p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-600 shrink-0">{fmtCurrencyFull(product.ingresos)}</p>
                    </div>
                  ))}
                </div>
              ) : <EmptyChart label="No hay ventas en este período" />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Tendencia de ventas</CardTitle></CardHeader>
            <CardContent>
              <div className="h-52">
                {statistics?.daily_sales?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={statistics.daily_sales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                      <YAxis tickFormatter={v => `$${v / 1000}k`} tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                      <Tooltip content={<SalesTooltip />} />
                      <Line type="monotone" dataKey="total" name="Ventas" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─── RENTABILIDAD ─── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Rentabilidad</h2>
          {!hasCostData && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <Info className="h-3 w-3" />
              Agrega costos a tus productos para ver datos
            </span>
          )}
          {hasCostData && p.cobertura_costo < 100 && (
            <span className="flex items-center gap-1 text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
              <Info className="h-3 w-3" />
              Basado en el {p.cobertura_costo}% de los artículos vendidos (los que tienen costo definido)
            </span>
          )}
        </div>

        {/* Profit summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Ingresos', value: fmtCurrencyFull(p.total_ingresos ?? 0), color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
            { label: 'Costos estimados', value: hasCostData ? fmtCurrencyFull(p.total_costos ?? 0) : '—', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-100' },
            { label: 'Ganancia bruta', value: hasCostData ? fmtCurrencyFull(p.ganancia_bruta ?? 0) : '—', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Margen promedio', value: hasCostData ? `${p.margen_promedio ?? 0}%` : '—', color: getMargenColor(p.margen_promedio), bg: 'bg-zinc-50', border: 'border-zinc-100' },
          ].map(card => (
            <Card key={card.label} className={`border ${card.border}`}>
              <CardContent className={`pt-4 pb-3 ${card.bg} rounded-lg`}>
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{card.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Ingresos vs Ganancia chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingresos vs Ganancia por día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {hasCostData && profitability?.daily_series?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitability.daily_series} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                    <YAxis tickFormatter={v => `$${v / 1000}k`} tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                    <Tooltip content={<ProfitTooltip />} />
                    <Legend />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="ganancia" name="Ganancia" fill="#10B981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label={hasCostData ? 'No hay datos en este período' : 'Define el costo de tus productos para ver la ganancia'} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top profitable products */}
        {hasCostData && profitability?.top_rentables?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Productos más rentables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left py-2 pr-4 font-medium text-zinc-500 text-xs uppercase">#</th>
                      <th className="text-left py-2 pr-4 font-medium text-zinc-500 text-xs uppercase">Producto</th>
                      <th className="text-right py-2 pr-4 font-medium text-zinc-500 text-xs uppercase">Ingresos</th>
                      <th className="text-right py-2 pr-4 font-medium text-zinc-500 text-xs uppercase">Costos</th>
                      <th className="text-right py-2 pr-4 font-medium text-zinc-500 text-xs uppercase">Ganancia</th>
                      <th className="text-right py-2 font-medium text-zinc-500 text-xs uppercase">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitability.top_rentables.map((item, i) => (
                      <tr key={i} className="border-b border-zinc-50 hover:bg-zinc-50">
                        <td className="py-2.5 pr-4 text-zinc-400">{i + 1}</td>
                        <td className="py-2.5 pr-4 font-medium text-zinc-900">{item.nombre}</td>
                        <td className="py-2.5 pr-4 text-right text-zinc-600">{fmtCurrencyFull(item.ingresos)}</td>
                        <td className="py-2.5 pr-4 text-right text-rose-600">{fmtCurrencyFull(item.costos)}</td>
                        <td className="py-2.5 pr-4 text-right font-semibold text-emerald-700">{fmtCurrencyFull(item.ganancia)}</td>
                        <td className="py-2.5 text-right">
                          <span className={`font-medium ${getMargenColor(item.margen)}`}>{item.margen}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ─── EXPORTAR ─── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Exportar</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Exportar reporte de ventas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fecha inicio</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha fin</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las ventas</SelectItem>
                  <SelectItem value="completada">Solo completadas</SelectItem>
                  <SelectItem value="anulada">Solo anuladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => exportReport('csv')} disabled={exporting} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />CSV
              </Button>
              <Button onClick={() => exportReport('pdf')} disabled={exporting} className="flex-1">
                <Download className="h-4 w-4 mr-2" />PDF
              </Button>
            </div>
            <p className="text-xs text-zinc-400 text-center">
              {!startDate && !endDate ? 'Se exportarán todas las ventas' : 'Se aplicarán los filtros seleccionados'}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function EmptyChart({ label = 'No hay datos para mostrar' }) {
  return (
    <div className="flex items-center justify-center h-full text-zinc-400 text-sm">{label}</div>
  );
}

function getMargenColor(margen) {
  if (margen == null) return 'text-zinc-400';
  if (margen >= 30) return 'text-emerald-700';
  if (margen >= 15) return 'text-amber-700';
  return 'text-rose-700';
}
