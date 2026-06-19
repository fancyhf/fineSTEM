/**
 * 用户详情页
 *
 * 用途：展示用户个人信息、修改昵称、修改密码
 * 维护者：AI Agent
 * links: .trae/documents/api-specs/v1/spec.json
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import { ArrowLeft, User, Lock, Save, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function UserProfile() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  // 昵称编辑状态
  const [name, setName] = useState(user?.name || '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState('');

  // 密码修改状态
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // 错误状态
  const [nameError, setNameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('昵称不能为空');
      return;
    }

    setNameSaving(true);
    try {
      await authApi.updateMe({ name: trimmedName });
      await refreshUser();
      setNameSuccess('昵称修改成功');
      setTimeout(() => setNameSuccess(''), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '修改失败';
      setNameError(message);
    } finally {
      setNameSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('新密码长度不能少于 6 位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('新密码不能与当前密码相同');
      return;
    }

    setPasswordSaving(true);
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('密码修改成功');
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '密码修改失败';
      setPasswordError(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* 顶部导航 */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
          <h1 className="text-xl font-bold text-gray-900">个人资料</h1>
        </div>

        {/* 用户头像与基本信息 */}
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-2xl shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 truncate">{user.name}</h2>
                <p className="text-sm text-gray-500 truncate">{user.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                    {user.role === 'student' ? '学生' : user.role}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                    Lv.{user.level}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 修改昵称 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-teal-600" />
              修改昵称
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleNameSubmit}>
            <CardContent className="space-y-4">
              {nameError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {nameError}
                </div>
              )}
              {nameSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {nameSuccess}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">昵称</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入新昵称"
                  maxLength={30}
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={nameSaving}
              >
                {nameSaving ? '保存中...' : '保存'}
                {!nameSaving && <Save className="ml-2 h-4 w-4" />}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* 修改密码 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-teal-600" />
              修改密码
            </CardTitle>
          </CardHeader>
          <form onSubmit={handlePasswordSubmit}>
            <CardContent className="space-y-4">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {passwordSuccess}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">当前密码</label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="请输入当前密码"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">新密码</label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="请输入新密码（至少 6 位）"
                    className="pr-10"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">确认新密码</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  minLength={6}
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={passwordSaving}
              >
                {passwordSaving ? '修改中...' : '修改密码'}
                {!passwordSaving && <Lock className="ml-2 h-4 w-4" />}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
