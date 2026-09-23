/* eslint-disable @next/next/no-img-element -- tiny static svg, next/image adds nothing */
export default function Mascot({ size = 48, className = "" }: Readonly<{ size?: number; className?: string }>) {
  return <img src="/mascot.svg" alt="" width={size} height={size} className={className} />;
}
