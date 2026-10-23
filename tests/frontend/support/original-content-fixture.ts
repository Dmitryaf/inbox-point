import { response } from './fake-response';
export const initialVersion = 'a'.repeat(64);

export function contentResponse(schedule: string) {
  return response({
    content: groupContent(schedule),
    version: initialVersion,
  });
}

export function groupContent(name: string, time = 'Понедельник, 19:00') {
  return {
    schedule: '',
    scheduleItems: [],
    directions: [{ id: 'dance', name: 'Танец' }],
    groups: [
      {
        id: 'group',
        directionId: 'dance',
        name,
        meetings: [time],
        description: '',
        enrollmentOpen: false,
        applicationQuestion: '',
      },
    ],
    keywords: [],
  };
}
