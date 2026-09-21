'use client';

import { useEffect, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { Track } from '@/lib/types';
import TrackRow from '@/components/TrackRow';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    const controller = new AbortController();

    // Debounced so we're not firing a request (and burning API quota) per keystroke.
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Search failed');
        setResults(data.results);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-2 bg-dusk rounded-xl px-3 py-2 mb-4 focus-within:ring-2 focus-within:ring-marigold/60">
        <SearchIcon size={18} className="text-haze shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Tamil or English songs"
          className="bg-transparent outline-none flex-1 text-sm text-paper placeholder:text-haze"
        />
      </div>

      {loading && <p className="text-sm text-haze">Searching…</p>}
      {error && <p className="text-sm text-magenta">{error}</p>}

      <div className="flex flex-col">
        {results.map((t) => (
          <TrackRow key={t.id} track={t} context={results} />
        ))}
      </div>
    </div>
  );
}
