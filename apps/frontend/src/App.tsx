/**
 * fineSTEM 前端主应用组件
 *
 * 用途：应用路由配置与布局管理
 * 维护者：AI Agent
 * links: .trae/documents/api-specs/v1/spec.json
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/layout/Layout';
import { Home } from './pages/Home';
import { Explore } from './pages/Explore';
import ExploreDemos from './pages/ExploreDemos';
import ExploreDemoDetail from './pages/ExploreDemoDetail';
import { Create } from './pages/Create';
import { Research } from './pages/Research';
import { Connect } from './pages/Connect';
import Login from './pages/Login';
import Register from './pages/Register';
import UserProfile from './pages/UserProfile';
import ProjectDetail from './pages/ProjectDetail';
import ProjectAchievement from './pages/ProjectAchievement';
import SharedAchievement from './pages/SharedAchievement';
import ProjectEditor from './pages/ProjectEditor';
import AdminFeatured from './pages/AdminFeatured';
import { useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/research" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
        <Route path="/share/:token" element={<SharedAchievement />} />

        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />

          <Route path="explore">
            <Route index element={<Explore />} />
            <Route path="demos" element={<ExploreDemos />} />
            <Route path="demos/:demoId" element={<ExploreDemoDetail />} />
            <Route path="inspiration" element={<Explore />} />
          </Route>

          <Route path="create" element={<Create />} />
          <Route path="connect" element={<Connect />} />

          <Route path="login" element={
            <PublicRoute><Login /></PublicRoute>
          } />
          <Route path="register" element={
            <PublicRoute><Register /></PublicRoute>
          } />
          <Route path="profile" element={
            <ProtectedRoute><UserProfile /></ProtectedRoute>
          } />

          <Route path="research" element={
            <ProtectedRoute><Research /></ProtectedRoute>
          } />
          <Route path="research/projects/:id" element={
            <ProtectedRoute><ProjectDetail /></ProtectedRoute>
          } />
          <Route path="research/projects/:projectId/achievement" element={
            <ProtectedRoute><ProjectAchievement /></ProtectedRoute>
          } />
          <Route path="projects/:id/edit" element={<ProtectedRoute><ProjectEditor /></ProtectedRoute>} />

          <Route path="admin/featured" element={
            <AdminRoute><AdminFeatured /></AdminRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
