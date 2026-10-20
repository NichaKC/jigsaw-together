// ตัวเลือกแบบปุ่มต่อกัน (ใช้กับจำนวนผู้เล่น / ความยาก / สัดส่วนภาพ)
export default function Segmented({ label, options, value, onChange, disabled, className = '' }) {
  return (
    <div className={`segmented ${className}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="seg"
          aria-pressed={o.value === value}
          disabled={disabled || o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
