// declarations.d.ts
declare module '*.csv' {
  const content: number | string; // or `any` if you prefer
  export default content;
}