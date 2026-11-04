/** Its text comes from a prop: it is set at each use, not inside. */
export function Heading({ text }: { text: string }) {
  return <h2>{text}</h2>;
}
