import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import App from './App';
import { describe, it, expect, vi } from 'vitest';

// Mock Recharts to avoid rendering complexities in test
vi.mock('recharts', async () => {
    const Original = await vi.importActual('recharts');
    return {
        ...Original as any,
        ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
    };
});

describe('App', () => {
    it('renders the main layout without crashing', () => {
        vi.mocked(window.ipcRenderer.invoke).mockImplementation((channel: string) => {
            if (channel === 'has-credentials') {
                return Promise.resolve(true);
            }
            if (channel === 'get-confluence-config') {
                return Promise.resolve(null);
            }
            return Promise.resolve({});
        });

        const { container } = render(
            <MantineProvider>
                <App />
            </MantineProvider>
        );
        // Check for basic elements that should always be there
        expect(container).toBeInTheDocument();
    });
});
