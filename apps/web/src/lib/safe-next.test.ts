import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it('keeps a path on this site', () => {
    expect(safeNextPath('/tracker?status=APPLIED')).toBe('/tracker?status=APPLIED');
  });

  it.each([null, '', 'https://evil.example', '//evil.example', '/\\evil.example'])(
    'sends %j to the job list',
    (next) => {
      expect(safeNextPath(next)).toBe('/jobs');
    },
  );
});
