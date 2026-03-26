<<<<<<< HEAD
import Image from "next/image";

interface LogoProps {
  size?: number;
}

export default function Logo({ size = 80 }: LogoProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginBottom: "clamp(12px, 2.5vw, 20px)",
        animation: "fadeUp 0.5s 0.1s both",
      }}
    >
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
=======
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

  
>>>>>>> 7649786 (feat(frontend): add login UI)
