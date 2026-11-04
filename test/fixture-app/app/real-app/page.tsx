import { AppHeader } from './app-header';
import { RegisterWorker } from './register-worker';

// What a real app has and a bare fixture doesn't: a sign-in that redirects, a
// service worker, a header that changes at a breakpoint, a primitive in a feature.
export default function RealAppPage() {
  return (
    <main>
      <style>{`
        [data-section-link] { display: none; }
        @media (min-width: 768px) { [data-section-link] { display: inline; } }
      `}</style>
      <AppHeader />
      <RegisterWorker />
      <p>Welcome back</p>
    </main>
  );
}
