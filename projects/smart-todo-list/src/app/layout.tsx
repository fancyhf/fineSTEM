export const metadata = {
  title: 'Smart Todo List',
  description: 'AI-powered priority sorting todo app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
