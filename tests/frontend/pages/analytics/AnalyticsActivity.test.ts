// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AnalyticsActivity from '@frontend/widgets/analytics-overview/ui/AnalyticsActivity.vue';

describe('daily activity chart', () => {
  it.each([7, 30, 90])(
    'renders %i zero-filled days without invalid coordinates or excessive labels',
    (days) => {
      const daily = Array.from({ length: days }, (_, index) => ({
        date: new Date(Date.UTC(2026, 7, index + 1)).toISOString().slice(0, 10),
        menuActions: 0,
        requests: 0,
      }));
      const wrapper = mount(AnalyticsActivity, { props: { daily } });
      expect(wrapper.get('svg').attributes('aria-label')).toContain(
        'Точные значения',
      );
      const lines = wrapper.findAll('polyline');
      expect(lines).toHaveLength(2);
      for (const line of lines) {
        const points = line.attributes('points') ?? '';
        expect(points).not.toMatch(/NaN|Infinity/u);
        expect(points.split(' ')).toHaveLength(days);
      }
      expect(wrapper.findAll('svg > text')).toHaveLength(3);
      expect(wrapper.findAll('tbody tr')).toHaveLength(days);
      wrapper.unmount();
    },
  );
});
