export function Button(props: { variant?: string; size?: string }) {
  return <button {...props} />;
}

// A use in the component's own file.
export function IconButton() {
  return <Button size="sm" />;
}
