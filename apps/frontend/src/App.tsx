/**
 * fineSTEM 前端主应用组件
 *
 * 用途：应用路由配置与布局管理
 * 维护者：AI Agent
 * links: .trae/documents/api-specs/v1/spec.json
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import ProjectAchievement from './pages/ProjectAchievement';
import SharedAchievement from './pages/SharedAchievement';
import { useAuth } from './contexts/AuthContext';
import HongKongMacaoAdmissions from './pages/HongKongMacaoAdmissions';
import InternationalAdmissions from './pages/InternationalAdmissions';
import ProfileEnhancement from './pages/ProfileEnhancement';
import KnowledgeSources from './pages/KnowledgeSources';
import QuestionnaireEngine from './pages/QuestionnaireEngine';
import AIAssistantDialogues from './pages/AIAssistantDialogues';
import AuditLogs from './pages/AuditLogs';
import CourseLibrary from './pages/CourseLibrary';
import OnlineCodeStudio from './pages/OnlineCodeStudio';
import TrackA from './pages/TrackA';
import TrackE from './pages/TrackE';
import ProjectEditor from './pages/ProjectEditor';

// 路由守卫组件
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

// 匿名路由组件（已登录用户重定向）
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
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 分享页面，无需布局 */}
        <Route path="/share/:token" element={<SharedAchievement />} />
        
        {/* 带布局的页面 */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          
          {/* 探索页面 */}
          <Route path="explore">
            <Route index element={<Explore />} />
            <Route path="demos" element={<ExploreDemos />} />
            <Route path="demos/:demoId" element={<ExploreDemoDetail />} />
            <Route path="inspiration" element={<Explore />} />
          </Route>
          
          <Route path="create" element={<Create />} />
          <Route path="connect" element={<Connect />} />
          
          {/* 公开的认证页面 */}
          <Route path="login" element={
            <PublicRoute><Login /></PublicRoute>
          } />
          <Route path="register" element={
            <PublicRoute><Register /></PublicRoute>
          } />
          
          {/* 需要认证的页面 */}
          <Route path="dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
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
          <Route path="hongkong-macao" element={<ProtectedRoute><HongKongMacaoAdmissions /></ProtectedRoute>} />
          <Route path="international-admissions" element={<ProtectedRoute><InternationalAdmissions /></ProtectedRoute>} />
          <Route path="profile-enhancement" element={<ProtectedRoute><ProfileEnhancement /></ProtectedRoute>} />
          <Route path="knowledge-sources" element={<ProtectedRoute><KnowledgeSources /></ProtectedRoute>} />
          <Route path="questionnaire-engine" element={<ProtectedRoute><QuestionnaireEngine /></ProtectedRoute>} />
          <Route path="assistant-dialogues" element={<ProtectedRoute><AIAssistantDialogues /></ProtectedRoute>} />
          <Route path="audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
          <Route path="course-library" element={<ProtectedRoute><CourseLibrary /></ProtectedRoute>} />
          <Route path="code-studio" element={<ProtectedRoute><OnlineCodeStudio /></ProtectedRoute>} />
          <Route path="track-a" element={<ProtectedRoute><TrackA /></ProtectedRoute>} />
          <Route path="track-e" element={<ProtectedRoute><TrackE /></ProtectedRoute>} />
          <Route path="projects/:id/edit" element={<ProtectedRoute><ProjectEditor /></ProtectedRoute>} />
          
          {/* 兼容旧路由 */}
          <Route path="projects/:id" element={<Navigate to="/research/projects/:id" replace />} />
          
          {/* 404 重定向到首页 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
