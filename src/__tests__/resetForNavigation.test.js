const mqPayloadModule = require("../mqPayload");

jest.mock("../mqPayload", () => {
    // swc-compiled ESM exports are non-configurable, so `jest.spyOn` can't
    // wrap them on the live module. Mock attach/detach as jest.fn() while
    // preserving the rest of the real module via requireActual.
    const actual = jest.requireActual("../mqPayload");
    return { ...actual, attach: jest.fn(), detach: jest.fn() };
});

const { resetForNavigation } = require("../mergify");

describe("resetForNavigation", () => {
    test("calls mqPayload.detach in addition to resetQueueState", () => {
        mqPayloadModule.detach.mockClear();
        resetForNavigation();
        expect(mqPayloadModule.detach).toHaveBeenCalled();
    });
});
