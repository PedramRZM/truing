// Calls to the setup server. Each carries the token from the page.
function token(): string {
  return (
    document
      .querySelector('meta[name="truing-token"]')
      ?.getAttribute('content') ?? ''
  );
}

const headers = (): Record<string, string> => ({
  'content-type': 'application/json',
  'x-truing-token': token(),
});

export async function call<T>(url: string, body: unknown = {}): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const value = (await response.json()) as T & { problem?: string };
  if (!response.ok)
    throw new Error(value.problem ?? 'Truing stopped answering.');
  return value;
}

/** A call that answers line by line: each line goes to `onEvent`. */
export async function stream<E>(
  url: string,
  body: unknown,
  onEvent: (event: E) => void,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    const value = (await response.json().catch(() => ({}))) as {
      problem?: string;
    };
    throw new Error(value.problem ?? 'Truing stopped answering.');
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line) onEvent(JSON.parse(line) as E);
    }
  }
}
