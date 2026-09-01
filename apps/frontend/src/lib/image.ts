/**
 * 图片路径解析工具
 *
 * 将后端返回的相对路径（如 /demos/xxx/01.png、/media/covers/xxx.png）
 * 拼接成完整的可访问 URL。
 */

export function resolveImageUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
  const origin = baseUrl.startsWith('http') ? new URL(baseUrl).origin : window.location.origin;
  return `${origin}${path}`;
}
