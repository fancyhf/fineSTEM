/**
 * API 测试辅助函数
 */

export async function createProject(page: any, token: string, name: string) {
  const response = await page.request.post('/api/v1/projects', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      name,
      mode: 'standard',
    },
  });

  expect(response.ok()).toBe(true);
  const data = await response.json();
  return data.data;
}

export async function saveProjectChat(page: any, token: string, projectId: string, messages: any[]) {
  const response = await page.request.post(`/api/v1/projects/${projectId}/chat`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      messages,
    },
  });

  expect(response.ok()).toBe(true);
  return await response.json();
}

export async function saveProjectCode(page: any, token: string, projectId: string, code: string, language: string) {
  const response = await page.request.post(`/api/v1/projects/${projectId}/code`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      code,
      language,
    },
  });

  expect(response.ok()).toBe(true);
  return await response.json();
}

export async function getProjectState(page: any, token: string, projectId: string) {
  const response = await page.request.get(`/api/v1/projects/${projectId}/state`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  expect(response.ok()).toBe(true);
  return await response.json();
}

import { expect } from '@playwright/test';
