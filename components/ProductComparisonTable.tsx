import { getAawpTable } from "@/lib/product-displays";

type ProductComparisonTableProps = {
  tableId: string;
};

type ComparableProduct = {
  asin: string;
  label: string;
  title: string;
  shortTitle: string;
  url: string;
  imageUrl?: string;
  price?: string;
  features: string[];
};

export function ProductComparisonTable({ tableId }: ProductComparisonTableProps) {
  const table = getAawpTable(tableId);
  const products = (table?.products ?? [])
    .map((entry): ComparableProduct | null => {
      if (!entry.product) {
        return null;
      }

      return {
        asin: entry.asin,
        label: entry.label?.trim() || "Option",
        title: entry.product.title,
        shortTitle: shortenProductTitle(entry.product.title),
        url: entry.product.url,
        imageUrl: entry.product.imageUrl,
        price: entry.product.price,
        features: entry.product.features.slice(0, 3).map(shortenFeature),
      };
    })
    .filter((product): product is ComparableProduct => product !== null);

  if (!table || products.length === 0) {
    return null;
  }

  return (
    <section className="product-comparison" aria-label="Product comparison">
      <div className="product-comparison__header">
        <p className="product-comparison__eyebrow">Product comparison</p>
        <h3 className="product-comparison__title">{friendlyTableTitle(table.title)}</h3>
      </div>

      <div className="product-comparison__scroll">
        <table className="product-comparison__table">
          <thead>
            <tr>
              <th scope="col" className="product-comparison__corner">
                <span className="visually-hidden">Attribute</span>
              </th>
              {products.map((product) => (
                <th key={`label-${product.asin}`} scope="col">
                  <span className="product-comparison__badge">{product.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Product</th>
              {products.map((product) => (
                <td key={`image-${product.asin}`}>
                  {product.imageUrl ? (
                    <img
                      className="product-comparison__image"
                      src={product.imageUrl}
                      alt={product.shortTitle}
                      loading="lazy"
                      width={140}
                      height={140}
                    />
                  ) : (
                    <div className="product-comparison__image product-comparison__image--placeholder" aria-hidden="true" />
                  )}
                  <p className="product-comparison__name">{product.shortTitle}</p>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Price</th>
              {products.map((product) => (
                <td key={`price-${product.asin}`}>
                  {product.price ? (
                    <>
                      <strong className="product-comparison__price">{product.price}</strong>
                      <span className="product-comparison__price-note">backup snapshot</span>
                    </>
                  ) : (
                    <span className="product-comparison__price-note">See current price</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Why it stands out</th>
              {products.map((product) => (
                <td key={`features-${product.asin}`}>
                  <ul className="product-comparison__features">
                    {product.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Buy</th>
              {products.map((product) => (
                <td key={`cta-${product.asin}`}>
                  <a
                    className="product-comparison__cta"
                    href={product.url}
                    rel="sponsored noopener noreferrer"
                    target="_blank"
                  >
                    Check price on Amazon
                  </a>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="product-comparison__disclaimer">
        Prices and availability are from the last site backup and may have changed on Amazon.
      </p>
    </section>
  );
}

function friendlyTableTitle(title: string): string {
  if (!title || /^AAWP Table/i.test(title)) {
    return "Side-by-side picks";
  }
  return title.replace(/\s+Table$/i, "");
}

function shortenProductTitle(title: string): string {
  const beforeComma = title.split(",")[0]?.trim() ?? title;
  if (beforeComma.length <= 72) {
    return beforeComma;
  }
  return `${beforeComma.slice(0, 69).trim()}…`;
}

function shortenFeature(feature: string): string {
  const cleaned = feature.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 110) {
    return cleaned;
  }
  return `${cleaned.slice(0, 107).trim()}…`;
}
