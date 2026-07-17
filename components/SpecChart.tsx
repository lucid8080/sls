import { getTablePressTable } from "@/lib/product-displays";
import { normalizeArticleHtmlEntities } from "@/lib/html";
import { rewriteMediaAndEmbeds } from "@/lib/media";

type SpecChartProps = {
  tableId: string;
};

export function SpecChart({ tableId }: SpecChartProps) {
  const table = getTablePressTable(tableId);

  if (!table || table.rows.length === 0) {
    return null;
  }

  const header = table.hasHeader ? table.rows[0] : undefined;
  const bodyRows = table.hasHeader ? table.rows.slice(1) : table.rows;

  return (
    <figure className="spec-chart">
      {table.title ? <figcaption className="spec-chart__caption">{table.title}</figcaption> : null}
      <div className="spec-chart__scroll">
        <table className={table.alternatingRowColors ? "spec-chart__table spec-chart__table--striped" : "spec-chart__table"}>
          {header ? (
            <thead>
              <tr>
                {header.map((cell, index) => (
                  <th key={`h-${index}`} dangerouslySetInnerHTML={{ __html: sanitizeCellHtml(cell) }} />
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {bodyRows.map((row, rowIndex) => (
              <tr key={`r-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`c-${rowIndex}-${cellIndex}`} dangerouslySetInnerHTML={{ __html: sanitizeCellHtml(cell) }} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function sanitizeCellHtml(raw: string): string {
  const withoutScripts = normalizeArticleHtmlEntities(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/ on[a-z]+\s*=\s*(["']).*?\1/gi, "")
    .replace(/ on[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");

  const allowed = withoutScripts.replace(
    /<\/?(?!\/?(?:img|a|strong|em|br|b|i)\b)[a-z][^>]*>/gi,
    "",
  );

  return rewriteMediaAndEmbeds(allowed);
}
