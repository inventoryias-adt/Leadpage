import { Block } from '@/components/Skeleton';

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center p-5" role="status" aria-label="Carregando">
      <div className="w-full max-w-md space-y-4">
        <Block className="h-48" />
        <Block className="h-32" />
        <Block className="h-14" />
      </div>
    </main>
  );
}
