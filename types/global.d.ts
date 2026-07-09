declare global {
  type UntypedValue = ReturnType<typeof JSON.parse>;
}

export {};
