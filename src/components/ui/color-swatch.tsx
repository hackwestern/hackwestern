type ColorSwatchProps = {
  name: string;
  value: string;
};

export function ColorSwatch({ name, value }: ColorSwatchProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: value,
          border: '1px solid #e5e5e5',
        }}
      />

      <div>
        <div>{name}</div>
        <div>{value}</div>
      </div>
    </div>
  );
}