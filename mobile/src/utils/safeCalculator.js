// Safe arithmetic expression evaluator — no eval(), no Function() constructor.
// Supports: + - * / . and unary minus. Tokenizes then evaluates with correct
// operator precedence (× ÷ before + −) using a simple recursive-descent parser.
//
// This only ever runs on strings built from the calculator's own button presses
// (digits and the four operators), but it's written to be safe against any
// input string, since the same input is also checked against secret codes
// before it ever reaches this evaluator.

class CalculatorSyntaxError extends Error {}

const tokenize = (input) => {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === " ") {
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let num = ch;
      i++;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        num += input[i];
        i++;
      }
      if ((num.match(/\./g) || []).length > 1) {
        throw new CalculatorSyntaxError("Invalid number");
      }
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }

    if (["+", "-", "*", "/"].includes(ch)) {
      tokens.push({ type: "operator", value: ch });
      i++;
      continue;
    }

    throw new CalculatorSyntaxError(`Unexpected character: ${ch}`);
  }

  return tokens;
};

// Grammar:
//   expression := term (("+" | "-") term)*
//   term       := unary (("*" | "/") unary)*
//   unary      := "-" unary | number
const Parser = (tokens) => {
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parseUnary = () => {
    const token = peek();
    if (!token) throw new CalculatorSyntaxError("Unexpected end of expression");

    if (token.type === "operator" && token.value === "-") {
      consume();
      return -parseUnary();
    }

    if (token.type === "number") {
      consume();
      return token.value;
    }

    throw new CalculatorSyntaxError("Expected number");
  };

  const parseTerm = () => {
    let value = parseUnary();
    while (peek() && peek().type === "operator" && ["*", "/"].includes(peek().value)) {
      const op = consume().value;
      const rhs = parseUnary();
      if (op === "*") {
        value *= rhs;
      } else {
        if (rhs === 0) throw new CalculatorSyntaxError("Division by zero");
        value /= rhs;
      }
    }
    return value;
  };

  const parseExpression = () => {
    let value = parseTerm();
    while (peek() && peek().type === "operator" && ["+", "-"].includes(peek().value)) {
      const op = consume().value;
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  };

  const result = parseExpression();
  if (pos !== tokens.length) throw new CalculatorSyntaxError("Unexpected trailing input");
  return result;
};

// Evaluates a calculator input string like "12+3*4" safely.
// Throws CalculatorSyntaxError on any invalid input — callers should catch and show "Error".
export const evaluateExpression = (input) => {
  if (!input || !input.trim()) throw new CalculatorSyntaxError("Empty expression");
  const tokens = tokenize(input);
  const result = Parser(tokens);
  if (!Number.isFinite(result)) throw new CalculatorSyntaxError("Invalid result");
  return result;
};

export { CalculatorSyntaxError };