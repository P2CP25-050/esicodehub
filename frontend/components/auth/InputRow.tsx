<<<<<<< HEAD
import { useState } from "react";
import { EyeOn , EyeOff } from "@/components/auth/Eyeicons";
interface InputRowProps {
  id: string;
  placeholder: string;
  type?: string;
  icon?: React.ReactNode;
  toggleable?: boolean;
  delay?: number;
  value: string;
  onChange: (v: string) => void;
  shake?: boolean;
  error?: string;
  fontSize?: number;
}
export default function InputRow({ id, placeholder, type = "text", icon, toggleable = false, delay = 0, value, onChange, shake = false, error, fontSize = 15 }: InputRowProps) {
  const [focused, setFocused]   = useState(false);
  const [visible, setVisible]   = useState(false);
  const inputType = toggleable ? (visible ? "text" : "password") : type;
  const hasError  = !!error || shake;

  return (
    <div style={{ marginBottom: error ? 6 : 10, animation: `slideInLeft 0.45s ${delay}s both` }}>
      <div style={{
        background: "#1a1a1a", borderRadius: 10,
        display: "flex", alignItems: "center", padding: "0 14px",
        border: `1.5px solid ${hasError ? "#ef4444" : focused ? "#2563eb" : "transparent"}`,
        boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.14)" : hasError ? "0 0 0 3px rgba(239,68,68,0.14)" : "none",
        transition: "border-color 0.25s, box-shadow 0.25s",
      }}>
        <input
          id={id} type={inputType} placeholder={placeholder}
          value={value} onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          autoComplete="off"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#ddd", fontFamily: "'Rajdhani',sans-serif", fontSize, fontWeight: 500, padding: "13px 0", minWidth: 0 }}
        />
        <button type="button" onClick={() => toggleable && setVisible(v => !v)}
          style={{ background: "none", border: "none", cursor: toggleable ? "pointer" : "default", display: "flex", alignItems: "center", padding: 0, flexShrink: 0, color: focused ? "#3b82f6" : "#555", transition: "color 0.2s" }}>
          {toggleable ? (visible ? <EyeOn /> : <EyeOff color={focused ? "#3b82f6" : "#555"} />) : icon}
        </button>
      </div>
      {error && <p style={{ color: "#ef4444", fontSize: 11, fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, marginTop: 4, paddingLeft: 4, animation: "fadeUp 0.3s both" }}>{error}</p>}
    </div>
  );
=======
import { useState } from "react";
import { EyeOn , EyeOff } from "@/components/auth/Eyeicons";
interface InputRowProps {
  id: string;
  placeholder: string;
  type?: string;
  icon?: React.ReactNode;
  toggleable?: boolean;
  delay?: number;
  value: string;
  onChange: (v: string) => void;
  shake?: boolean;
  error?: string;
  fontSize?: number;
}
export default function InputRow({ id, placeholder, type = "text", icon, toggleable = false, delay = 0, value, onChange, shake = false, error, fontSize = 15 }: InputRowProps) {
  const [focused, setFocused]   = useState(false);
  const [visible, setVisible]   = useState(false);
  const inputType = toggleable ? (visible ? "text" : "password") : type;
  const hasError  = !!error || shake;

  return (
    <div style={{ marginBottom: error ? 6 : 10, animation: `slideInLeft 0.45s ${delay}s both` }}>
      <div style={{
        background: "#1a1a1a", borderRadius: 10,
        display: "flex", alignItems: "center", padding: "0 14px",
        border: `1.5px solid ${hasError ? "#ef4444" : focused ? "#2563eb" : "transparent"}`,
        boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.14)" : hasError ? "0 0 0 3px rgba(239,68,68,0.14)" : "none",
        transition: "border-color 0.25s, box-shadow 0.25s",
      }}>
        <input
          id={id} type={inputType} placeholder={placeholder}
          value={value} onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          autoComplete="off"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#ddd", fontFamily: "'Rajdhani',sans-serif", fontSize, fontWeight: 500, padding: "13px 0", minWidth: 0 }}
        />
        <button type="button" onClick={() => toggleable && setVisible(v => !v)}
          style={{ background: "none", border: "none", cursor: toggleable ? "pointer" : "default", display: "flex", alignItems: "center", padding: 0, flexShrink: 0, color: focused ? "#3b82f6" : "#555", transition: "color 0.2s" }}>
          {toggleable ? (visible ? <EyeOn /> : <EyeOff color={focused ? "#3b82f6" : "#555"} />) : icon}
        </button>
      </div>
      {error && <p style={{ color: "#ef4444", fontSize: 11, fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, marginTop: 4, paddingLeft: 4, animation: "fadeUp 0.3s both" }}>{error}</p>}
    </div>
  );
>>>>>>> 7649786 (feat(frontend): add login UI)
}