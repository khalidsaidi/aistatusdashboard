/**
 * Hydration Error Detection Test
 * This test demonstrates why the current test setup isn't catching hydration errors properly
 */

import React from 'react';
import { render } from '@testing-library/react';

// Component that would cause hydration error (before our fix)
function HydrationErrorComponent() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // This would cause hydration error without proper mounting check
  if (!mounted) {
    return <div>Loading...</div>;
  }

  // This would be different on server vs client
  return <div>Current time: {new Date().toLocaleTimeString()}</div>;
}

// Component that accesses window without proper checks (causes hydration error)
function BadHydrationComponent() {
  const [url, setUrl] = React.useState('');

  React.useEffect(() => {
    // This would cause hydration error if accessed during SSR
    setUrl(window.location.href);
  }, []);

  return <div>URL: {url}</div>;
}

describe('Hydration Error Detection', () => {
  it('should properly handle components that could cause hydration errors', () => {
    // This test passes because our components now handle hydration properly
    const { container } = render(<HydrationErrorComponent />);
    expect(container).toBeInTheDocument();
  });

  it('should catch components that access window during render', () => {
    // This test would fail in strict mode if the component accessed window during render
    const { container } = render(<BadHydrationComponent />);
    expect(container).toBeInTheDocument();
  });

  it('should demonstrate why tests miss hydration errors', () => {
    // The issue is that Jest/jsdom doesn't actually do server-side rendering
    // It only does client-side rendering, so hydration mismatches don't occur
    // in the test environment the same way they do in production Next.js

    console.log('Test environment details:');
    console.log('- typeof window:', typeof window);
    console.log('- typeof document:', typeof document);
    console.log('- Environment:', process.env.NODE_ENV);

    // In Jest, window is always available, so hydration mismatches are harder to detect
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });
});
