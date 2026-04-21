import { Window } from 'happy-dom';

const RealDate = Date;
let happyDomWindow: Window | null = null;
type MockDateArgs =
  | []
  | [string | number | Date]
  | [number, number, number?, number?, number?, number?, number?];

export function ensureHappyDom() {
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    return;
  }

  happyDomWindow ??= new Window();

  const runtimeGlobals = {
    window: happyDomWindow,
    self: happyDomWindow,
    document: happyDomWindow.document,
    navigator: happyDomWindow.navigator,
    HTMLElement: happyDomWindow.HTMLElement,
    Element: happyDomWindow.Element,
    Node: happyDomWindow.Node,
    Text: happyDomWindow.Text,
    SVGElement: happyDomWindow.SVGElement,
    DocumentFragment: happyDomWindow.DocumentFragment,
    Event: happyDomWindow.Event,
    EventTarget: happyDomWindow.EventTarget,
    MutationObserver: happyDomWindow.MutationObserver,
    getComputedStyle: happyDomWindow.getComputedStyle.bind(happyDomWindow),
    requestAnimationFrame: happyDomWindow.requestAnimationFrame.bind(happyDomWindow),
    cancelAnimationFrame: happyDomWindow.cancelAnimationFrame.bind(happyDomWindow),
  };

  for (const [key, value] of Object.entries(runtimeGlobals)) {
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
}

export function setSystemDate(fixedDate: Date) {
  const fixedTime = fixedDate.getTime();

  class MockDate extends RealDate {
    constructor(...args: MockDateArgs) {
      switch (args.length) {
        case 0:
          super(fixedTime);
          return;
        case 1:
          super(args[0]);
          return;
        default:
          super(...args);
      }
    }

    static now() {
      return fixedTime;
    }

    static parse = RealDate.parse;
    static UTC = RealDate.UTC;
  }

  Object.defineProperty(globalThis, 'Date', {
    value: MockDate,
    configurable: true,
    writable: true,
  });
}

export function restoreSystemDate() {
  Object.defineProperty(globalThis, 'Date', {
    value: RealDate,
    configurable: true,
    writable: true,
  });
}
