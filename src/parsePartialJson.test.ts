import parsePartialJson from "./parsePartialJson";

function expectParse(input: string, expected: any): void {
  const actual = parsePartialJson(input);
  expect(actual).toStrictEqual(expected);
}

describe("parsePartialJson", () => {
  test("partial parsing", () => {
    expectParse("", {});
    expectParse(`{"foo`, {});
    expectParse(`{"foo":`, {});
    expectParse(`{"foo": "3`, {});
    expectParse(`{"foo": "3"`, { foo: "3" });
    expectParse(`{"foo": "3", "neg": -2`, { foo: "3", neg: -2 });
    expectParse(`{"foo": "3", "neg": -2, "bar": [{"foo":["hi`, {
      foo: "3",
      neg: -2,
      bar: [{ foo: [] }],
    });
    expectParse(`{"foo": "3", "neg": -2, "bar": [{"foo":["hi", -1, -`, {
      foo: "3",
      neg: -2,
      bar: [{ foo: ["hi", -1] }],
    });
  });

  test("malformed json", () => {
    expectParse(`{foo:"bar"}`, { foo: "bar" });
  });
});
