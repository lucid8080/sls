import { getPlacementByKey } from "@/lib/ads/placements";

type MockAdProps = {
  placementKey: string;
  highlighted?: boolean;
};

export function MockAd({ placementKey, highlighted = false }: MockAdProps) {
  const placement = getPlacementByKey(placementKey);
  if (!placement) {
    return null;
  }

  return (
    <div
      className={`mock-ad${highlighted ? " mock-ad--highlighted" : ""}`}
      style={{
        width: "100%",
        maxWidth: placement.mockSize.width,
        minHeight: placement.mockSize.height,
      }}
    >
      <p className="mock-ad-kicker">Mock ad preview</p>
      <strong>{placement.label}</strong>
      <p>
        Ezoic ID {placement.ezoicId} · {placement.mockSize.width}×{placement.mockSize.height}
      </p>
      <p className="mock-ad-copy">{placement.description}</p>
    </div>
  );
}
