interface BlogComparisonProps {
  headers?: string[];
  rows?: string[][];
}

export function BlogComparison({ headers = [], rows = [] }: BlogComparisonProps) {
  if (!headers.length || !rows.length) return null;

  return (
    <div className="my-8 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            {headers.map((header, i) => (
              <th
                key={i}
                className="text-left px-4 py-3 font-semibold border-b border-border"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {(Array.isArray(row) ? row : []).map((cell, j) => (
                <td key={j} className="px-4 py-3 text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
