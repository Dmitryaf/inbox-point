import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AnalyticsActivity } from '@frontend/widgets/analytics-overview/ui/AnalyticsActivity';

it.each([7, 30, 90])(
  'preserves original %i zero-filled days and limits labels',
  (days) => {
    const daily = Array.from({ length: days }, (_, index) => ({
      date: new Date(Date.UTC(2026, 7, index + 1)).toISOString().slice(0, 10),
      menuActions: 0,
      requests: 0,
    }));
    const { container } = render(<AnalyticsActivity daily={daily} />);
    const lines = container.querySelectorAll('polyline');
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const points = line.getAttribute('points') ?? '';
      expect(points).not.toMatch(/NaN|Infinity/u);
      expect(points.split(' ')).toHaveLength(days);
    }
    expect(container.querySelectorAll('svg > text')).toHaveLength(3);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(days);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      'Точные значения',
    );
  },
);
