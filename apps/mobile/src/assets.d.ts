/** Images are bundled by Metro; importing one gives its asset id for <Image source>. */
declare module '*.png' {
  const asset: number;
  export default asset;
}
declare module '*.jpg' {
  const asset: number;
  export default asset;
}
