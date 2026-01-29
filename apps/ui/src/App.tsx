import './App.css'
import { useEffect, useMemo, useState } from 'react'

type HcmHealth = {
  status: string
  hcm_root?: string
}

type HcmError = {
  code: string
  message: string
  details?: unknown
}

type HcmSearchResult = {
  source: string
  content: unknown
}

type HcmSearchData = {
  query: string
  classification: string
  routing: string
  count: number
  results: HcmSearchResult[]
}

type HcmEnvelope<T> = {
  ok: boolean
  data: T | null
  error: HcmError | null
  meta?: {
    request_id?: string
    op?: string
    duration_ms?: number
    hcm_version?: string
  }
}

const apiFetch = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, init)
  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : null
  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'error' in (data as any) && (data as any).error?.message) ||
      `HTTP ${res.status}`
    throw new Error(message)
  }
  return data as T
}

const newRequestId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `req_${Date.now()}_${Math.random().toString(16).slice(2)}`

function App() {
  const [health, setHealth] = useState<HcmHealth | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchData, setSearchData] = useState<HcmSearchData | null>(null)

  const canSearch = useMemo(() => query.trim().length > 0 && !isSearching, [isSearching, query])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setHealthError(null)
        const h = await apiFetch<HcmHealth>('/api/health')
        if (!cancelled) setHealth(h)
      } catch (e) {
        if (!cancelled) setHealthError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const runSearch = async () => {
    const q = query.trim()
    if (!q) return
    setIsSearching(true)
    setSearchError(null)
    setSearchData(null)
    try {
      const body = {
        op: 'HCM_SEARCH',
        request_id: newRequestId(),
        caller: { id: 'hcm-ui', roles: ['human'] },
        payload: { query: q },
      }

      const out = await apiFetch<HcmEnvelope<HcmSearchData>>('/api/v1/hcm/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!out.ok) {
        throw new Error(out.error?.message || 'HCM error')
      }
      setSearchData(out.data)
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="title">HCM Arka‑Labs</div>
          <div className="subtitle">Local UI (read-only by default)</div>
        </div>
        <div className="status">
          <span className={`pill ${health ? 'ok' : healthError ? 'error' : 'idle'}`}>
            {health ? 'Connected' : healthError ? 'Disconnected' : '…'}
          </span>
          {health?.hcm_root ? <span className="mono">{health.hcm_root}</span> : null}
        </div>
      </header>

      <main className="content">
        <section className="card">
          <div className="cardTitle">Search</div>
          <div className="row">
            <input
              className="input"
              value={query}
              placeholder="Search in HCM (domain / stable / state)…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runSearch()
              }}
            />
            <button className="button" disabled={!canSearch} onClick={() => void runSearch()}>
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {healthError ? <div className="hint errorText">API: {healthError}</div> : null}
          {searchError ? <div className="hint errorText">Search: {searchError}</div> : null}
          {!searchError && searchData ? (
            <div className="hint">
              {searchData.count} result(s) — <span className="mono">{searchData.classification}</span> /{' '}
              <span className="mono">{searchData.routing}</span>
            </div>
          ) : null}
        </section>

        {searchData ? (
          <section className="card">
            <div className="cardTitle">Results</div>
            <div className="results">
              {searchData.results.map((r) => (
                <details key={r.source} className="result">
                  <summary className="resultSummary">
                    <span className="mono">{r.source}</span>
                  </summary>
                  <pre className="pre">{JSON.stringify(r.content, null, 2)}</pre>
                </details>
              ))}
              {searchData.results.length === 0 ? <div className="hint">No match.</div> : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default App
