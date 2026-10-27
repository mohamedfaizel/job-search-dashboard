// Types for the microfrontends loaded at runtime through Module Federation.
declare module 'dashboard/App' {
  const App: React.ComponentType;
  export default App;
}

declare module 'dashboard/Tracker' {
  const Tracker: React.ComponentType;
  export default Tracker;
}

declare module 'jobForm/App' {
  const App: React.ComponentType;
  export default App;
}

declare module 'profile/App' {
  const App: React.ComponentType;
  export default App;
}
