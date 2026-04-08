import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import SalesHistory from './pages/SalesHistory';
import Reports from './pages/Reports';
import Users from './pages/Users';
import './App.css';

function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50" data-testid="auth-loading">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  if (user === false) {
    return <Navigate to="/login" replace />;
  }

  // Check role access if allowedRoles is specified
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    // Redirect vendedor to sales page
    if (user?.role === 'vendedor') {
      return <Navigate to="/ventas" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  if (user) {
    // Redirect based on role
    if (user.role === 'vendedor') {
      return <Navigate to="/ventas" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}

function DefaultRedirect() {
  const { user } = useAuth();
  
  if (user?.role === 'vendedor') {
    return <Navigate to="/ventas" replace />;
  }
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/productos"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ventas"
        element={
          <ProtectedRoute allowedRoles={['admin', 'vendedor']}>
            <Sales />
          </ProtectedRoute>
        }
      />
      <Route
        path="/historial"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <SalesHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportes"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Users />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
