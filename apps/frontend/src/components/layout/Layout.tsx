import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Toaster } from '../Toaster';
import { AuthProvider } from '../../contexts/AuthContext';
import { CompanionProvider } from '../../contexts/CompanionContext';

export function Layout() {
  return (
    <AuthProvider>
      {/* 全局语音引擎：小知的嗓子+耳朵（形象内嵌在各聊天界面，此处无形象） */}
      <CompanionProvider>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main>
            <Outlet />
          </main>
          <Toaster />
        </div>
      </CompanionProvider>
    </AuthProvider>
  );
}
