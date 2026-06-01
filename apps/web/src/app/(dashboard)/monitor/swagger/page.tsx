'use client';

export default function SwaggerPage() {
  const swaggerUrl = process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/docs`
    : 'http://localhost:3100/api/docs';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">接口文档</h1>
        <p className="text-muted-foreground">Swagger API 文档（来源: {swaggerUrl}）</p>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        <iframe
          src={swaggerUrl}
          className="w-full h-full"
          title="Swagger API 文档"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
