"use client";

type MediaLightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

export function MediaLightbox({ src, alt, onClose }: MediaLightboxProps) {
  return (
    <div className="media-lightbox" role="dialog" aria-modal="true" aria-label="Full size media preview">
      <button type="button" className="media-lightbox-backdrop" aria-label="Close preview" onClick={onClose} />
      <div className="media-lightbox-content">
        <button type="button" className="media-lightbox-close admin-button" onClick={onClose}>
          Close
        </button>
        <img src={src} alt={alt} className="media-lightbox-image" />
      </div>
    </div>
  );
}
