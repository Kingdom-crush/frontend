package com.sunwise.hdlweb;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class Json {
    private Json() {
    }

    static String stringify(Object value) {
        StringBuilder sb = new StringBuilder();
        writeValue(sb, value);
        return sb.toString();
    }

    static Map<String, String> parseFlatObject(String input) {
        Parser parser = new Parser(input == null ? "" : input);
        return parser.parseObject();
    }

    private static void writeValue(StringBuilder sb, Object value) {
        if (value == null) {
            sb.append("null");
        } else if (value instanceof String s) {
            writeString(sb, s);
        } else if (value instanceof Number || value instanceof Boolean) {
            sb.append(value);
        } else if (value instanceof Map<?, ?> map) {
            sb.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!first) {
                    sb.append(',');
                }
                first = false;
                writeString(sb, String.valueOf(entry.getKey()));
                sb.append(':');
                writeValue(sb, entry.getValue());
            }
            sb.append('}');
        } else if (value instanceof Iterable<?> items) {
            sb.append('[');
            boolean first = true;
            for (Object item : items) {
                if (!first) {
                    sb.append(',');
                }
                first = false;
                writeValue(sb, item);
            }
            sb.append(']');
        } else if (value.getClass().isArray()) {
            List<Object> items = new ArrayList<>();
            int length = java.lang.reflect.Array.getLength(value);
            for (int i = 0; i < length; i++) {
                items.add(java.lang.reflect.Array.get(value, i));
            }
            writeValue(sb, items);
        } else {
            writeString(sb, String.valueOf(value));
        }
    }

    private static void writeString(StringBuilder sb, String value) {
        sb.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20 || c > 0x7e) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        sb.append('"');
    }

    private static final class Parser {
        private final String input;
        private int pos;

        Parser(String input) {
            this.input = input.trim();
        }

        Map<String, String> parseObject() {
            Map<String, String> out = new LinkedHashMap<>();
            skipWs();
            if (peek() == 0) {
                return out;
            }
            expect('{');
            skipWs();
            if (peek() == '}') {
                pos++;
                return out;
            }
            while (true) {
                skipWs();
                String key = parseString();
                skipWs();
                expect(':');
                skipWs();
                String value = parseValueAsString();
                out.put(key, value);
                skipWs();
                char c = peek();
                if (c == ',') {
                    pos++;
                    continue;
                }
                if (c == '}') {
                    pos++;
                    break;
                }
                throw error("Expected ',' or '}'");
            }
            return out;
        }

        private String parseValueAsString() {
            char c = peek();
            if (c == '"') {
                return parseString();
            }
            int start = pos;
            while (pos < input.length()) {
                c = input.charAt(pos);
                if (c == ',' || c == '}' || Character.isWhitespace(c)) {
                    break;
                }
                pos++;
            }
            return input.substring(start, pos);
        }

        private String parseString() {
            expect('"');
            StringBuilder sb = new StringBuilder();
            while (pos < input.length()) {
                char c = input.charAt(pos++);
                if (c == '"') {
                    return sb.toString();
                }
                if (c == '\\') {
                    if (pos >= input.length()) {
                        throw error("Invalid escape");
                    }
                    char e = input.charAt(pos++);
                    switch (e) {
                        case '"' -> sb.append('"');
                        case '\\' -> sb.append('\\');
                        case '/' -> sb.append('/');
                        case 'b' -> sb.append('\b');
                        case 'f' -> sb.append('\f');
                        case 'n' -> sb.append('\n');
                        case 'r' -> sb.append('\r');
                        case 't' -> sb.append('\t');
                        case 'u' -> {
                            if (pos + 4 > input.length()) {
                                throw error("Invalid unicode escape");
                            }
                            String hex = input.substring(pos, pos + 4);
                            sb.append((char) Integer.parseInt(hex, 16));
                            pos += 4;
                        }
                        default -> throw error("Invalid escape");
                    }
                } else {
                    sb.append(c);
                }
            }
            throw error("Unterminated string");
        }

        private void expect(char expected) {
            if (peek() != expected) {
                throw error("Expected '" + expected + "'");
            }
            pos++;
        }

        private char peek() {
            return pos >= input.length() ? 0 : input.charAt(pos);
        }

        private void skipWs() {
            while (pos < input.length() && Character.isWhitespace(input.charAt(pos))) {
                pos++;
            }
        }

        private IllegalArgumentException error(String message) {
            return new IllegalArgumentException(message + " at position " + pos);
        }
    }
}
