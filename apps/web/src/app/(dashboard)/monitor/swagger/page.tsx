'use client';

export default function SwaggerPage() {
  // 走 Next.js /api 代理，避免跨域和 helmet X-Frame-Options 限制
  const swaggerUrl = '/api/docs';

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
