#include "Json.h"
#include <cctype>
#include <iomanip>

namespace SimpleJson {

namespace {

class Parser {
public:
    Parser(const std::string& src) : src_(src), pos_(0) {}

    JsonValue parse(std::string& err) {
        skipWhitespace();
        if (pos_ >= src_.size()) {
            err = "Empty JSON payload";
            return JsonValue();
        }

        try {
            JsonValue v = parseValue();
            skipWhitespace();
            if (pos_ < src_.size()) {
                err = "Extra characters after JSON payload at position " + std::to_string(pos_);
                return JsonValue();
            }
            return v;
        } catch (const std::runtime_error& ex) {
            err = ex.what();
            return JsonValue();
        }
    }

private:
    const std::string& src_;
    size_t pos_{0};

    void skipWhitespace() {
        while (pos_ < src_.size()) {
            char c = src_[pos_];
            if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
                pos_++;
            } else {
                break;
            }
        }
    }

    char peek() {
        skipWhitespace();
        return (pos_ < src_.size()) ? src_[pos_] : '\0';
    }

    char get() {
        skipWhitespace();
        if (pos_ >= src_.size()) {
            throw std::runtime_error("Unexpected end of input");
        }
        return src_[pos_++];
    }

    JsonValue parseValue() {
        char c = peek();
        if (c == '{') return parseObject();
        if (c == '[') return parseArray();
        if (c == '"') return parseString();
        if (c == 't' || c == 'f') return parseBool();
        if (c == 'n') return parseNull();
        if (c == '-' || std::isdigit(static_cast<unsigned char>(c))) return parseNumber();

        throw std::runtime_error(std::string("Unexpected character '") + c + "' at position " + std::to_string(pos_));
    }

    JsonValue parseObject() {
        get(); // consume '{'
        std::map<std::string, JsonValue> obj;
        skipWhitespace();

        if (peek() == '}') {
            get();
            return JsonValue(obj);
        }

        while (true) {
            if (peek() != '"') {
                throw std::runtime_error("Expected string key in object at position " + std::to_string(pos_));
            }
            std::string key = parseString().asString();
            skipWhitespace();

            if (get() != ':') {
                throw std::runtime_error("Expected ':' after key in object at position " + std::to_string(pos_));
            }

            JsonValue val = parseValue();
            obj[key] = val;

            skipWhitespace();
            char nextChar = get();
            if (nextChar == '}') {
                break;
            }
            if (nextChar != ',') {
                throw std::runtime_error("Expected ',' or '}' in object at position " + std::to_string(pos_));
            }
        }
        return JsonValue(obj);
    }

    JsonValue parseArray() {
        get(); // consume '['
        std::vector<JsonValue> arr;
        skipWhitespace();

        if (peek() == ']') {
            get();
            return JsonValue(arr);
        }

        while (true) {
            arr.push_back(parseValue());
            skipWhitespace();
            char nextChar = get();
            if (nextChar == ']') {
                break;
            }
            if (nextChar != ',') {
                throw std::runtime_error("Expected ',' or ']' in array at position " + std::to_string(pos_));
            }
        }
        return JsonValue(arr);
    }

    JsonValue parseString() {
        get(); // consume opening quote '"'
        std::string s;
        while (pos_ < src_.size()) {
            char c = src_[pos_++];
            if (c == '"') {
                return JsonValue(s);
            }
            if (c == '\\') {
                if (pos_ >= src_.size()) {
                    throw std::runtime_error("Unterminated escape sequence in string");
                }
                char esc = src_[pos_++];
                switch (esc) {
                    case '"': s += '"'; break;
                    case '\\': s += '\\'; break;
                    case '/': s += '/'; break;
                    case 'b': s += '\b'; break;
                    case 'f': s += '\f'; break;
                    case 'n': s += '\n'; break;
                    case 'r': s += '\r'; break;
                    case 't': s += '\t'; break;
                    case 'u': {
                        // 4 hex digits (skip or basic ascii support)
                        if (pos_ + 4 <= src_.size()) {
                            pos_ += 4;
                            s += '?';
                        }
                        break;
                    }
                    default: s += esc; break;
                }
            } else {
                s += c;
            }
        }
        throw std::runtime_error("Unterminated string literal");
    }

