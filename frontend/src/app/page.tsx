'use client';

import { useHealth } from '@/queries/use-health';

export default function Home() {
  const { data, isPending, error } = useHealth();

  return (
    <main>
      <h1>Frontend App</h1>
      {isPending && <p>Checking backend status…</p>}
      {error && <p>Error: {error.message}</p>}
      {data && (
        <p>
          Backend: <strong>{data.status}</strong> — {data.timestamp}
        </p>
      )}
    </main>
  );
}
