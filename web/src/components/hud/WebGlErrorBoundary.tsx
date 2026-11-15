import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onFallback: () => void;
}

interface State { error: Error | null }

/** Falls back to 2D when WebGL/scene construction throws. */
export class WebGlErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('3D scene failed; falling back to 2D', error, info.componentStack);
    this.props.onFallback();
  }

  render() {
    if (this.state.error) {
      return (
        <div className="lp3-fallback" role="alert">
          <p>3D view unavailable ({this.state.error.message}). Showing the 2D navigator instead.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
