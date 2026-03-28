interface PasswordStrengthProps {
  password: string;
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const getStrength = (): number => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8)           score++;
    if (/[A-Z]/.test(password))         score++;
    if (/[0-9]/.test(password))         score++;
    if (/[^A-Za-z0-9]/.test(password))  score++;
    return score;
  };

  const strength = getStrength();
  const labels   = ["", "Weak", "Fair", "Good", "Strong"];
  const colors   = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];

  if (!password) return null;

  return (
    <div style={{ marginBottom: 10, animation: "fadeUp 0.3s both" }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= strength ? colors[strength] : "#333",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
      <p
        style={{
          fontSize: 11,
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 600,
          color: colors[strength],
          textAlign: "right",
        }}
      >
        {labels[strength]}
      </p>
    </div>
  );
}