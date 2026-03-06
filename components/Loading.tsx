import { Loader2 } from 'lucide-react';

interface LoadingProps {
  size?: number;
  text?: string;
  fullScreen?: boolean;
}

export default function Loading({ size = 48, text, fullScreen = false }: LoadingProps) {
  const container = fullScreen
    ? 'flex justify-center items-center min-h-screen'
    : 'flex justify-center items-center py-20';

  return (
    <div className={container}>
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={size} />
        {text && <p className="text-zinc-400">{text}</p>}
      </div>
    </div>
  );
}
