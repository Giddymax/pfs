import Image from "next/image";

// Intrinsic size of public/logo-mark.png — keeps the rendered mark's aspect ratio correct.
const INTRINSIC_WIDTH = 417;
const INTRINSIC_HEIGHT = 371;

export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/images/logo-mark.png"
      width={INTRINSIC_WIDTH}
      height={INTRINSIC_HEIGHT}
      alt="Prime Financial Service"
      className={className}
      style={{ width: size, height: (size * INTRINSIC_HEIGHT) / INTRINSIC_WIDTH }}
      priority
    />
  );
}
