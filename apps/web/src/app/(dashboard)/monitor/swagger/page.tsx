'use client';

export default function SwaggerPage() {
  // 直接指向后端 Swagger 地址（静态站点无代理）
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const swaggerUrl = `${apiBase}/api/docs`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">接口文档</h1>
        <p className="text-muted-foreground">Swagger API 在线文档</p>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        <iframe
          src={swaggerUrl}
          className="w-full h-full"
          title="Swagger API 文档"
          sandbox="allow-scripts allow-popups allow-forms allow-same-origin"
        />
      </div>
    </div>
  );
}
