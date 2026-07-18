import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Toaster } from '../Toaster';
import { AuthProvider } from '../../contexts/AuthContext';

export function Layout() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main>
          <Outlet />
        </main>
        <Toaster />
      </div>
    </AuthProvider>
  );
}
