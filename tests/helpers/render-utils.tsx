import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

export function renderComponent(ui: React.ReactElement) {
  const container = document.createElement('div');
  const root = createRoot(container);

  return {
    container,
    async render() {
      // We mount through ReactDOM directly in this helper, so manual act is required.
      // eslint-disable-next-line testing-library/no-unnecessary-act
      await act(async () => {
        root.render(ui);
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
    },
  };
}

export function renderHookHost<T>(
  useValue: () => T,
  onReady: (value: T) => void,
) {
  function HookHost() {
    const value = useValue();

    React.useEffect(() => {
      onReady(value);
    }, [value]);

    return null;
  }

  return renderComponent(<HookHost />);
}
