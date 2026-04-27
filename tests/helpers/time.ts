type ViClock = {
  setSystemTime?: (date: Date | number) => void;
  useRealTimers?: () => void;
};

export function ensureViSetSystemTime(vi: ViClock) {
  if (typeof vi?.setSystemTime === 'function') {
    return;
  }

  const OriginalDate = Date;
  let fakeNow: number | null = null;

  class FakeDate extends OriginalDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fakeNow ?? OriginalDate.now());
      } else {
        super(...(args as ConstructorParameters<typeof Date>));
      }
    }

    static now() {
      return fakeNow ?? OriginalDate.now();
    }
  }

  Object.getOwnPropertyNames(OriginalDate).forEach((key) => {
    try {
      (FakeDate as unknown as Record<string, unknown>)[key] = (OriginalDate as unknown as Record<string, unknown>)[key];
    } catch {
      // Some static Date properties may be read-only in this runtime.
    }
  });

  function setSystemTime(date: Date | number) {
    fakeNow = new OriginalDate(date).getTime();
    globalThis.Date = FakeDate as unknown as DateConstructor;
  }

  // eslint-disable-next-line react/no-unnecessary-use-prefix
  function useRealTimers() {
    globalThis.Date = OriginalDate;
    fakeNow = null;
  }

  vi.setSystemTime = setSystemTime;
  if (typeof vi.useRealTimers !== 'function') {
    vi.useRealTimers = useRealTimers;
  }
}
