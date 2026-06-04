interface LoadingProps {
  /** 全屏模式：覆盖整个视口（用于 layout 级别的 loading） */
  fullscreen?: boolean;
}

export function Loading({ fullscreen }: LoadingProps) {
  return (
    <div className={`flex items-center justify-center ${fullscreen ? 'min-h-screen' : 'flex-1'}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
