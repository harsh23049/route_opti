#ifndef JSON_H
#define JSON_H

#include <string>
#include <vector>
#include <map>
#include <sstream>
#include <stdexcept>
#include <memory>

namespace SimpleJson {

enum class JsonType {
    Null,
    Bool,
    Number,
    String,
    Array,
    Object
};

class JsonValue {
public:
    JsonValue() : type_(JsonType::Null) {}
    JsonValue(bool b) : type_(JsonType::Bool), boolVal_(b) {}
    JsonValue(double d) : type_(JsonType::Number), numVal_(d) {}
    JsonValue(int i) : type_(JsonType::Number), numVal_(static_cast<double>(i)) {}
    JsonValue(const char* s) : type_(JsonType::String), strVal_(s ? s : "") {}
    JsonValue(const std::string& s) : type_(JsonType::String), strVal_(s) {}
    JsonValue(const std::vector<JsonValue>& arr) : type_(JsonType::Array), arrVal_(arr) {}
    JsonValue(const std::map<std::string, JsonValue>& obj) : type_(JsonType::Object), objVal_(obj) {}

    JsonType type() const { return type_; }
    bool isNull() const { return type_ == JsonType::Null; }
    bool isBool() const { return type_ == JsonType::Bool; }
    bool isNumber() const { return type_ == JsonType::Number; }
    bool isString() const { return type_ == JsonType::String; }
    bool isArray() const { return type_ == JsonType::Array; }
    bool isObject() const { return type_ == JsonType::Object; }

    bool asBool(bool def = false) const { return isBool() ? boolVal_ : def; }
    double asDouble(double def = 0.0) const { return isNumber() ? numVal_ : def; }
    int asInt(int def = 0) const { return isNumber() ? static_cast<int>(numVal_) : def; }
    const std::string& asString(const std::string& def = "") const {
        return isString() ? strVal_ : def;
    }
    const std::vector<JsonValue>& asArray() const { return arrVal_; }
    const std::map<std::string, JsonValue>& asObject() const { return objVal_; }

    std::vector<JsonValue>& asArray() { return arrVal_; }
    std::map<std::string, JsonValue>& asObject() { return objVal_; }

    bool has(const std::string& key) const {
        return isObject() && objVal_.find(key) != objVal_.end();
    }

    const JsonValue& operator[](const std::string& key) const {
        static const JsonValue nullVal;
        if (!isObject()) return nullVal;
        auto it = objVal_.find(key);
        return (it != objVal_.end()) ? it->second : nullVal;
    }

    JsonValue& operator[](const std::string& key) {
        if (!isObject()) {
            type_ = JsonType::Object;
            objVal_.clear();
        }
        return objVal_[key];
    }

    const JsonValue& operator[](size_t index) const {
        static const JsonValue nullVal;
        if (!isArray() || index >= arrVal_.size()) return nullVal;
        return arrVal_[index];
    }

    void push_back(const JsonValue& val) {
        if (!isArray()) {
            type_ = JsonType::Array;
            arrVal_.clear();
        }
        arrVal_.push_back(val);
    }

    static JsonValue parse(const std::string& src, std::string& err);
    std::string serialize(int indent = 2) const;

private:
    JsonType type_{JsonType::Null};
    bool boolVal_{false};
    double numVal_{0.0};
    std::string strVal_;
    std::vector<JsonValue> arrVal_;
    std::map<std::string, JsonValue> objVal_;

    void serializeInternal(std::ostream& os, int currentIndent, int indentStep) const;
};

} // namespace SimpleJson

#endif // JSON_H
