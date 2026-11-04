// A page that refuses to be framed, as many apps do, and streams its body.
export function GET(): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode('<!doctype html><title>x</title><p>first part</p>'),
      );
      await new Promise((resolve) => setTimeout(resolve, 1500));
      controller.enqueue(encoder.encode('<p>second part</p>'));
      controller.close();
    },
  });
  return new Response(body, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-frame-options': 'DENY',
      'content-security-policy': "frame-ancestors 'none'; img-src 'self'",
    },
  });
}
