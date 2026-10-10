import { expect } from 'vitest';
export function reviewContent(source: string) {
  return {
    directions: [],
    groups: [
      {
        id: expect.stringMatching(/^import-[a-f0-9]{28}$/u) as string,
        directionId: '',
        name: '',
        meetings: [],
        description: '',
        enrollmentOpen: false,
        applicationQuestion: '',
        review: { source },
      },
    ],
  };
}
