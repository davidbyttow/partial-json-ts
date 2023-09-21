import { visit, ParseErrorCode, printParseErrorCode } from "jsonc-parser";

const abortError = {};

const debugOutput = false;

// parsePartialJson handles streaming LLM responses with partial and malformed JSON
export const parsePartialJson = (input: string): Record<string, any> => {
  input = cleanJsonString(input);
  let stack: string[] = [];
  let json: string = "";
  let lastToken: string | undefined;
  const inArray = () => stack.length > 0 && stack[stack.length - 1] === "]";

  const trace = (msg: string) => {
    if (!debugOutput) {
      return;
    }
    console.log(msg);
  };

  try {
    visit(input, {
      onObjectBegin: () => {
        json += "{";
        stack.push("}");
        lastToken = "begin_object";
        trace("begin_object");
      },
      onObjectProperty: (property: string, offset: number, length: number) => {
        json += input.substring(offset, offset + length);
        lastToken = "property";
        trace(`property ${property}`);
      },
      onObjectEnd: () => {
        json += stack.pop();
        lastToken = "end_object";
        trace("end_object");
      },
      onArrayBegin: (offset: number, length: number) => {
        json += "[";
        stack.push("]");
        lastToken = "begin_array";
        trace("begin_array");
      },
      onArrayEnd: (offset: number, length: number) => {
        json += stack.pop();
        lastToken = "end_array";
        trace("end_array");
      },
      onLiteralValue: (value: any, offset: number, length: number) => {
        json += input.substring(offset, offset + length);
        lastToken = "value";
        trace(`value ${value}`);
      },
      onSeparator: (sep: string, offset: number, length: number) => {
        json += input.substring(offset, offset + length);
        if (sep === ",") {
          lastToken = "comma";
        } else if (sep === ":") {
          lastToken = "colon";
        }
        trace(`sep ${sep}`);
      },
      onError: (error: ParseErrorCode, offset: number, length: number) => {
        if (
          error == ParseErrorCode.UnexpectedEndOfString &&
          (lastToken == "colon" || inArray())
        ) {
          json += input.substring(offset, offset + length) + '"';
          lastToken = "value";
        }
        trace(`error ${printParseErrorCode(error)}`);
        throw abortError;
      },
    });
  } catch (e) {
    if (e !== abortError) {
      throw e;
    }
  }

  if (lastToken === undefined) {
    return {};
  }

  if (lastToken === "comma") {
    json = json.substring(0, json.lastIndexOf(","));
  } else if (lastToken === "colon" || lastToken == "property") {
    const beginIdx = json.lastIndexOf("{");
    if (json.lastIndexOf(",") > beginIdx) {
      json = json.substring(0, json.lastIndexOf(","));
    } else {
      json = json.substring(0, beginIdx + 1);
    }
  }
  while (stack.length > 0) {
    json += stack.pop();
  }
  return JSON.parse(json);
};

export const cleanJsonString = (input: string): string => {
  input = input.trim();

  // handle code blocks
  if (input.includes("```json")) {
    [, input] = input.split("```json");
  }
  if (input.includes("```")) {
    [input] = input.split("```");
  }
  if (input.startsWith("```json")) {
    input = input.substring("```json".length);
  }
  if (input.startsWith("```")) {
    input = input.substring("```".length);
  }
  if (input.endsWith("```")) {
    input = input.substring(0, input.length - "```".length);
  }
  input = input.trim();

  // handle missing quotes
  input = input
    .replace(/'(\w+)':/g, '"$1":')
    .replace(/\n.\s+[^\w\"](\w+):[^\w]/g, '"$1": ')
    .replace(/,\s*(]|})/g, "$1");

  // strip illegal characters
  input = input.replace(/\xa0/g, " ");

  // extract the outer object
  const match = input.match(/{.*}/s);
  if (match) {
    input = match[0];
  }

  return input;
};

export default parsePartialJson;
