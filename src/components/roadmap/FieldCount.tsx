export function FieldCount({ length, max }: { length: number; max: number }) {
  const state = length >= max ? " is-full" : length >= max * 0.9 ? " is-near" : "";
  return (
    <span className={`field-count${state}`} aria-hidden="true">
      {length}/{max}
    </span>
  );
}
