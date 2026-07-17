/**
 * Minimal PHP serialize() parser for AAWP/TablePress metadata.
 * Supports: null, bool, int, double, string, array. Rejects objects.
 * String lengths are PHP byte lengths (UTF-8).
 */

export type PhpValue = null | boolean | number | string | PhpValue[] | { [key: string]: PhpValue };

export function phpUnserialize(input: string): PhpValue {
  const parser = new PhpSerializeParser(input);
  return parser.parseValue();
}

class PhpSerializeParser {
  private index = 0;

  constructor(private readonly input: string) {}

  parseValue(): PhpValue {
    const type = this.input[this.index];
    if (type === undefined) {
      throw new Error("Unexpected end of PHP serialized value.");
    }

    switch (type) {
      case "N":
        this.expect("N;");
        return null;
      case "b":
        return this.parseBool();
      case "i":
        return this.parseInt();
      case "d":
        return this.parseFloat();
      case "s":
        return this.parseString();
      case "a":
        return this.parseArray();
      case "O":
      case "C":
      case "R":
      case "r":
        throw new Error(`Unsupported PHP serialized type '${type}'.`);
      default:
        throw new Error(`Unknown PHP serialized type '${type}' at index ${this.index}.`);
    }
  }

  private parseBool(): boolean {
    this.expect("b:");
    const value = this.readUntil(";");
    return value === "1";
  }

  private parseInt(): number {
    this.expect("i:");
    const value = Number(this.readUntil(";"));
    if (!Number.isFinite(value)) {
      throw new Error("Invalid PHP integer.");
    }
    return value;
  }

  private parseFloat(): number {
    this.expect("d:");
    const value = Number(this.readUntil(";"));
    if (!Number.isFinite(value)) {
      throw new Error("Invalid PHP float.");
    }
    return value;
  }

  private parseString(): string {
    this.expect("s:");
    const byteLength = Number(this.readUntil(":"));
    if (!Number.isInteger(byteLength) || byteLength < 0) {
      throw new Error("Invalid PHP string length.");
    }
    this.expect('"');

    let advanced = 0;
    let bytes = 0;
    while (bytes < byteLength) {
      if (this.index + advanced >= this.input.length) {
        throw new Error("Truncated PHP string value.");
      }
      const codePoint = this.input.codePointAt(this.index + advanced);
      if (codePoint === undefined) {
        throw new Error("Truncated PHP string value.");
      }
      const char = String.fromCodePoint(codePoint);
      bytes += Buffer.byteLength(char, "utf8");
      advanced += char.length;
    }

    if (bytes !== byteLength) {
      throw new Error("PHP string byte length did not align to UTF-8 characters.");
    }

    const value = this.input.slice(this.index, this.index + advanced);
    this.index += advanced;
    this.expect('";');
    return value;
  }

  private parseArray(): PhpValue {
    this.expect("a:");
    const length = Number(this.readUntil(":"));
    if (!Number.isInteger(length) || length < 0) {
      throw new Error("Invalid PHP array length.");
    }
    this.expect("{");

    const asObject: { [key: string]: PhpValue } = {};
    const asArray: PhpValue[] = [];
    let sequential = true;

    for (let i = 0; i < length; i += 1) {
      const key = this.parseValue();
      const value = this.parseValue();
      const objectKey = String(key);
      asObject[objectKey] = value;

      if (sequential && key === i) {
        asArray.push(value);
      } else {
        sequential = false;
      }
    }

    this.expect("}");
    return sequential ? asArray : asObject;
  }

  private expect(token: string): void {
    if (!this.input.startsWith(token, this.index)) {
      throw new Error(`Expected '${token}' at index ${this.index}.`);
    }
    this.index += token.length;
  }

  private readUntil(delimiter: string): string {
    const end = this.input.indexOf(delimiter, this.index);
    if (end < 0) {
      throw new Error(`Missing '${delimiter}' in PHP serialized value.`);
    }
    const value = this.input.slice(this.index, end);
    this.index = end + delimiter.length;
    return value;
  }
}
