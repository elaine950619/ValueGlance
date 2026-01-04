import { useEffect, useState } from "react";

type SortKey = "symbol" | "price" | "changePercent";

type StockRow = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  status: "ok" | "rate-limited" | "error" | "no-data";
};

const API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_KEY as string;
const DEFAULT_SYMBOLS = ["AAPL"];


function App() {
  // state for the text input where user types symbols
  const [symbolsInput, setSymbolsInput] = useState(
    DEFAULT_SYMBOLS.join(", ")
  );

  // table data
  const [rows, setRows] = useState<StockRow[]>([]);
  // loading flag
  const [loading, setLoading] = useState(false);
  // error message (if any)
  const [error, setError] = useState<string | null>(null);
  // sorting
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  // last updated time
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // turn "AAPL, msft, googl" into ["AAPL","MSFT","GOOGL"]
  const parseSymbols = () =>
    symbolsInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

  const fetchStocks = async () => {
    const symbols = parseSymbols();
    if (!symbols.length) return;

    setLoading(true);
    setError(null);

    try {
      const results: StockRow[] = [];

      for (const symbol of symbols) {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
          symbol
        )}&apikey=${API_KEY}`;

        const res = await fetch(url);
        if (!res.ok) {
          // network/HTTP error for this symbol
          results.push({
            symbol,
            price: null,
            changePercent: null,
            status: "error",
          });
          continue;
        }

        const data = await res.json();
        console.log("DATA FOR", symbol, data);

        // Hit free-tier rate limit
        if (
          typeof data.Note === "string" ||
          typeof data.Information === "string"
        ) {
          results.push({
            symbol,
            price: null,
            changePercent: null,
            status: "rate-limited",
          });
          continue;
        }

        // Invalid symbol or bad request
        if (data["Error Message"]) {
          results.push({
            symbol,
            price: null,
            changePercent: null,
            status: "error",
          });
          continue;
        }

        const quote = data["Global Quote"];

        const looksEmpty =
          !quote && Object.keys(data || {}).length === 0;

        if (!quote || !quote["05. price"]) {
          results.push({
            symbol,
            price: null,
            changePercent: null,
            status: looksEmpty ? "rate-limited" : "no-data",
          });
          continue;
        }


        // normal case
        results.push({
          symbol,
          price: parseFloat(quote["05. price"]),
          changePercent: parseFloat(
            (quote["10. change percent"] || "0").replace("%", "")
          ),
          status: "ok",
        });
      }


      setRows(results);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // fetch default stocks once when the app loads
  useEffect(() => {
    fetchStocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex justify-center items-start px-6 sm:px-10 py-10">
      <div className="w-full max-w-4xl bg-slate-900 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Stock Price Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Built with React, TypeScript, and Tailwind. Enter symbols and fetch
              the latest quotes.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              className="min-w-[220px] rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-indigo-500"
              value={symbolsInput}
              onChange={(e) => setSymbolsInput(e.target.value)}
              placeholder="e.g. AAPL, MSFT, GOOGL"
            />
            <button
              onClick={fetchStocks}
              disabled={loading}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </header>

        {lastUpdated && (
          <p className="text-xs text-slate-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500 bg-rose-950/40 px-4 py-2 text-sm text-rose-100">
            Failed to load stocks: {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80">
              <tr>
                <SortableHeader
                  label="Symbol"
                  column="symbol"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Price"
                  column="price"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="% Change"
                  column="changePercent"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {sortedRows.map((row) => (
                <tr
                  key={row.symbol}
                  className="hover:bg-slate-800/80 transition-colors"
                >
                  <td className="px-4 py-2 font-medium">{row.symbol}</td>

                  {/* Price cell */}
                  <td className="px-4 py-2">
                    {row.price !== null
                      ? row.price.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        })
                      : "—"}
                  </td>

                  {/* % change cell */}
                  <td className="px-4 py-2">
                    {row.changePercent !== null ? (
                      <span
                        className={
                          row.changePercent > 0
                            ? "text-emerald-400"
                            : row.changePercent < 0
                            ? "text-rose-400"
                            : "text-slate-200"
                        }
                      >
                        {row.changePercent.toFixed(2)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>

                  {/* Status cell */}
                  <td className="px-4 py-2 text-xs">
                    {row.status === "ok" && <span className="text-emerald-400">OK</span>}
                    {row.status === "rate-limited" && (
                      <span className="text-amber-500">Rate limited</span>
                    )}
                    {row.status === "error" && (
                      <span className="text-rose-500">Error</span>
                    )}
                    {row.status === "no-data" && (
                      <span className="text-slate-400">No data</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <p className="text-xs text-slate-400 italic">
            Loading data from the API…
          </p>
        )}
      </div>
    </div>
  );
}

// small helper component for sortable table headers
type SortableHeaderProps = {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
};

function SortableHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: SortableHeaderProps) {
  const isActive = column === sortKey;
  return (
    <th
      onClick={() => onSort(column)}
      className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide cursor-pointer select-none"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

export default App;
