'use client';

type ToggleSwitchProps = {
  on: boolean;
  label: string;
  onToggle?: () => void;
};

export function ToggleSwitch({ on, label, onToggle }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`track ${on ? 'track--on' : 'track--off'}`}
      data-on={on}
      aria-label={label}
      onClick={onToggle}
    >
      <span className="knob" />
    </button>
  );
}
