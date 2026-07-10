export function PrintWatermark() {
  return (
    <div className="pfs-watermark" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo-mark.png" alt="" />
      <p className="pfs-watermark-title">PRIME</p>
      <p className="pfs-watermark-sub">FINANCIAL SERVICE</p>
    </div>
  );
}
