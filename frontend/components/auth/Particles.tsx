export default function Particles() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      {Array.from({ length: 18 }).map((_, i) => (
        <span key={i} style={{
          position: "absolute",
          width: 2 + (i % 3), height: 2 + (i % 3),
          borderRadius: "50%",
          background: i % 4 === 0 ? "#2563eb" : "rgba(59,130,246,0.45)",
          left: `${(i * 347) % 100}%`,
          animation: `particleRise ${7 + (i % 6)}s ${(i * 0.7) % 5}s linear infinite`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}
