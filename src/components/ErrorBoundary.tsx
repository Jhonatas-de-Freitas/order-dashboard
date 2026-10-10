import { Component, type ReactNode } from 'react';
import { Button } from './Button';

/** Last line of defence: a screen that fails to render does not take the whole app down. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-start gap-3 py-8">
        <div>
          <p className="text-lg font-semibold">Esta tela não pôde ser aberta</p>
          <p className="text-ink-muted">Recarregue a página para tentar de novo.</p>
        </div>
        <Button onClick={() => window.location.reload()}>Recarregar a página</Button>
      </div>
    );
  }
}
