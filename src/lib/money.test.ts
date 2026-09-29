import { describe, expect, it } from "vitest";
import { isPositive, kopecksToDecimal, parseDecimal, positionKopecks, rubToKopecks } from "./money";

describe("parseDecimal", () => {
  it("принимает пробелы, неразрывные пробелы и запятую", () => {
    expect(parseDecimal("1 500 000", 2)).toBe("1500000");
    expect(parseDecimal("1 500 000,5", 2)).toBe("1500000.5");
    expect(parseDecimal("12,34", 2)).toBe("12.34");
  });

  it("отклоняет лишние знаки, буквы, минус и пустоту", () => {
    expect(parseDecimal("1,234", 2)).toBeNull();
    expect(parseDecimal("12a", 2)).toBeNull();
    expect(parseDecimal("-5", 2)).toBeNull();
    expect(parseDecimal("", 2)).toBeNull();
    expect(parseDecimal("1.2.3", 2)).toBeNull();
    expect(parseDecimal("9999999999999", 2)).toBeNull();
  });

  it("целое количество: без дробной части", () => {
    expect(parseDecimal("42", 0)).toBe("42");
    expect(parseDecimal("4,5", 0)).toBeNull();
  });
});

describe("isPositive", () => {
  it("нули не считаются положительными", () => {
    expect(isPositive("0")).toBe(false);
    expect(isPositive("0.00")).toBe(false);
    expect(isPositive("0.01")).toBe(true);
  });
});

describe("копейки", () => {
  it("рубли в копейки и обратно", () => {
    expect(rubToKopecks("1500000.5")).toBe(150000050n);
    expect(rubToKopecks("7")).toBe(700n);
    expect(kopecksToDecimal(150000050n)).toBe("1500000.50");
    expect(kopecksToDecimal(5n)).toBe("0.05");
  });

  it("стоимость позиции: 42 шт. по 1481.25 и округление половины вверх", () => {
    expect(kopecksToDecimal(positionKopecks("42", "1481.25"))).toBe("62212.50");
    // 3 * 0.1005 = 0.3015 ₽ = 30.15 коп. -> 30 коп.
    expect(positionKopecks("3", "0.1005")).toBe(30n);
    // 1 * 0.1050 = 10.5 коп. -> 11 коп.
    expect(positionKopecks("1", "0.105")).toBe(11n);
  });
});
