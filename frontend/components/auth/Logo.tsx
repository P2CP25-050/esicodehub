import Image from "next/image";



export default function Logo({ size = 80 }: { size?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: "clamp(12px,2.5vw,20px)", animation: "fadeUp 0.5s 0.1s both" }}>
      <Image
        src="/esicodehub-logo.png"
        alt="ESIcodeHub Logo"
        width={size}
        height={size}
        style={{ objectFit: "contain" }}
        priority
      />
    </div>
  );
}

  
