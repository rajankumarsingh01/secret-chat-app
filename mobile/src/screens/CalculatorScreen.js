import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from "react-native";
import { colors } from "../theme";
import { useAuth } from "../context/AuthContext";

const SECRET_CODE = "123";

const buttons = [
  ["C", "±", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["0", ".", "="],
];

const OP_MAP = { "÷": "/", "×": "*", "−": "-", "+": "+" };

const CalculatorScreen = ({ navigation }) => {
  const [display, setDisplay] = useState("0");
  const [rawInput, setRawInput] = useState("");

  const { user } = useAuth();

  const isOperator = (v) => ["÷", "×", "−", "+"].includes(v);

  const handlePress = (value) => {
    if (value === "C") {
      setDisplay("0");
      setRawInput("");
      return;
    }

    if (value === "±") {
      if (!rawInput) return;
      const toggled = rawInput.startsWith("-") ? rawInput.slice(1) : "-" + rawInput;
      setRawInput(toggled);
      setDisplay(toggled);
      return;
    }

    if (value === "%") {
      try {
        const result = eval(rawInput) / 100;
        setDisplay(String(result));
        setRawInput(String(result));
      } catch {
        setDisplay("Error");
      }
      return;
    }

    if (value === "=") {
     if (rawInput.trim() === SECRET_CODE) {
        setDisplay("0");
        setRawInput("");
      navigation.replace(user ? "ChatList" : "Login");
        return;
      }
      try {
        const result = eval(rawInput);
        setDisplay(String(result));
        setRawInput(String(result));
      } catch {
        setDisplay("Error");
        setRawInput("");
      }
      return;
    }

    const actual = isOperator(value) ? OP_MAP[value] : value;
    const newInput = rawInput === "0" ? actual : rawInput + actual;
    setRawInput(newInput);
    setDisplay(newInput.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−"));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.displayContainer}>
        <Text style={styles.displayText} numberOfLines={1} adjustsFontSizeToFit>
          {display}
        </Text>
      </View>
      <View style={styles.buttonsContainer}>
        {buttons.map((row, rowIndex) => (
          <View style={styles.row} key={rowIndex}>
            {row.map((btn) => {
              const wide = btn === "0";
              const operator = isOperator(btn) || btn === "=";
              const utility = btn === "C" || btn === "±" || btn === "%";
              return (
                <TouchableOpacity
                  key={btn}
                  activeOpacity={0.7}
                  style={[
                    styles.button,
                    wide && styles.buttonWide,
                    operator && styles.buttonOperator,
                    utility && styles.buttonUtility,
                  ]}
                  onPress={() => handlePress(btn)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      operator && styles.buttonTextOperator,
                      utility && styles.buttonTextUtility,
                    ]}
                  >
                    {btn}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "flex-end" },
  displayContainer: { paddingHorizontal: 28, paddingBottom: 20, alignItems: "flex-end" },
  displayText: { color: colors.text, fontSize: 72, fontWeight: "300" },
  buttonsContainer: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { flexDirection: "row", marginBottom: 12 },
  button: {
    flex: 1,
    marginHorizontal: 6,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonWide: { flex: 2.15 },
  buttonOperator: { backgroundColor: colors.accent },
  buttonUtility: { backgroundColor: colors.surfaceAlt },
  buttonText: { color: colors.text, fontSize: 28, fontWeight: "500" },
  buttonTextOperator: { color: "#fff", fontWeight: "700" },
  buttonTextUtility: { color: colors.accentSoft, fontWeight: "600" },
});

export default CalculatorScreen;