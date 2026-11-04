import { ActionButton } from '../../components/ui/action-button';

export function AppHeader() {
  return (
    <header>
      <a data-section-link href="/other">
        Recommendation
      </a>
      <ActionButton variant="outline" aria-label="Sign in to your account">
        Sign in
      </ActionButton>
    </header>
  );
}
