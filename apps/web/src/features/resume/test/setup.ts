// The builder shares the profile screen's fake API (same account); its own handlers are in
// server.ts here, added per test.
import '../../profile/test/setup';
import '../../../test/navigation';
import { build, jobBuild } from './server';

afterEach(() => {
  build.reset();
  jobBuild.reset();
  window.history.pushState({}, '', '/');
});