    JsonValue parseNumber() {
        size_t start = pos_;
        if (src_[pos_] == '-') pos_++;
        while (pos_ < src_.size() && std::isdigit(static_cast<unsigned char>(src_[pos_]))) {
            pos_++;
        }
        if (pos_ < src_.size() && src_[pos_] == '.') {
            pos_++;
            while (pos_ < src_.size() && std::isdigit(static_cast<unsigned char>(src_[pos_]))) {
                pos_++;
            }
        }
        if (pos_ < src_.size() && (src_[pos_] == 'e' || src_[pos_] == 'E')) {
            pos_++;
            if (pos_ < src_.size() && (src_[pos_] == '+' || src_[pos_] == '-')) pos_++;
            while (pos_ < src_.size() && std::isdigit(static_cast<unsigned char>(src_[pos_]))) {
                pos_++;
            }
        }
        std::string numStr = src_.substr(start, pos_ - start);
        double val = std::stod(numStr);
        return JsonValue(val);
    }

    JsonValue parseBool() {
        if (src_.compare(pos_, 4, "true") == 0) {
            pos_ += 4;
            return JsonValue(true);
        }
        if (src_.compare(pos_, 5, "false") == 0) {
            pos_ += 5;
            return JsonValue(false);
        }
        throw std::runtime_error("Invalid boolean at position " + std::to_string(pos_));
    }

    JsonValue parseNull() {
        if (src_.compare(pos_, 4, "null") == 0) {
            pos_ += 4;
            return JsonValue();
        }
        throw std::runtime_error("Invalid null literal at position " + std::to_string(pos_));
    }
};

void escapeString(std::ostream& os, const std::string& s) {
    os << '"';
    for (char c : s) {
        switch (c) {
            case '"': os << "\\\""; break;
            case '\\': os << "\\\\"; break;
            case '\b': os << "\\b"; break;
            case '\f': os << "\\f"; break;
            case '\n': os << "\\n"; break;
            case '\r': os << "\\r"; break;
            case '\t': os << "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    os << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(c);
                } else {
                    os << c;
                }
                break;
        }
    }
    os << '"';
}

} // namespace

JsonValue JsonValue::parse(const std::string& src, std::string& err) {
    Parser parser(src);
    return parser.parse(err);
}

void JsonValue::serializeInternal(std::ostream& os, int currentIndent, int indentStep) const {
    std::string indentStr(currentIndent, ' ');
    std::string nextIndentStr(currentIndent + indentStep, ' ');

    switch (type_) {
        case JsonType::Null: os << "null"; break;
        case JsonType::Bool: os << (boolVal_ ? "true" : "false"); break;
        case JsonType::Number: {
            if (numVal_ == static_cast<long long>(numVal_)) {
                os << static_cast<long long>(numVal_);
            } else {
                os << std::setprecision(6) << numVal_;
            }
            break;
        }
        case JsonType::String: escapeString(os, strVal_); break;
        case JsonType::Array: {
            if (arrVal_.empty()) {
                os << "[]";
                break;
            }
            // Check if array of simple numbers/strings
            bool compact = true;
            for (const auto& item : arrVal_) {
                if (item.isArray() || item.isObject()) { compact = false; break; }
            }

            if (compact && arrVal_.size() <= 8) {
                os << "[";
                for (size_t i = 0; i < arrVal_.size(); ++i) {
                    arrVal_[i].serializeInternal(os, 0, 0);
                    if (i + 1 < arrVal_.size()) os << ", ";
                }
                os << "]";
            } else {
                os << "[\n";
                for (size_t i = 0; i < arrVal_.size(); ++i) {
                    os << nextIndentStr;
                    arrVal_[i].serializeInternal(os, currentIndent + indentStep, indentStep);
                    if (i + 1 < arrVal_.size()) os << ",";
                    os << "\n";
                }
                os << indentStr << "]";
            }
            break;
        }
        case JsonType::Object: {
            if (objVal_.empty()) {
                os << "{}";
                break;
            }
            os << "{\n";
            size_t idx = 0;
            for (auto it = objVal_.begin(); it != objVal_.end(); ++it, ++idx) {
                os << nextIndentStr;
                escapeString(os, it->first);
                os << ": ";
                it->second.serializeInternal(os, currentIndent + indentStep, indentStep);
                if (idx + 1 < objVal_.size()) os << ",";
                os << "\n";
            }
            os << indentStr << "}";
            break;
        }
    }
}

std::string JsonValue::serialize(int indent) const {
    std::ostringstream ss;
    serializeInternal(ss, 0, indent);
    return ss.str();
}

} // namespace SimpleJson
