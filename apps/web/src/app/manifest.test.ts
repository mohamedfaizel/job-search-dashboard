import manifest from './manifest';

describe('manifest', () => {
  it('describes an installable app with its own window and icons', () => {
    const app = manifest();
    expect(app).toMatchObject({
      name: 'Job Search Hunter',
      start_url: '/jobs',
      display: 'standalone',
      theme_color: '#0b0b0b',
    });
    expect(app.icons?.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', 'any']);
  });
});
