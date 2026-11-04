export default function Card() {
  return <section />;
}

// A use of the default export inside its own file.
export function CardPair() {
  return (
    <>
      <Card />
      <Card />
    </>
  );
}
