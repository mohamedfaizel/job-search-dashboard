import { apiUrlFrom } from './api-url';

describe('apiUrlFrom', () => {
  it('uses EXPO_PUBLIC_API_URL when it is set', () => {
    expect(apiUrlFrom('https://jobs.example.com/graphql', '192.168.1.20:8081')).toBe(
      'https://jobs.example.com/graphql',
    );
  });

  it('uses your computer’s Wi-Fi address from the Expo dev server', () => {
    expect(apiUrlFrom(undefined, '192.168.1.20:8081')).toBe('http://192.168.1.20:3000/graphql');
  });

  it('falls back to localhost', () => {
    expect(apiUrlFrom(undefined, undefined)).toBe('http://localhost:3000/graphql');
    expect(apiUrlFrom('', '')).toBe('http://localhost:3000/graphql');
  });
});
